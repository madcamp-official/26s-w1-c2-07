import { apiData } from "@/lib/api";
import { getConcertList } from "@/lib/concerts";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [featuredConcerts, recentReviews] = await Promise.all([
    getConcertList({
      scope: "upcoming",
      take: 4,
    }),
    prisma.review.findMany({
      select: {
        id: true,
        seatFloor: true,
        seatSection: true,
        seatRow: true,
        seatNumber: true,
        satisfactionScore: true,
        concert: {
          select: {
            id: true,
            title: true,
          },
        },
        zone: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    }),
  ]);

  return apiData({
    featuredConcerts,
    recentReviews,
  });
}
