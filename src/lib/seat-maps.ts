import { prisma } from "@/lib/prisma";

export async function getLatestSeatMapForConcert(concertId: string) {
  return prisma.seatMap.findFirst({
    where: {
      concertId,
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
