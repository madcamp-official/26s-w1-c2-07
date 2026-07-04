import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const practiceSessions = await prisma.practiceSession.findMany({
    where: {
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
      schedule: {
        select: {
          id: true,
          performanceDate: true,
          roundName: true,
          startTime: true,
        },
      },
      selectedZone: {
        select: {
          id: true,
          name: true,
          grade: true,
        },
      },
      selectedSeat: {
        select: {
          id: true,
          rowLabel: true,
          seatNumber: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return apiData({
    practiceSessions,
  });
}
