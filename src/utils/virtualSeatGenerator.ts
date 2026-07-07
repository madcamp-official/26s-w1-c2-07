import type { BoundingBox } from "@/types/seat";
import type { Point } from "@/types/seat";

type GenerateVirtualSeatsOptions = {
  zoneId: string;
  rows?: number;
  seatsPerRow?: number;
  targetSeatCount?: number;
  bbox?: BoundingBox | null;
  polygon?: Point[] | null;
};

export const DEFAULT_VIRTUAL_SEAT_ROWS = 5;
export const DEFAULT_VIRTUAL_SEATS_PER_ROW = 12;
export const MIN_VIRTUAL_SEAT_TOTAL = 18;
export const MAX_VIRTUAL_SEAT_TOTAL = 200;
export const MAX_TARGET_VIRTUAL_SEAT_TOTAL = 30_000;

const GEOMETRY_EPSILON = 0.000001;

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
  source: "polygon" | "bbox" | "default";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getPolygonArea(points: Point[]) {
  const area = points.reduce((sum, point, index) => {
    const nextPoint = points[(index + 1) % points.length];

    return sum + point.x * nextPoint.y - nextPoint.x * point.y;
  }, 0);

  return Math.abs(area) / 2;
}

function getPointBounds(points: Point[]): BoundingBox | null {
  if (points.length === 0) {
    return null;
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
}

function getGeometryBasedConfig(input: {
  bbox?: BoundingBox | null;
  polygon?: Point[] | null;
}) {
  const polygonBounds = input.polygon?.length
    ? getPointBounds(input.polygon)
    : null;
  const polygonArea =
    input.polygon?.length && polygonBounds ? getPolygonArea(input.polygon) : 0;
  const hasPolygonGeometry =
    polygonBounds !== null && polygonArea > GEOMETRY_EPSILON;
  const bounds =
    hasPolygonGeometry && polygonBounds ? polygonBounds : input.bbox;

  if (!bounds) {
    return {
      rows: DEFAULT_VIRTUAL_SEAT_ROWS,
      seatsPerRow: DEFAULT_VIRTUAL_SEATS_PER_ROW,
      source: "default" as const,
    };
  }

  const geometryArea = hasPolygonGeometry
    ? polygonArea
    : bounds.width * bounds.height;
  const targetSeatCount = clamp(
    Math.round(geometryArea * 900),
    MIN_VIRTUAL_SEAT_TOTAL,
    MAX_VIRTUAL_SEAT_TOTAL,
  );
  const aspectRatio = clamp(bounds.width / bounds.height, 0.18, 5.5);
  const seatsPerRow = clamp(
    Math.round(Math.sqrt(targetSeatCount * aspectRatio)),
    3,
    30,
  );
  const rows = clamp(Math.round(targetSeatCount / seatsPerRow), 2, 20);

  return {
    rows,
    seatsPerRow,
    source: hasPolygonGeometry ? ("polygon" as const) : ("bbox" as const),
  };
}

export function normalizeVirtualSeatBbox(value: unknown): BoundingBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x =
    typeof record.x === "number" && Number.isFinite(record.x) ? record.x : null;
  const y =
    typeof record.y === "number" && Number.isFinite(record.y) ? record.y : null;
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

export function normalizeVirtualSeatPolygon(value: unknown): Point[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points: Point[] = [];

  for (const point of value) {
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      return null;
    }

    const record = point as Record<string, unknown>;
    const x =
      typeof record.x === "number" && Number.isFinite(record.x)
        ? record.x
        : null;
    const y =
      typeof record.y === "number" && Number.isFinite(record.y)
        ? record.y
        : null;

    if (x === null || y === null || x < 0 || x > 1 || y < 0 || y > 1) {
      return null;
    }

    points.push({
      x,
      y,
    });
  }

  if (points.length < 3 || !getPointBounds(points)) {
    return null;
  }

  return getPolygonArea(points) > GEOMETRY_EPSILON ? points : null;
}

function normalizeGridSize(input: {
  rows?: number;
  seatsPerRow?: number;
  targetSeatCount?: number;
  bbox?: BoundingBox | null;
  polygon?: Point[] | null;
}) {
  const geometryConfig = getGeometryBasedConfig({
    bbox: input.bbox,
    polygon: input.polygon,
  });

  if (typeof input.targetSeatCount === "number") {
    const targetSeatCount = clamp(
      input.targetSeatCount,
      1,
      MAX_TARGET_VIRTUAL_SEAT_TOTAL,
    );
    const bounds = input.polygon?.length
      ? getPointBounds(input.polygon)
      : input.bbox;
    const aspectRatio = bounds
      ? clamp(bounds.width / bounds.height, 0.18, 5.5)
      : 1;
    const seatsPerRow = Math.max(
      1,
      Math.ceil(Math.sqrt(targetSeatCount * aspectRatio)),
    );
    const rows = Math.max(1, Math.ceil(targetSeatCount / seatsPerRow));

    return {
      rows,
      seatsPerRow,
      targetSeatCount,
      source: geometryConfig.source,
    };
  }

  let rows = input.rows ?? geometryConfig.rows;
  let seatsPerRow = input.seatsPerRow ?? geometryConfig.seatsPerRow;

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
    targetSeatCount: rows * seatsPerRow,
    source: geometryConfig.source,
  };
}

