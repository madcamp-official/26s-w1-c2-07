import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { practiceSessionCreateSchema } from "@/lib/validators";
import { ensureVirtualSeatsForSeatMap } from "@/lib/virtual-seats";

export async function POST(request: Request) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = practiceSessionCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("티켓팅 연습 시작 입력값이 올바르지 않습니다.", 422);
  }

  const concert = await prisma.concert.findUnique({
    where: {
      id: parsedBody.data.concertId,
    },
    select: {
      id: true,
      seatMaps: {
        where: {
          createdBy: auth.user.id,
          analysisStatus: "success",
        },
        select: {
          id: true,
          _count: {
            select: {
              zones: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!concert) {
    return apiError("공연을 찾을 수 없습니다.", 404);
  }

  const latestSeatMap = concert.seatMaps[0] ?? null;

  if (!latestSeatMap || latestSeatMap._count.zones === 0) {
    return apiError(
      "AI 좌석 구역 분석이 완료된 공연만 연습할 수 있습니다.",
      409,
    );
  }

  try {
    const seatPreparation = await ensureVirtualSeatsForSeatMap(
      latestSeatMap.id,
    );

    if (!seatPreparation.ready) {
      return apiError(
        "좌석 선택 화면을 준비하지 못했습니다. 좌석 배치도 분석 결과를 확인해주세요.",
        409,
      );
    }

    const practiceSession = await prisma.practiceSession.create({
      data: {
        userId: auth.user.id,
        concertId: concert.id,
        templateType: parsedBody.data.templateType,
        difficulty: parsedBody.data.difficulty ?? "normal",
        startDelayMs: parsedBody.data.startDelayMs ?? 0,
        status: "started",
      },
    });

    return apiData(
      {
        practiceSession,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(
      error instanceof Error
        ? `티켓팅 연습 준비에 실패했습니다: ${error.message}`
        : "티켓팅 연습 준비에 실패했습니다.",
      500,
    );
  }
}
