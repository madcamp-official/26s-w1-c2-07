import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  generateVirtualSeats,
  getPolygonArea,
  MAX_TARGET_VIRTUAL_SEAT_TOTAL,
  normalizeVirtualSeatBbox,
  normalizeVirtualSeatPolygon,
} from "@/utils/virtualSeatGenerator";

export const MAX_TOTAL_SEAT_COUNT = MAX_TARGET_VIRTUAL_SEAT_TOTAL;
const VIRTUAL_SEAT_CREATE_BATCH_SIZE = 1_000;

type SeatZoneForGeneration = {
  id: string;
  bbox: unknown;
  polygon: unknown;
  allocatedSeatCount?: number | null;
  _count?: {
    virtualSeats: number;
  };
  virtualSeatConfig?: unknown;
  virtualSeats?: {
    x: number | null;
    y: number | null;
  }[];
};

type CreateVirtualSeatsOptions = {
  overwrite?: boolean;
};

export type VirtualSeatEnsureResult = {
  zoneCount: number;
  readyZoneCount: number;
  repairedZoneCount: number;
  createdSeatCount: number;
  missingGeometryZoneCount: number;
  invalidSeatZoneCount: number;
  ready: boolean;
};

export type AreaSeatAllocation = {
  zoneId: string;
  allocatedSeatCount: number;
  areaRatio: number;
  geometrySource: "polygon" | "bbox" | "fallback";
};

function isNormalizedSeatCoordinate(value: number | null | undefined) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function getZoneGeometryWeight(zone: SeatZoneForGeneration) {
  const polygon = normalizeVirtualSeatPolygon(zone.polygon);

  if (polygon) {
    return {
      weight: Math.max(getPolygonArea(polygon), Number.EPSILON),
      source: "polygon" as const,
    };
  }

  const bbox = normalizeVirtualSeatBbox(zone.bbox);

  if (bbox) {
    return {
      weight: Math.max(bbox.width * bbox.height, Number.EPSILON),
      source: "bbox" as const,
    };
  }

  return {
    weight: 1,
    source: "fallback" as const,
  };
}

