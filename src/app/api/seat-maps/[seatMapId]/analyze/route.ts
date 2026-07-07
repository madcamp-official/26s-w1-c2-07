import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { createOpenAIClient, getSeatMapAnalysisModel } from "@/lib/openai";
import {
  aiSeatMapAnalysisSchema,
  normalizeSeatMapAnalysis,
} from "@/lib/seat-zone-analysis";

export const runtime = "nodejs";

const seatMapParamsSchema = z.object({
  seatMapId: z.string().uuid(),
});

type SeatMapAnalyzeRouteContext = {
  params: Promise<{
    seatMapId: string;
  }>;
};

function getAnalysisPrompt(input: {
  title: string;
  venueName: string;
  artist: string;
}) {
  return [
    "업로드된 콘서트 좌석 배치도 이미지에서 좌석 구역 후보를 추출하세요.",
    "",
    `공연명: ${input.title}`,
    `공연장: ${input.venueName}`,
    `아티스트: ${input.artist}`,
    "",
    "반드시 지킬 규칙:",
    "- 좌석 구역 단위만 추출하세요.",
    "- 몇 열 몇 번 같은 실제 좌석 번호는 추출하지 마세요.",
    "- 구역명, 등급, bbox, polygon, confidence를 반환하세요.",
    "- 등급은 VIP, R, S, A, B, C처럼 티켓 가격 등급이 이미지에 명확히 표시된 경우에만 입력하세요.",
    "- FLOOR, 1층, 2층, 3층, 스탠딩, 콘솔처럼 층/좌석 유형/구역 정보를 등급으로 넣지 마세요.",
    '- 티켓 가격 등급이 이미지에 없거나 확실하지 않으면 grade는 반드시 "미확인"으로 반환하세요.',
    "- bbox와 polygon 좌표는 이미지 전체 기준 0~1 정규화 좌표로 반환하세요.",
    "- bbox는 { x, y, width, height } 형식이며 x/y는 좌상단 기준입니다.",
    "- polygon은 좌석 구역의 실제 보이는 외곽선을 시계 방향 또는 반시계 방향 점 배열로 반환하세요.",
    "- polygon에 bbox의 네 꼭짓점만 그대로 복사하지 마세요.",
    "- 실제 구역이 축에 평행한 완전한 직사각형으로 보이는 경우에만 polygon이 bbox와 같은 4점 사각형이어도 됩니다.",
    "- 부채꼴, 곡선형, 사다리꼴, 꺾인 블록, 통로가 포함된 비정형 구역은 실제 외곽을 따라 5~12개 점으로 근사하세요.",
    "- 실제 외곽선을 확신할 수 없으면 polygon은 빈 배열 []로 반환하고 confidence를 0.6 이하로 낮추세요.",
    "- 확실하지 않은 구역은 confidence를 낮게 설정하세요.",
    "- 이미지에 보이는 구역명과 등급을 우선 사용하고, 모호하면 일반적인 등급명을 추정하세요.",
    "- 중복 구역은 가능한 한 하나로 합치되, 물리적으로 떨어진 구역이면 별도 구역으로 반환하세요.",
  ].join("\n");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

export async function POST(
  _request: Request,
  { params }: SeatMapAnalyzeRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsed = seatMapParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return apiError("좌석 배치도 ID가 올바르지 않습니다.", 400);
  }

  const seatMap = await prisma.seatMap.findUnique({
    where: {
      id: parsed.data.seatMapId,
    },
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
          venueName: true,
        },
      },
    },
  });

  if (!seatMap) {
    return apiError("좌석 배치도를 찾을 수 없습니다.", 404);
  }

  if (seatMap.createdBy !== auth.user.id) {
    return apiError("좌석 배치도를 분석할 권한이 없습니다.", 403);
  }

  await prisma.seatMap.update({
    where: {
      id: seatMap.id,
    },
    data: {
      analysisStatus: "pending",
    },
  });

  try {
    const openai = createOpenAIClient();
    const model = getSeatMapAnalysisModel();
    const response = await openai.responses.create({
      model,
      store: false,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: getAnalysisPrompt({
                title: seatMap.concert.title,
                venueName: seatMap.concert.venueName,
                artist: seatMap.concert.artist,
              }),
            },
            {
              type: "input_image",
              image_url: seatMap.imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(aiSeatMapAnalysisSchema, "seat_map_zones"),
      },
      max_output_tokens: 6000,
    });

    const rawAnalysis = JSON.parse(response.output_text) as unknown;
    const { zones, discardedCount, imprecisePolygonCount } =
      normalizeSeatMapAnalysis(rawAnalysis);

    if (zones.length === 0) {
      throw new Error("저장 가능한 좌석 구역을 찾지 못했습니다.");
    }

    const aiRawResult: Prisma.InputJsonObject = {
      model: String(response.model ?? model),
      output: rawAnalysis as Prisma.InputJsonValue,
      usage: response.usage
        ? (JSON.parse(JSON.stringify(response.usage)) as Prisma.InputJsonValue)
        : null,
      discardedCount,
      imprecisePolygonCount,
    };

    const updatedSeatMap = await prisma.$transaction(
      async (tx) => {
        await tx.seatZone.deleteMany({
          where: {
            seatMapId: seatMap.id,
          },
        });

        await tx.seatZone.createMany({
          data: zones.map((zone) => ({
            seatMapId: seatMap.id,
            name: zone.name,
            grade: zone.grade,
            bbox: zone.bbox as Prisma.InputJsonValue,
            polygon: zone.polygon as unknown as Prisma.InputJsonValue,
            confidence: zone.confidence,
            isAiGenerated: true,
          })),
        });

        return tx.seatMap.update({
          where: {
            id: seatMap.id,
          },
          data: {
            analysisStatus: "success",
            aiRawResult,
            totalSeatCount: null,
          },
          include: {
            zones: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );

    return apiData({
      seatMap: updatedSeatMap,
      zoneCount: zones.length,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    await prisma.seatMap.update({
      where: {
        id: seatMap.id,
      },
      data: {
        analysisStatus: "failed",
        aiRawResult: {
          error: message,
        },
      },
    });

    return apiError(`AI 좌석 구역 분석에 실패했습니다: ${message}`, 500);
  }
}
