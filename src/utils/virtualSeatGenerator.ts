import type { BoundingBox } from "@/types/seat";

type GenerateVirtualSeatsOptions = {
  zoneId: string;
  rows?: number;
  seatsPerRow?: number;
  bbox?: BoundingBox | null;
};

export const DEFAULT_VIRTUAL_SEAT_ROWS = 5;
export const DEFAULT_VIRTUAL_SEATS_PER_ROW = 12;
export const MIN_VIRTUAL_SEAT_TOTAL = 18;
export const MAX_VIRTUAL_SEAT_TOTAL = 200;

type SeatStatus = "available" | "sold" | "disabled";

export type GeneratedVirtualSeat = {
  zoneId: string;
  rowLabel: string;
  seatNumber: number;
  status: SeatStatus;
  x?: number;
  y?: number;
};

export type VirtualSeatGenerationConfig = {
  rows: number;
  seatsPerRow: number;
  totalSeats: number;
  source: "bbox" | "default";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBboxBasedConfig(bbox: BoundingBox | null | undefined) {
  if (!bbox) {
    return {
      rows: DEFAULT_VIRTUAL_SEAT_ROWS,
      seatsPerRow: DEFAULT_VIRTUAL_SEATS_PER_ROW,
      source: "default" as const,
    };
  }

  const rows = clamp(Math.round(bbox.height * 30), 3, 12);
  const seatsPerRow = clamp(Math.round(bbox.width * 40), 6, 24);

  return {
    rows,
    seatsPerRow,
    source: "bbox" as const,
  };
}

export function normalizeVirtualSeatBbox(value: unknown): BoundingBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x = typeof record.x === "number" && Number.isFinite(record.x)
    ? record.x
    : null;
  const y = typeof record.y === "number" && Number.isFinite(record.y)
    ? record.y
    : null;
  const width =
    typeof record.width === "number" && Number.isFinite(record.width)
      ? record.width
      : null;
  const height =
    typeof record.height === "number" && Number.isFinite(record.height)
      ? record.height
      : null;

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return null;
  }

  if (x > 1 || y > 1 || width > 1 || height > 1) {
    return null;
  }

  if (x + width > 1 || y + height > 1) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function normalizeGridSize(input: {
  rows?: number;
  seatsPerRow?: number;
  bbox?: BoundingBox | null;
}) {
  const bboxConfig = getBboxBasedConfig(input.bbox);
  let rows = input.rows ?? bboxConfig.rows;
  let seatsPerRow = input.seatsPerRow ?? bboxConfig.seatsPerRow;

  rows = clamp(rows, 1, 20);
  seatsPerRow = clamp(seatsPerRow, 1, 30);

  if (rows * seatsPerRow > MAX_VIRTUAL_SEAT_TOTAL) {
    seatsPerRow = Math.max(1, Math.floor(MAX_VIRTUAL_SEAT_TOTAL / rows));
  }

  if (rows * seatsPerRow < MIN_VIRTUAL_SEAT_TOTAL) {
    seatsPerRow = Math.min(30, Math.ceil(MIN_VIRTUAL_SEAT_TOTAL / rows));
  }

  return {
    rows,
    seatsPerRow,
    source: bboxConfig.source,
  };
}

export function generateVirtualSeats({
  zoneId,
  rows,
  seatsPerRow,
  bbox,
}: GenerateVirtualSeatsOptions) {
  const config = normalizeGridSize({
    rows,
    seatsPerRow,
    bbox,
  });
  const seats: GeneratedVirtualSeat[] = Array.from({
    length: config.rows,
  }).flatMap((_, rowIndex) => {
    const rowLabel = `${rowIndex + 1}열`;

    return Array.from({ length: config.seatsPerRow }).map((__, seatIndex) => {
      const x = bbox
        ? bbox.x + bbox.width * ((seatIndex + 1) / (config.seatsPerRow + 1))
        : undefined;
      const y = bbox
        ? bbox.y + bbox.height * ((rowIndex + 1) / (config.rows + 1))
        : undefined;

      return {
        zoneId,
        rowLabel,
        seatNumber: seatIndex + 1,
        status: "available" as const,
        x,
        y,
      };
    });
  });

  return {
    seats,
    config: {
      ...config,
      totalSeats: seats.length,
    } satisfies VirtualSeatGenerationConfig,
  };
}
