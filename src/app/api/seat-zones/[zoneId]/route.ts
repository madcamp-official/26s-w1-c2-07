import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { seatZoneUpdateSchema } from "@/lib/validators";
import { createVirtualSeatsForZones } from "@/lib/virtual-seats";

const seatZoneParamsSchema = z.object({
  zoneId: z.string().uuid(),
});

type SeatZoneRouteContext = {
  params: Promise<{
    zoneId: string;
  }>;
};

async function getEditableSeatZone(zoneId: string) {
  return prisma.seatZone.findUnique({
    where: {
      id: zoneId,
    },
    include: {
      seatMap: {
        select: {
          id: true,
          createdBy: true,
        },
      },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: SeatZoneRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = seatZoneUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("좌석 구역 수정 입력값이 올바르지 않습니다.", 422);
  }

  const seatZone = await getEditableSeatZone(parsedParams.data.zoneId);

  if (!seatZone) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  if (seatZone.seatMap.createdBy !== auth.user.id) {
    return apiError("좌석 구역을 수정할 권한이 없습니다.", 403);
  }

  const { updatedZone, seatPreparation } = await prisma.$transaction(
    async (tx) => {
      const updatedZone = await tx.seatZone.update({
        where: {
          id: seatZone.id,
        },
        data: {
          name: parsedBody.data.name,
          grade: parsedBody.data.grade,
          price: parsedBody.data.price ?? null,
          ...(parsedBody.data.polygon
            ? {
                polygon: parsedBody.data
                  .polygon as unknown as Prisma.InputJsonValue,
              }
            : {}),
          isAiGenerated: false,
        },
      });
      const seatPreparation = parsedBody.data.polygon
        ? await createVirtualSeatsForZones(
            tx,
            [
              {
                id: updatedZone.id,
                bbox: updatedZone.bbox,
                polygon: updatedZone.polygon,
              },
            ],
            {
              overwrite: true,
            },
          )
        : null;

      return {
        updatedZone,
        seatPreparation,
      };
    },
  );

  return apiData({
    seatZone: updatedZone,
    seatCount: seatPreparation?.seatCount ?? null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: SeatZoneRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const seatZone = await getEditableSeatZone(parsedParams.data.zoneId);

  if (!seatZone) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  if (seatZone.seatMap.createdBy !== auth.user.id) {
    return apiError("좌석 구역을 삭제할 권한이 없습니다.", 403);
  }

  await prisma.$transaction([
    prisma.seatZone.delete({
      where: {
        id: seatZone.id,
      },
    }),
    prisma.seatMap.update({
      where: {
        id: seatZone.seatMap.id,
      },
      data: {
        totalSeatCount: null,
      },
    }),
  ]);

  return apiData({
    deleted: true,
  });
}
