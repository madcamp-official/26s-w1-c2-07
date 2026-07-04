import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

const practiceSessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

type PracticeSessionRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: PracticeSessionRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = practiceSessionParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("연습 세션 ID가 올바르지 않습니다.", 400);
  }

  const practiceSession = await prisma.practiceSession.findFirst({
    where: {
      id: parsedParams.data.sessionId,
      userId: user.id,
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

  if (!practiceSession) {
    return apiError("연습 세션을 찾을 수 없습니다.", 404);
  }

  return apiData({
    practiceSession,
  });
}
