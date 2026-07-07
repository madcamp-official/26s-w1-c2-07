import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiData, apiError } from "@/lib/api";
import { getCurrentUser, getCurrentUserWithProfile } from "@/lib/auth";
import { virtualSeatGenerateSchema } from "@/lib/validators";
import {
  generateVirtualSeats,
  normalizeVirtualSeatBbox,
  normalizeVirtualSeatPolygon,
} from "@/utils/virtualSeatGenerator";

const seatZoneParamsSchema = z.object({
  zoneId: z.string().uuid(),
});

type VirtualSeatsRouteContext = {
  params: Promise<{
    zoneId: string;
  }>;
};

type SortableVirtualSeat = {
  rowLabel: string;
  seatNumber: number;
};

function getRowNumber(rowLabel: string) {
  const rowNumber = Number.parseInt(rowLabel, 10);

  return Number.isFinite(rowNumber) ? rowNumber : Number.MAX_SAFE_INTEGER;
}

function sortVirtualSeats<T extends SortableVirtualSeat>(seats: T[]) {
  return [...seats].sort((a, b) => {
    const rowDiff = getRowNumber(a.rowLabel) - getRowNumber(b.rowLabel);

    if (rowDiff !== 0) {
      return rowDiff;
    }

    return a.seatNumber - b.seatNumber;
  });
}

export async function GET(
  _request: Request,
  { params }: VirtualSeatsRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const seatZone = await prisma.seatZone.findUnique({
    where: {
      id: parsedParams.data.zoneId,
    },
    select: {
      id: true,
      name: true,
      grade: true,
      price: true,
      virtualSeatConfig: true,
      seatMap: {
        select: {
          createdBy: true,
        },
      },
      virtualSeats: {
        select: {
          id: true,
          rowLabel: true,
          seatNumber: true,
          status: true,
          x: true,
          y: true,
        },
      },
    },
  });

  if (!seatZone || seatZone.seatMap.createdBy !== user.id) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  return apiData({
    zone: {
      id: seatZone.id,
      name: seatZone.name,
      grade: seatZone.grade,
      price: seatZone.price,
      virtualSeatConfig: seatZone.virtualSeatConfig,
    },
    virtualSeats: sortVirtualSeats(seatZone.virtualSeats),
  });
}

export async function POST(
  request: Request,
  { params }: VirtualSeatsRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatZoneParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 구역 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = virtualSeatGenerateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("좌석 데이터 생성 입력값이 올바르지 않습니다.", 422);
  }

  const seatZone = await prisma.seatZone.findUnique({
    where: {
      id: parsedParams.data.zoneId,
    },
    include: {
      seatMap: {
        select: {
          createdBy: true,
        },
      },
      _count: {
        select: {
          virtualSeats: true,
        },
      },
    },
  });

  if (!seatZone) {
    return apiError("좌석 구역을 찾을 수 없습니다.", 404);
  }

  if (seatZone.seatMap.createdBy !== auth.user.id) {
    return apiError("좌석 데이터를 생성할 권한이 없습니다.", 403);
  }

  const overwrite = parsedBody.data.overwrite === true;

  if (seatZone._count.virtualSeats > 0 && !overwrite) {
    return apiError(
      "이미 준비된 좌석 데이터가 있습니다. 다시 생성하려면 overwrite 값을 true로 보내주세요.",
      409,
    );
  }

  const bbox = normalizeVirtualSeatBbox(seatZone.bbox);
  const polygon = normalizeVirtualSeatPolygon(seatZone.polygon);
  const { seats, config } = generateVirtualSeats({
    zoneId: seatZone.id,
    rows: parsedBody.data.rows,
    seatsPerRow: parsedBody.data.seatsPerRow,
    bbox,
    polygon,
  });
  const virtualSeatConfig: Prisma.InputJsonObject = {
    ...config,
    generatedAt: new Date().toISOString(),
    coordinateScope: polygon || bbox ? "seat-map" : "none",
  };

  const virtualSeats = await prisma.$transaction(async (tx) => {
    if (overwrite) {
      await tx.virtualSeat.deleteMany({
        where: {
          zoneId: seatZone.id,
        },
      });
    }

    await tx.virtualSeat.createMany({
      data: seats.map((seat) => ({
        zoneId: seat.zoneId,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        status: seat.status,
        x: seat.x ?? null,
        y: seat.y ?? null,
      })),
    });

    await tx.seatZone.update({
      where: {
        id: seatZone.id,
      },
      data: {
        virtualSeatConfig,
      },
    });

    const createdSeats = await tx.virtualSeat.findMany({
      where: {
        zoneId: seatZone.id,
      },
      select: {
        id: true,
        rowLabel: true,
        seatNumber: true,
        status: true,
        x: true,
        y: true,
      },
    });

    return sortVirtualSeats(createdSeats);
  });

  return apiData(
    {
      zone: {
        id: seatZone.id,
        name: seatZone.name,
        grade: seatZone.grade,
        price: seatZone.price,
        virtualSeatConfig,
      },
      virtualSeats,
    },
    { status: 201 },
  );
}
