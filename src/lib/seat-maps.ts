import { prisma } from "@/lib/prisma";

export async function getLatestSeatMapForConcert(
  concertId: string,
  userId: string,
) {
  return prisma.seatMap.findFirst({
    where: {
      concertId,
      createdBy: userId,
    },
    include: {
      zones: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
