export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

const POLYGON_POINT_TOLERANCE = 0.003;

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNormalizedCoordinate(value: number) {
  return value >= 0 && value <= 1;
}

export function parseBbox(value: unknown): BoundingBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x = toFiniteNumber(record.x);
  const y = toFiniteNumber(record.y);
  const width = toFiniteNumber(record.width);
  const height = toFiniteNumber(record.height);

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  if (width <= 0 || height <= 0) {
    return null;
  }

  if (
    !isNormalizedCoordinate(x) ||
    !isNormalizedCoordinate(y) ||
    !isNormalizedCoordinate(width) ||
    !isNormalizedCoordinate(height)
  ) {
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

export function parsePolygon(value: unknown): Point[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points = value
    .map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        return null;
      }

      const record = point as Record<string, unknown>;
      const x = toFiniteNumber(record.x);
      const y = toFiniteNumber(record.y);

      if (x === null || y === null) {
        return null;
      }

      if (!isNormalizedCoordinate(x) || !isNormalizedCoordinate(y)) {
        return null;
      }

      return {
        x,
        y,
      };
    })
    .filter((point): point is Point => Boolean(point));

  return points.length >= 3 ? points : null;
}

export function getPolygonPointsAttribute(points: Point[]) {
  return points
    .map((point) => `${(point.x * 100).toFixed(4)},${(point.y * 100).toFixed(4)}`)
    .join(" ");
}

export function getPolygonCenter(points: Point[]) {
  const total = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function getBboxCenter(bbox: BoundingBox) {
  return {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  };
}

export function polygonFromBbox(bbox: BoundingBox): Point[] {
  return [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    { x: bbox.x, y: bbox.y + bbox.height },
  ];
}

export function clampPoint(point: Point): Point {
  return {
    x: Math.min(Math.max(point.x, 0), 1),
    y: Math.min(Math.max(point.y, 0), 1),
  };
}

export function normalizePolygon(points: Point[]) {
  return points.map((point) => clampPoint(point));
}

function arePointsClose(firstPoint: Point, secondPoint: Point) {
  return (
    Math.abs(firstPoint.x - secondPoint.x) <= POLYGON_POINT_TOLERANCE &&
    Math.abs(firstPoint.y - secondPoint.y) <= POLYGON_POINT_TOLERANCE
  );
}

export function isBboxCornerPolygon(points: Point[], bbox: BoundingBox) {
  if (points.length !== 4) {
    return false;
  }

  const bboxCornerPoints = polygonFromBbox(bbox);
  const matchedPointIndexes = new Set<number>();

  return bboxCornerPoints.every((cornerPoint) => {
    const matchedIndex = points.findIndex(
      (point, index) =>
        !matchedPointIndexes.has(index) && arePointsClose(point, cornerPoint),
    );

    if (matchedIndex < 0) {
      return false;
    }

    matchedPointIndexes.add(matchedIndex);
    return true;
  });
}
