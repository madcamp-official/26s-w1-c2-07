import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { practiceSessionCreateSchema } from "@/lib/validators";

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
          analysisStatus: "success",
        },
        select: {
          id: true,
          _count: {
            select: {
              zones: true,
            },
          },
          zones: {
            select: {
              _count: {
                select: {
                  virtualSeats: true,
                },
              },
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
    return apiError("AI 좌석 구역 분석이 완료된 공연만 연습할 수 있습니다.", 409);
  }

  const hasVirtualSeats = latestSeatMap.zones.some(
    (zone) => zone._count.virtualSeats > 0,
  );

  if (!hasVirtualSeats) {
    return apiError("가상 좌석을 생성한 뒤 티켓팅 연습을 시작할 수 있습니다.", 409);
  }

  try {
    const practiceSession = await prisma.practiceSession.create({
      data: {
        userId: auth.user.id,
        concertId: concert.id,
        templateType: parsedBody.data.templateType,
        difficulty: parsedBody.data.difficulty ?? "normal",
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
        ? `티켓팅 연습 세션 생성에 실패했습니다: ${error.message}`
        : "티켓팅 연습 세션 생성에 실패했습니다.",
      500,
    );
  }
}
