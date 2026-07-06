import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { practiceSessionCompleteSchema } from "@/lib/validators";

const practiceSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

type PracticeSessionCompleteRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

async function validateSchedule(input: {
  scheduleId: string | undefined;
  concertId: string;
}) {
  if (!input.scheduleId) {
    return true;
  }

  const schedule = await prisma.concertSchedule.findFirst({
    where: {
      id: input.scheduleId,
      concertId: input.concertId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(schedule);
}

async function validateZoneAndSeat(input: {
  concertId: string;
  userId: string;
  selectedZoneId: string | null | undefined;
  selectedSeatId: string | null | undefined;
}) {
  if (!input.selectedZoneId && !input.selectedSeatId) {
    return true;
  }

  if (!input.selectedZoneId || !input.selectedSeatId) {
    return false;
  }

  const seat = await prisma.virtualSeat.findFirst({
    where: {
      id: input.selectedSeatId,
      zoneId: input.selectedZoneId,
      status: "available",
      zone: {
        seatMap: {
          concertId: input.concertId,
          createdBy: input.userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(seat);
}

export async function PATCH(
  request: Request,
  { params }: PracticeSessionCompleteRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = practiceSessionParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("연습 세션 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = practiceSessionCompleteSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("티켓팅 연습 완료 입력값이 올바르지 않습니다.", 422);
  }

  const practiceSession = await prisma.practiceSession.findFirst({
    where: {
      id: parsedParams.data.sessionId,
      userId: user.id,
    },
    select: {
      id: true,
      concertId: true,
    },
  });

  if (!practiceSession) {
    return apiError("연습 세션을 찾을 수 없습니다.", 404);
  }

  const isValidSchedule = await validateSchedule({
    scheduleId: parsedBody.data.scheduleId,
    concertId: practiceSession.concertId,
  });

  if (!isValidSchedule) {
    return apiError("선택한 회차가 공연 정보와 일치하지 않습니다.", 422);
  }

  const isValidSeat = await validateZoneAndSeat({
    concertId: practiceSession.concertId,
    userId: user.id,
    selectedZoneId: parsedBody.data.selectedZoneId,
    selectedSeatId: parsedBody.data.selectedSeatId,
  });

  if (!isValidSeat) {
    return apiError("선택한 좌석 정보가 공연 좌석 데이터와 일치하지 않습니다.", 422);
  }

  const updatedPracticeSession = await prisma.practiceSession.update({
    where: {
      id: practiceSession.id,
    },
    data: {
      status: parsedBody.data.status,
      scheduleId: parsedBody.data.scheduleId ?? null,
      selectedZoneId: parsedBody.data.selectedZoneId ?? null,
      selectedSeatId: parsedBody.data.selectedSeatId ?? null,
      elapsedMs: parsedBody.data.elapsedMs,
      failReason:
        parsedBody.data.status === "failed"
          ? (parsedBody.data.failReason ?? "연습에 실패했습니다.")
          : null,
      completedAt: new Date(),
    },
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          venueName: true,
        },
      },
      schedule: true,
      selectedZone: {
        select: {
          id: true,
          name: true,
          grade: true,
          price: true,
        },
      },
      selectedSeat: {
        select: {
          id: true,
          rowLabel: true,
          seatNumber: true,
          status: true,
        },
      },
    },
  });

  return apiData({
    practiceSession: updatedPracticeSession,
  });
}
