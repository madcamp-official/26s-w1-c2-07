import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const reviews = await prisma.review.findMany({
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
      zone: {
        select: {
          id: true,
          name: true,
          grade: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return apiData({
    reviews,
  });
}

