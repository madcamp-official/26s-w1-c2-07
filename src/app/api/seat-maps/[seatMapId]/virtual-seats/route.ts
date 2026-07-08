import { z } from "zod";

import { apiData, apiError } from "@/lib/api";
import { getCurrentUser, getCurrentUserWithProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAreaProportionalVirtualSeatsForSeatMap,
  MAX_TOTAL_SEAT_COUNT,
} from "@/lib/virtual-seats";
import { seatMapVirtualSeatGenerateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const seatMapParamsSchema = z.object({
  seatMapId: z.string().uuid(),
});

type SeatMapVirtualSeatsRouteContext = {
  params: Promise<{
    seatMapId: string;
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
  { params }: SeatMapVirtualSeatsRouteContext,
) {
  const user = await getCurrentUser();

  if (!user) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatMapParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 배치도 ID가 올바르지 않습니다.", 400);
  }

  const seatMap = await prisma.seatMap.findFirst({
    where: {
      id: parsedParams.data.seatMapId,
      createdBy: user.id,
      analysisStatus: "success",
    },
    select: {
      id: true,
      zones: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          name: true,
          grade: true,
          price: true,
          bbox: true,
          polygon: true,
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
      },
    },
  });

  if (!seatMap) {
    return apiError("좌석 배치도를 찾을 수 없습니다.", 404);
  }

  return apiData({
    zones: seatMap.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      grade: zone.grade,
      price: zone.price,
      bbox: zone.bbox,
      polygon: zone.polygon,
      virtualSeats: sortVirtualSeats(zone.virtualSeats).map((seat) => ({
        id: seat.id,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        status: seat.status,
        zoneId: zone.id,
        x: seat.x,
        y: seat.y,
      })),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: SeatMapVirtualSeatsRouteContext,
) {
  const auth = await getCurrentUserWithProfile();

  if (!auth) {
    return apiError("로그인이 필요합니다.", 401);
  }

  const parsedParams = seatMapParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return apiError("좌석 배치도 ID가 올바르지 않습니다.", 400);
  }

  const body = await request.json().catch(() => null);
  const parsedBody = seatMapVirtualSeatGenerateSchema.safeParse(body);

  if (!parsedBody.success) {
    return apiError("전체 좌석 수 입력값이 올바르지 않습니다.", 422);
  }

  const seatMap = await prisma.seatMap.findFirst({
    where: {
      id: parsedParams.data.seatMapId,
      createdBy: auth.user.id,
    },
    select: {
      id: true,
      analysisStatus: true,
      zones: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          bbox: true,
          polygon: true,
          _count: {
            select: {
              virtualSeats: true,
            },
          },
        },
      },
    },
  });

  if (!seatMap) {
    return apiError("좌석 배치도를 찾을 수 없습니다.", 404);
  }

  if (seatMap.analysisStatus !== "success") {
    return apiError(
      "AI 좌석 구역 분석이 완료된 배치도만 생성할 수 있습니다.",
      409,
    );
  }

  if (seatMap.zones.length === 0) {
    return apiError("좌석을 배분할 구역이 없습니다.", 409);
  }

  if (parsedBody.data.totalSeatCount < seatMap.zones.length) {
    return apiError(
      `전체 좌석 수는 좌석 구역 수(${seatMap.zones.length}개)보다 작을 수 없습니다.`,
      422,
    );
  }

  if (parsedBody.data.totalSeatCount > MAX_TOTAL_SEAT_COUNT) {
    return apiError(
      `전체 좌석 수는 ${MAX_TOTAL_SEAT_COUNT.toLocaleString("ko-KR")}석을 넘을 수 없습니다.`,
      422,
    );
  }

  const existingSeatCount = seatMap.zones.reduce(
    (sum, zone) => sum + zone._count.virtualSeats,
    0,
  );
  const overwrite = parsedBody.data.overwrite === true;

  if (existingSeatCount > 0 && !overwrite) {
    return apiError(
      "이미 준비된 좌석 데이터가 있습니다. 다시 생성하려면 overwrite 값을 true로 보내주세요.",
      409,
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const generationResult =
          await createAreaProportionalVirtualSeatsForSeatMap(tx, {
            zones: seatMap.zones,
            totalSeatCount: parsedBody.data.totalSeatCount,
          });

        await tx.seatMap.update({
          where: {
            id: seatMap.id,
          },
          data: {
            totalSeatCount: parsedBody.data.totalSeatCount,
          },
        });

        return generationResult;
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      },
    );

    return apiData(
      {
        totalSeatCount: parsedBody.data.totalSeatCount,
        zoneCount: result.zoneCount,
        seatCount: result.seatCount,
        allocations: result.allocations,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(
      error instanceof Error
        ? `좌석 데이터 생성에 실패했습니다: ${error.message}`
        : "좌석 데이터 생성에 실패했습니다.",
      500,
    );
  }
}
