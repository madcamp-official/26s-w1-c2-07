import { Prisma } from "@prisma/client";
import { z } from "zod";

import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseBbox,
  polygonFromBbox,
  type BoundingBox,
} from "@/lib/seat-zone-geometry";

const UNKNOWN_GRADE_LABEL = "미확인";

const seatMapParamsSchema = z.object({
  seatMapId: z.string().uuid(),
});

const seatZoneCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  grade: z
    .string()
    .trim()
    .max(30)
    .transform((value) => value || UNKNOWN_GRADE_LABEL),
  price: z.number().int().nonnegative().nullable().optional(),
  bbox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().gt(0).max(1),
      height: z.number().gt(0).max(1),
    })
    .refine((bbox) => bbox.x + bbox.width <= 1 && bbox.y + bbox.height <= 1)
    .optional(),
});

const DEFAULT_CREATED_ZONE_BBOX: BoundingBox = {
  x: 0.4,
  y: 0.4,
  width: 0.2,
  height: 0.16,
};

type SeatMapSeatZonesRouteContext = {
  params: Promise<{
    seatMapId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: SeatMapSeatZonesRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatMapParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 배치도 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = seatZoneCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("좌석 구역 생성 입력값이 올바르지 않습니다.", 422);
  }

  const bbox = parseBbox(parsedBody.data.bbox) ?? DEFAULT_CREATED_ZONE_BBOX;
  const polygon = polygonFromBbox(bbox);

  const seatMap = await prisma.seatMap.findFirst({
    where: {
      id: parsedParams.data.seatMapId,
      createdBy: auth.user.id,
    },
    select: {
      id: true,
      analysisStatus: true,
    },
  });

  if (!seatMap) {
    return apiError("좌석 배치도를 찾을 수 없습니다.", 404);
  }

  if (seatMap.analysisStatus !== "success") {
    return apiError("분석이 완료된 좌석 배치도만 구역을 추가할 수 있습니다.", 409);
  }

  const createdZone = await prisma.$transaction(async (tx) => {
    const seatZone = await tx.seatZone.create({
      data: {
        seatMapId: seatMap.id,
        name: parsedBody.data.name,
        grade: parsedBody.data.grade,
        price: parsedBody.data.price ?? null,
        bbox: bbox as unknown as Prisma.InputJsonValue,
        polygon: polygon as unknown as Prisma.InputJsonValue,
        confidence: null,
        isAiGenerated: false,
        allocatedSeatCount: null,
        virtualSeatConfig: Prisma.JsonNull,
      },
    });

    await tx.seatMap.update({
      where: {
        id: seatMap.id,
      },
      data: {
        totalSeatCount: null,
      },
    });

    return seatZone;
  });

  return apiData({
    seatZone: createdZone,
  });
}