type HorizontalSegment = {
  start: number;
  end: number;
  width: number;
};

function getPolygonHorizontalSegments(points: Point[], y: number) {
  const intersections: number[] = [];

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const currentPoint = points[pointIndex];
    const nextPoint = points[(pointIndex + 1) % points.length];

    if (Math.abs(currentPoint.y - nextPoint.y) <= GEOMETRY_EPSILON) {
      continue;
    }

    const minY = Math.min(currentPoint.y, nextPoint.y);
    const maxY = Math.max(currentPoint.y, nextPoint.y);

    if (y < minY || y >= maxY) {
      continue;
    }

    const progress = (y - currentPoint.y) / (nextPoint.y - currentPoint.y);
    intersections.push(
      currentPoint.x + (nextPoint.x - currentPoint.x) * progress,
    );
  }

  intersections.sort((firstX, secondX) => firstX - secondX);

  const segments: HorizontalSegment[] = [];

  for (
    let intersectionIndex = 0;
    intersectionIndex < intersections.length - 1;
    intersectionIndex += 2
  ) {
    const start = clamp(intersections[intersectionIndex], 0, 1);
    const end = clamp(intersections[intersectionIndex + 1], 0, 1);
    const width = end - start;

    if (width > GEOMETRY_EPSILON) {
      segments.push({
        start,
        end,
        width,
      });
    }
  }

  return segments;
}

function getWidestSegment(segments: HorizontalSegment[]) {
  return segments.reduce<HorizontalSegment | null>(
    (widestSegment, segment) =>
      !widestSegment || segment.width > widestSegment.width
        ? segment
        : widestSegment,
    null,
  );
}

function generatePolygonSeatPoint(input: {
  polygon: Point[];
  rowIndex: number;
  rowCount: number;
  seatIndex: number;
  seatsPerRow: number;
}) {
  const bounds = getPointBounds(input.polygon);

  if (!bounds) {
    return null;
  }

  const y =
    bounds.y + bounds.height * ((input.rowIndex + 1) / (input.rowCount + 1));
  const segment = getWidestSegment(
    getPolygonHorizontalSegments(input.polygon, y),
  );

  if (!segment) {
    return null;
  }

  return {
    x:
      segment.start +
      segment.width * ((input.seatIndex + 1) / (input.seatsPerRow + 1)),
    y,
  };
}

export function generateVirtualSeats({
  zoneId,
  rows,
  seatsPerRow,
  targetSeatCount,
  bbox,
  polygon,
}: GenerateVirtualSeatsOptions) {
  const usablePolygon = normalizeVirtualSeatPolygon(polygon);
  const config = normalizeGridSize({
    rows,
    seatsPerRow,
    targetSeatCount,
    bbox,
    polygon: usablePolygon,
  });
  const polygonBounds = usablePolygon ? getPointBounds(usablePolygon) : null;
  const fallbackBounds = bbox ?? polygonBounds;
  const seats: GeneratedVirtualSeat[] = Array.from(
    {
      length: config.targetSeatCount,
    },
    (_, seatOffset) => {
      const rowIndex = Math.floor(seatOffset / config.seatsPerRow);
      const seatIndex = seatOffset % config.seatsPerRow;
      const rowLabel = `${rowIndex + 1}열`;
      const seatsInRow =
        rowIndex === config.rows - 1
          ? config.targetSeatCount - rowIndex * config.seatsPerRow
          : config.seatsPerRow;
      const polygonPoint = usablePolygon?.length
        ? generatePolygonSeatPoint({
            polygon: usablePolygon,
            rowIndex,
            rowCount: config.rows,
            seatIndex,
            seatsPerRow: seatsInRow,
          })
        : null;

      const x = polygonPoint
        ? polygonPoint.x
        : fallbackBounds
          ? fallbackBounds.x +
            fallbackBounds.width * ((seatIndex + 1) / (seatsInRow + 1))
          : undefined;
      const y = polygonPoint
        ? polygonPoint.y
        : fallbackBounds
          ? fallbackBounds.y +
            fallbackBounds.height * ((rowIndex + 1) / (config.rows + 1))
          : undefined;

      return {
        zoneId,
        rowLabel,
        seatNumber: seatIndex + 1,
        status: "available" as const,
        x,
        y,
      };
    },
  );

  return {
    seats,
    config: {
      rows: config.rows,
      seatsPerRow: config.seatsPerRow,
      source: config.source,
      totalSeats: seats.length,
    } satisfies VirtualSeatGenerationConfig,
  };
}
