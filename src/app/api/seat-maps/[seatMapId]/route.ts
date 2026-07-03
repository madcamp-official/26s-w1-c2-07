import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";

const seatMapParamsSchema = z.object({
  seatMapId: z.string().uuid(),
});

type SeatMapRouteContext = {
  params: Promise<{
    seatMapId: string;
  }>;
};

export async function GET(_request: Request, { params }: SeatMapRouteContext) {
  const parsed = seatMapParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return apiError("좌석 배치도 ID가 올바르지 않습니다.", 400);
  }

  const seatMap = await prisma.seatMap.findUnique({
    where: {
      id: parsed.data.seatMapId,
    },
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
          venueName: true,
          region: true,
        },
      },
      zones: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!seatMap) {
    return apiError("좌석 배치도를 찾을 수 없습니다.", 404);
  }

  return apiData({
    seatMap,
  });
}

