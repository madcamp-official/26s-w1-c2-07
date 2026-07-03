import { z } from "zod";

import type { BoundingBox, Point, SeatZoneAnalysis } from "@/types/seat";

export const MAX_AI_SEAT_ZONES = 80;
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

const UNKNOWN_GRADE = "미확인";
const TICKET_GRADE_PATTERN =
  /^(VVIP|VIP|OP|SR|R|S|A|B|C|D|E|P)(석|등급|구역)?$/i;
const NON_TICKET_GRADE_PATTERN =
  /^(floor|floors?|플로어|ground|그라운드|arena|아레나|standing|스탠딩|console|콘솔|\d+\s*층|\d+f|[가-힣A-Za-z]?\d+\s*구역)$/i;

export const aiPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const aiBboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const aiSeatMapAnalysisSchema = z.object({
  zones: z
    .array(
      z.object({
        name: z.string(),
        grade: z.string(),
        bbox: aiBboxSchema,
        polygon: z.array(aiPointSchema),
        confidence: z.number(),
      }),
    )
    .max(MAX_AI_SEAT_ZONES),
});

const rawPointSchema = z
  .object({
    x: z.unknown().optional(),
    y: z.unknown().optional(),
  })
  .passthrough();

const rawBboxSchema = z
  .object({
    x: z.unknown().optional(),
    y: z.unknown().optional(),
    width: z.unknown().optional(),
    height: z.unknown().optional(),
  })
  .passthrough();

const rawZoneSchema = z
  .object({
    name: z.unknown().optional(),
    grade: z.unknown().optional(),
    bbox: rawBboxSchema.optional(),
    polygon: z.array(rawPointSchema).optional(),
    confidence: z.unknown().optional(),
  })
  .passthrough();

const rawSeatMapAnalysisSchema = z
  .object({
    zones: z.array(rawZoneSchema).optional(),
  })
  .passthrough();

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function normalizeBbox(value: unknown): BoundingBox | null {
  const parsed = rawBboxSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  const rawX = toFiniteNumber(parsed.data.x);
  const rawY = toFiniteNumber(parsed.data.y);
  const rawWidth = toFiniteNumber(parsed.data.width);
  const rawHeight = toFiniteNumber(parsed.data.height);

  if (rawX === null || rawY === null || rawWidth === null || rawHeight === null) {
    return null;
  }

  const x = clamp(rawX);
  const y = clamp(rawY);
  const width = Math.min(clamp(rawWidth), 1 - x);
  const height = Math.min(clamp(rawHeight), 1 - y);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function normalizePoint(point: unknown): Point | null {
  const parsed = rawPointSchema.safeParse(point);

  if (!parsed.success) {
    return null;
  }

  const x = toFiniteNumber(parsed.data.x);
  const y = toFiniteNumber(parsed.data.y);

  if (x === null || y === null) {
    return null;
  }

  return {
    x: clamp(x),
    y: clamp(y),
  };
}

function polygonFromBbox(bbox: BoundingBox): Point[] {
  return [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
    { x: bbox.x, y: bbox.y + bbox.height },
  ];
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeGrade(value: unknown) {
  const grade = normalizeText(value, UNKNOWN_GRADE);
  const compactGrade = grade.replace(/\s+/g, "");

  if (grade === UNKNOWN_GRADE) {
    return UNKNOWN_GRADE;
  }

  if (NON_TICKET_GRADE_PATTERN.test(compactGrade)) {
    return UNKNOWN_GRADE;
  }

  if (TICKET_GRADE_PATTERN.test(compactGrade)) {
    return grade;
  }

  return UNKNOWN_GRADE;
}

function getUniqueName(name: string, usedNames: Map<string, number>) {
  const count = usedNames.get(name) ?? 0;
  usedNames.set(name, count + 1);

  if (count === 0) {
    return name;
  }

  return `${name} ${count + 1}`;
}

export function normalizeSeatMapAnalysis(raw: unknown) {
  const parsed = rawSeatMapAnalysisSchema.safeParse(raw);

  if (!parsed.success || !Array.isArray(parsed.data.zones)) {
    return {
      zones: [] satisfies SeatZoneAnalysis[],
      discardedCount: 0,
    };
  }

  const usedNames = new Map<string, number>();
  let unnamedIndex = 1;
  let discardedCount = 0;
  const zones: SeatZoneAnalysis[] = [];

  for (const zone of parsed.data.zones.slice(0, MAX_AI_SEAT_ZONES)) {
    const bbox = normalizeBbox(zone.bbox);

    if (!bbox) {
      discardedCount += 1;
      continue;
    }

    const polygon = (zone.polygon ?? [])
      .map((point) => normalizePoint(point))
      .filter((point): point is Point => Boolean(point));
    const name = getUniqueName(
      normalizeText(zone.name, `미분류 구역 ${unnamedIndex++}`),
      usedNames,
    );
    const confidence = clamp(toFiniteNumber(zone.confidence) ?? 0.5);

    zones.push({
      name,
      grade: normalizeGrade(zone.grade),
      bbox,
      polygon: polygon.length >= 3 ? polygon : polygonFromBbox(bbox),
      confidence,
    });
  }

  return {
    zones,
    discardedCount,
  };
}

export function isLowConfidence(confidence: number | null | undefined) {
  return typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD;
}
