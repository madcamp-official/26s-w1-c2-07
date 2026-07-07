import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  generateVirtualSeats,
  normalizeVirtualSeatBbox,
  normalizeVirtualSeatPolygon,
} from "@/utils/virtualSeatGenerator";

type SeatZoneForGeneration = {
  id: string;
  bbox: unknown;
  polygon: unknown;
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

function isNormalizedSeatCoordinate(value: number | null | undefined) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
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
  const { seats, config } = generateVirtualSeats({
    zoneId: zone.id,
    bbox,
    polygon,
  });
  const coordinateScope = polygon || bbox ? "seat-map" : "none";
  const virtualSeatConfig: Prisma.InputJsonObject = {
    ...config,
    generatedAt: new Date().toISOString(),
    coordinateScope,
    strategy: "auto",
  };

  return {
    seats,
    virtualSeatConfig,
  };
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
    await tx.virtualSeat.createMany({
      data: seatsToCreate,
    });
  }

  for (const generatedZone of generatedZones) {
    await tx.seatZone.update({
      where: {
        id: generatedZone.zone.id,
      },
      data: {
        virtualSeatConfig: generatedZone.virtualSeatConfig,
      },
    });
  }

  return {
    zoneCount: generatedZones.length,
    seatCount: seatsToCreate.length,
  };
}

export async function ensureVirtualSeatsForSeatMap(seatMapId: string) {
  return prisma.$transaction(async (tx) => {
    const zones = await tx.seatZone.findMany({
      where: {
        seatMapId,
      },
      select: {
        id: true,
        bbox: true,
        polygon: true,
        virtualSeatConfig: true,
        _count: {
          select: {
            virtualSeats: true,
          },
        },
        virtualSeats: {
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
    const zonesToRepair = zones.filter(
      (_zone, index) => readinessResults[index]?.needsRepair,
    );
    const repairResult = await createVirtualSeatsForZones(tx, zonesToRepair, {
      overwrite: true,
    });
    const missingGeometryZoneCount = readinessResults.filter(
      (readiness) => !readiness.hasGeometry,
    ).length;
    const invalidSeatZoneCount = readinessResults.filter(
      (readiness) => readiness.hasGeometry && !readiness.ready,
    ).length;
    const readyZoneCount =
      readinessResults.filter((readiness) => readiness.ready).length +
      repairResult.zoneCount;
    const ready =
      zones.length > 0 &&
      missingGeometryZoneCount === 0 &&
      readyZoneCount === zones.length;

    return {
      zoneCount: zones.length,
      readyZoneCount,
      repairedZoneCount: repairResult.zoneCount,
      createdSeatCount: repairResult.seatCount,
      missingGeometryZoneCount,
      invalidSeatZoneCount,
      ready,
    } satisfies VirtualSeatEnsureResult;
  });
}