export function allocateSeatCountsByArea(
  zones: SeatZoneForGeneration[],
  totalSeatCount: number,
) {
  if (zones.length === 0) {
    throw new Error("좌석 구역이 없습니다.");
  }

  if (!Number.isInteger(totalSeatCount)) {
    throw new Error("전체 좌석 수는 정수여야 합니다.");
  }

  if (totalSeatCount < zones.length) {
    throw new Error("전체 좌석 수는 좌석 구역 수보다 작을 수 없습니다.");
  }

  if (totalSeatCount > MAX_TOTAL_SEAT_COUNT) {
    throw new Error(
      `전체 좌석 수는 ${MAX_TOTAL_SEAT_COUNT}석을 넘을 수 없습니다.`,
    );
  }

  const zoneWeights = zones.map((zone, index) => ({
    zone,
    index,
    ...getZoneGeometryWeight(zone),
  }));
  const totalWeight = zoneWeights.reduce(
    (sum, zoneWeight) => sum + zoneWeight.weight,
    0,
  );
  const remainingSeatCount = totalSeatCount - zones.length;
  const allocations = zoneWeights.map((zoneWeight) => {
    const areaRatio = zoneWeight.weight / totalWeight;
    const rawAdditionalSeatCount = remainingSeatCount * areaRatio;
    const additionalSeatCount = Math.floor(rawAdditionalSeatCount);

    return {
      zoneId: zoneWeight.zone.id,
      allocatedSeatCount: 1 + additionalSeatCount,
      areaRatio,
      geometrySource: zoneWeight.source,
      remainder: rawAdditionalSeatCount - additionalSeatCount,
      weight: zoneWeight.weight,
      index: zoneWeight.index,
    };
  });
  const allocatedSeatCount = allocations.reduce(
    (sum, allocation) => sum + allocation.allocatedSeatCount,
    0,
  );
  let remainingRemainderSeatCount = totalSeatCount - allocatedSeatCount;
  const remainderOrder = [...allocations].sort(
    (first, second) =>
      second.remainder - first.remainder ||
      second.weight - first.weight ||
      first.index - second.index,
  );

  for (const allocation of remainderOrder) {
    if (remainingRemainderSeatCount <= 0) {
      break;
    }

    allocation.allocatedSeatCount += 1;
    remainingRemainderSeatCount -= 1;
  }

  return allocations
    .sort((first, second) => first.index - second.index)
    .map(
      ({
        zoneId,
        allocatedSeatCount,
        areaRatio,
        geometrySource,
      }): AreaSeatAllocation => ({
        zoneId,
        allocatedSeatCount,
        areaRatio,
        geometrySource,
      }),
    );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getVirtualSeatCount(zone: SeatZoneForGeneration) {
  return zone.virtualSeats?.length ?? zone._count?.virtualSeats ?? 0;
}

export function getSeatZonePracticeReadiness(zone: SeatZoneForGeneration) {
  const bbox = normalizeVirtualSeatBbox(zone.bbox);
  const polygon = normalizeVirtualSeatPolygon(zone.polygon);
  const hasGeometry = Boolean(bbox || polygon);
  const virtualSeatCount = getVirtualSeatCount(zone);
  const hasSeats = virtualSeatCount > 0;
  const knownSeatCoordinates = zone.virtualSeats;
  const hasValidKnownCoordinates =
    knownSeatCoordinates === undefined
      ? hasSeats
      : knownSeatCoordinates.length > 0 &&
        knownSeatCoordinates.every(
          (seat) =>
            isNormalizedSeatCoordinate(seat.x) &&
            isNormalizedSeatCoordinate(seat.y),
        );
  const config = isJsonObject(zone.virtualSeatConfig)
    ? zone.virtualSeatConfig
    : null;
  const hasSeatMapCoordinateScope = Boolean(
    config?.coordinateScope === "seat-map" ||
    knownSeatCoordinates?.some(
      (seat) =>
        isNormalizedSeatCoordinate(seat.x) &&
        isNormalizedSeatCoordinate(seat.y),
    ),
  );
  const hasDisplayableSeats =
    hasGeometry &&
    hasSeats &&
    hasValidKnownCoordinates &&
    hasSeatMapCoordinateScope;
  const needsRepair = hasGeometry && !hasDisplayableSeats;

  return {
    hasGeometry,
    hasSeats,
    hasDisplayableSeats,
    needsRepair,
    ready: hasGeometry && hasDisplayableSeats,
  };
}

function getGeneratedSeatData(zone: SeatZoneForGeneration) {
  const bbox = normalizeVirtualSeatBbox(zone.bbox);
  const polygon = normalizeVirtualSeatPolygon(zone.polygon);
  const targetSeatCount =
    typeof zone.allocatedSeatCount === "number" && zone.allocatedSeatCount > 0
      ? zone.allocatedSeatCount
      : undefined;
  const { seats, config } = generateVirtualSeats({
    zoneId: zone.id,
    targetSeatCount,
    bbox,
    polygon,
  });
  const coordinateScope = polygon || bbox ? "seat-map" : "none";
  const virtualSeatConfig: Prisma.InputJsonObject = {
    ...config,
    generatedAt: new Date().toISOString(),
    coordinateScope,
    strategy: targetSeatCount ? "area-proportional" : "auto",
    allocatedSeatCount: targetSeatCount ?? null,
  };

  return {
    seats,
    virtualSeatConfig,
  };
}

async function createVirtualSeatsInBatches(
  tx: Prisma.TransactionClient,
  seatsToCreate: Prisma.VirtualSeatCreateManyInput[],
) {
  for (
    let startIndex = 0;
    startIndex < seatsToCreate.length;
    startIndex += VIRTUAL_SEAT_CREATE_BATCH_SIZE
  ) {
    await tx.virtualSeat.createMany({
      data: seatsToCreate.slice(
        startIndex,
        startIndex + VIRTUAL_SEAT_CREATE_BATCH_SIZE,
      ),
    });
  }
}

export async function createVirtualSeatsForZones(
  tx: Prisma.TransactionClient,
  zones: SeatZoneForGeneration[],
  options: CreateVirtualSeatsOptions = {},
) {
  const zonesToGenerate = zones.filter(
    (zone) => options.overwrite || (zone._count?.virtualSeats ?? 0) === 0,
  );

  if (zonesToGenerate.length === 0) {
    return {
      zoneCount: 0,
      seatCount: 0,
    };
  }

  if (options.overwrite) {
    await tx.virtualSeat.deleteMany({
      where: {
        zoneId: {
          in: zonesToGenerate.map((zone) => zone.id),
        },
      },
    });
  }

  const generatedZones = zonesToGenerate.map((zone) => ({
    zone,
    ...getGeneratedSeatData(zone),
  }));
  const seatsToCreate = generatedZones.flatMap(({ seats }) =>
    seats.map((seat) => ({
      zoneId: seat.zoneId,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      status: seat.status,
      x: seat.x ?? null,
      y: seat.y ?? null,
    })),
  );

  if (seatsToCreate.length > 0) {
    await createVirtualSeatsInBatches(tx, seatsToCreate);
  }

  for (const generatedZone of generatedZones) {
    await tx.seatZone.update({
      where: {
        id: generatedZone.zone.id,
      },
      data: {
        allocatedSeatCount: generatedZone.zone.allocatedSeatCount ?? null,
        virtualSeatConfig: generatedZone.virtualSeatConfig,
      },
    });
  }

  return {
    zoneCount: generatedZones.length,
    seatCount: seatsToCreate.length,
  };
}

export async function createAreaProportionalVirtualSeatsForSeatMap(
  tx: Prisma.TransactionClient,
  input: {
    zones: SeatZoneForGeneration[];
    totalSeatCount: number;
  },
) {
  const allocations = allocateSeatCountsByArea(
    input.zones,
    input.totalSeatCount,
  );
  const allocationsByZoneId = new Map(
    allocations.map((allocation) => [allocation.zoneId, allocation]),
  );
  const zonesToGenerate = input.zones.map((zone) => ({
    ...zone,
    allocatedSeatCount:
      allocationsByZoneId.get(zone.id)?.allocatedSeatCount ?? 1,
  }));

  await tx.virtualSeat.deleteMany({
    where: {
      zoneId: {
        in: input.zones.map((zone) => zone.id),
      },
    },
  });

  const generatedZones = zonesToGenerate.map((zone) => {
    const generated = getGeneratedSeatData(zone);
    const allocation = allocationsByZoneId.get(zone.id);
    const virtualSeatConfig: Prisma.InputJsonObject = {
      ...generated.virtualSeatConfig,
      strategy: "area-proportional",
      totalSeatCount: input.totalSeatCount,
      allocatedSeatCount:
        allocation?.allocatedSeatCount ?? zone.allocatedSeatCount,
      areaRatio: allocation?.areaRatio ?? null,
      geometrySource: allocation?.geometrySource ?? null,
    };

    return {
      zone,
      allocation,
      seats: generated.seats,
      virtualSeatConfig,
    };
  });
  const seatsToCreate = generatedZones.flatMap(({ seats }) =>
    seats.map((seat) => ({
      zoneId: seat.zoneId,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      status: seat.status,
      x: seat.x ?? null,
      y: seat.y ?? null,
    })),
  );

  if (seatsToCreate.length > 0) {
    await createVirtualSeatsInBatches(tx, seatsToCreate);
  }

  for (const generatedZone of generatedZones) {
    await tx.seatZone.update({
      where: {
        id: generatedZone.zone.id,
      },
      data: {
        allocatedSeatCount:
          generatedZone.allocation?.allocatedSeatCount ??
          generatedZone.zone.allocatedSeatCount,
        virtualSeatConfig: generatedZone.virtualSeatConfig,
      },
    });
  }

  return {
    zoneCount: generatedZones.length,
    seatCount: seatsToCreate.length,
    allocations,
  };
}

export async function getVirtualSeatReadinessForSeatMap(seatMapId: string) {
  const zones = await prisma.seatZone.findMany({
    where: {
      seatMapId,
    },
    select: {
      id: true,
      bbox: true,
      polygon: true,
      allocatedSeatCount: true,
      virtualSeatConfig: true,
      _count: {
        select: {
          virtualSeats: true,
        },
      },
      virtualSeats: {
        take: 1,
        select: {
          x: true,
          y: true,
        },
      },
    },
  });
  const readinessResults = zones.map((zone) =>
    getSeatZonePracticeReadiness(zone),
  );
  const missingGeometryZoneCount = readinessResults.filter(
    (readiness) => !readiness.hasGeometry,
  ).length;
  const invalidSeatZoneCount = readinessResults.filter(
    (readiness) => readiness.hasGeometry && !readiness.ready,
  ).length;
  const readyZoneCount = readinessResults.filter(
    (readiness) => readiness.ready,
  ).length;
  const ready =
    zones.length > 0 &&
    missingGeometryZoneCount === 0 &&
    readyZoneCount === zones.length;

  return {
    zoneCount: zones.length,
    readyZoneCount,
    repairedZoneCount: 0,
    createdSeatCount: 0,
    missingGeometryZoneCount,
    invalidSeatZoneCount,
    ready,
  } satisfies VirtualSeatEnsureResult;
}
