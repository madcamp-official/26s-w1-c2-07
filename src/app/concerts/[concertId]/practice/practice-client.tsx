"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
  type WheelEvent,
} from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Ticket,
  TimerReset,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACTIVE_TICKET_TEMPLATE_TYPES,
  PRACTICE_DIFFICULTIES,
  PRACTICE_DIFFICULTY_LABELS,
  PRACTICE_STEP_LABELS,
  PRACTICE_TEMPLATE_LABELS,
  PRACTICE_TEMPLATE_STEPS,
} from "@/lib/practice";
import {
  getInitialQueueCount,
  getNextQueueCount,
  getNextSoldOutSeatIds,
  getSelectableSeatCount,
  QUEUE_POLICY,
  sampleSeatIds,
  SEAT_SELL_OUT_POLICY,
} from "@/lib/practice-simulation";
import {
  getBboxCenter,
  getPolygonCenter,
  getPolygonPointsAttribute,
  isBboxCornerPolygon,
  parseBbox,
  parsePolygon,
  type BoundingBox,
  type Point,
} from "@/lib/seat-zone-geometry";
import type {
  PracticeDifficulty,
  PracticeStep,
  TicketTemplateType,
} from "@/types/practice";
import { generatePracticeCaptcha } from "@/utils/captchaGenerator";
import { formatPriceRange } from "@/utils/format";

type ConcertSummary = {
  id: string;
  title: string;
  artist: string;
  venueName: string;
  region: string;
  priceMin: number;
  priceMax: number;
};

type ScheduleSummary = {
  id: string;
  performanceDate: string;
  roundName: string;
  startTime: string;
};

type VirtualSeatSummary = {
  id: string;
  zoneId: string;
  rowLabel: string;
  seatNumber: number;
  status: "available" | "sold" | "disabled";
  x: number | null;
  y: number | null;
};

type PositionedSeatSummary = VirtualSeatSummary & {
  zoneName: string;
  zoneGrade: string;
  x: number;
  y: number;
  sizePercent: number;
};

type SeatZoneSummary = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
  bbox: unknown;
  polygon: unknown;
  virtualSeats: VirtualSeatSummary[];
};

type SeatZoneWithGeometry = Omit<SeatZoneSummary, "bbox" | "polygon"> & {
  bbox: BoundingBox | null;
  polygon: Point[] | null;
  labelPoint: Point | null;
};

type SeatRowSummary = {
  rowLabel: string;
  seats: VirtualSeatSummary[];
};

type HorizontalSegment = {
  start: number;
  end: number;
  width: number;
};

type PolygonSeatRowLayout = SeatRowSummary & {
  y: number;
  segment: HorizontalSegment;
};

type PracticeClientProps = {
  concert: ConcertSummary;
  schedules: ScheduleSummary[];
  seatMap: {
    id: string;
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
  };
  zones: SeatZoneSummary[];
};

type PracticePhase = "setup" | "countdown" | "running" | "result";

type PracticeSessionResponse = {
  data?: {
    practiceSession?: {
      id: string;
      status: "started" | "success" | "failed";
      elapsedMs: number;
      startDelayMs?: number | null;
      failReason?: string | null;
    };
  };
  error?: {
    message?: string;
  };
};

async function readPracticeSessionResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as PracticeSessionResponse;
  }

  try {
    return JSON.parse(text) as PracticeSessionResponse;
  } catch {
    return {
      error: {
        message: response.ok
          ? "티켓팅 연습 응답을 해석하지 못했습니다."
          : "티켓팅 연습 요청 처리 중 서버 오류가 발생했습니다.",
      },
    } satisfies PracticeSessionResponse;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTimer(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const seconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

function sortSeats(seats: VirtualSeatSummary[]) {
  return [...seats].sort((a, b) => {
    const rowDiff =
      Number.parseInt(a.rowLabel, 10) - Number.parseInt(b.rowLabel, 10);

    if (Number.isFinite(rowDiff) && rowDiff !== 0) {
      return rowDiff;
    }

    return a.seatNumber - b.seatNumber;
  });
}

function getNextStep(steps: PracticeStep[], currentStepIndex: number) {
  return steps[currentStepIndex + 1] ?? "RESULT";
}

function getSoldOutToastMessage(difficulty: PracticeDifficulty) {
  if (difficulty === "hard") {
    return "이미 선택된 좌석입니다. 경쟁이 매우 치열합니다.";
  }

  if (difficulty === "normal") {
    return "이미 선택된 좌석입니다. 다른 좌석을 선택해주세요.";
  }

  return "이미 선택된 좌석입니다.";
}

function isNormalizedCoordinate(
  value: number | null | undefined,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

const DIRECT_SEAT_SIZE_RATIO = 0.84;
const DIRECT_SEAT_BOUNDARY_RATIO = 0.9;
const DIRECT_SEAT_MAX_SIZE_PERCENT = 2.2;
const DIRECT_SEAT_FALLBACK_SIZE_PERCENT = 1.8;
const DIRECT_SEAT_MAP_DEFAULT_ZOOM = 1;
const DIRECT_SEAT_MAP_MIN_ZOOM = 1;
const DIRECT_SEAT_MAP_MAX_ZOOM = 3;
const DIRECT_SEAT_MAP_ZOOM_STEP = 0.12;
const GEOMETRY_EPSILON = 0.000001;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSeatMapHeightRatio(seatMap: PracticeClientProps["seatMap"]) {
  if (
    typeof seatMap.imageWidth === "number" &&
    Number.isFinite(seatMap.imageWidth) &&
    seatMap.imageWidth > 0 &&
    typeof seatMap.imageHeight === "number" &&
    Number.isFinite(seatMap.imageHeight) &&
    seatMap.imageHeight > 0
  ) {
    return seatMap.imageHeight / seatMap.imageWidth;
  }

  return 1;
}

function getCoordinateBounds(seats: VirtualSeatSummary[]) {
  const coordinates = seats
    .filter(
      (seat): seat is VirtualSeatSummary & { x: number; y: number } =>
        isNormalizedCoordinate(seat.x) && isNormalizedCoordinate(seat.y),
    )
    .map((seat) => ({
      x: seat.x,
      y: seat.y,
    }));

  if (coordinates.length === 0) {
    return null;
  }

  const minX = Math.min(...coordinates.map((coordinate) => coordinate.x));
  const maxX = Math.max(...coordinates.map((coordinate) => coordinate.x));
  const minY = Math.min(...coordinates.map((coordinate) => coordinate.y));
  const maxY = Math.max(...coordinates.map((coordinate) => coordinate.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  } satisfies BoundingBox;
}

function getPointBounds(points: Point[]) {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  } satisfies BoundingBox;
}

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
    const start = Math.max(0, intersections[intersectionIndex]);
    const end = Math.min(1, intersections[intersectionIndex + 1]);
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

function getPolygonRowLayout(input: {
  polygon: Point[];
  row: SeatRowSummary;
  rowIndex: number;
  rowCount: number;
}) {
  const bounds = getPointBounds(input.polygon);

  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const rowGap = bounds.height / (input.rowCount + 1);
  const preferredY = bounds.y + rowGap * (input.rowIndex + 1);
  const candidateOffsets = [0, -0.2, 0.2, -0.4, 0.4, -0.6, 0.6];

  for (const candidateOffset of candidateOffsets) {
    const y = preferredY + rowGap * candidateOffset;

    if (y <= bounds.y || y >= bounds.y + bounds.height) {
      continue;
    }

    const segment = getWidestSegment(
      getPolygonHorizontalSegments(input.polygon, y),
    );

    if (segment) {
      return {
        ...input.row,
        y,
        segment,
      } satisfies PolygonSeatRowLayout;
    }
  }

  return null;
}

function getPolygonSeatPoint(input: {
  layout: PolygonSeatRowLayout;
  seatIndex: number;
}) {
  return {
    x:
      input.layout.segment.start +
      input.layout.segment.width *
        ((input.seatIndex + 1) / (input.layout.seats.length + 1)),
    y: input.layout.y,
  } satisfies Point;
}

function getDisplayDistanceToSegment(input: {
  point: Point;
  segmentStart: Point;
  segmentEnd: Point;
  seatMapHeightRatio: number;
}) {
  const pointX = input.point.x;
  const pointY = input.point.y * input.seatMapHeightRatio;
  const startX = input.segmentStart.x;
  const startY = input.segmentStart.y * input.seatMapHeightRatio;
  const endX = input.segmentEnd.x;
  const endY = input.segmentEnd.y * input.seatMapHeightRatio;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared <= GEOMETRY_EPSILON) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const progress = Math.min(
    1,
    Math.max(
      0,
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) /
        segmentLengthSquared,
    ),
  );
  const projectionX = startX + segmentX * progress;
  const projectionY = startY + segmentY * progress;

  return Math.hypot(pointX - projectionX, pointY - projectionY);
}

function getDistanceToPolygonBoundary(input: {
  point: Point;
  polygon: Point[];
  seatMapHeightRatio: number;
}) {
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let pointIndex = 0; pointIndex < input.polygon.length; pointIndex += 1) {
    const distance = getDisplayDistanceToSegment({
      point: input.point,
      segmentStart: input.polygon[pointIndex],
      segmentEnd: input.polygon[(pointIndex + 1) % input.polygon.length],
      seatMapHeightRatio: input.seatMapHeightRatio,
    });

    nearestDistance = Math.min(nearestDistance, distance);
  }

  return nearestDistance;
}

function isPointInsidePolygon(point: Point, polygon: Point[]) {
  let isInside = false;

  for (
    let pointIndex = 0, previousPointIndex = polygon.length - 1;
    pointIndex < polygon.length;
    previousPointIndex = pointIndex, pointIndex += 1
  ) {
    const currentPoint = polygon[pointIndex];
    const previousPoint = polygon[previousPointIndex];
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function clampDirectSeatSizePercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return DIRECT_SEAT_FALLBACK_SIZE_PERCENT;
  }

  return Math.min(value, DIRECT_SEAT_MAX_SIZE_PERCENT);
}

function getDirectSeatSizePercent(input: {
  bbox: BoundingBox | null;
  coordinateBounds: BoundingBox | null;
  polygonRowLayouts: PolygonSeatRowLayout[] | null;
  rowCount: number;
  maxSeatsPerRow: number;
  seatMapHeightRatio: number;
}) {
  if (input.polygonRowLayouts?.length) {
    const columnGaps = input.polygonRowLayouts
      .filter((layout) => layout.seats.length > 1)
      .map((layout) => layout.segment.width / (layout.seats.length + 1));
    const rowYPositions = input.polygonRowLayouts
      .map((layout) => layout.y)
      .sort((firstY, secondY) => firstY - secondY);
    const rowGaps = rowYPositions
      .slice(1)
      .map(
        (rowY, rowIndex) =>
          (rowY - rowYPositions[rowIndex]) * input.seatMapHeightRatio,
      )
      .filter((rowGap) => rowGap > GEOMETRY_EPSILON);
    const nearestGap = Math.min(...columnGaps, ...rowGaps);

    if (Number.isFinite(nearestGap)) {
      return clampDirectSeatSizePercent(
        nearestGap * 100 * DIRECT_SEAT_SIZE_RATIO,
      );
    }
  }

  const bounds = input.bbox ?? input.coordinateBounds;

  if (!bounds) {
    return DIRECT_SEAT_FALLBACK_SIZE_PERCENT;
  }

  const isBboxBased = Boolean(input.bbox);
  const columnDivider = isBboxBased
    ? input.maxSeatsPerRow + 1
    : input.maxSeatsPerRow - 1;
  const rowDivider = isBboxBased ? input.rowCount + 1 : input.rowCount - 1;
  const columnGap =
    input.maxSeatsPerRow > 1 && columnDivider > 0
      ? bounds.width / columnDivider
      : Number.POSITIVE_INFINITY;
  const rowGap =
    input.rowCount > 1 && rowDivider > 0
      ? (bounds.height * input.seatMapHeightRatio) / rowDivider
      : Number.POSITIVE_INFINITY;
  const nearestGap = Math.min(columnGap, rowGap);

  if (Number.isFinite(nearestGap)) {
    return clampDirectSeatSizePercent(
      nearestGap * 100 * DIRECT_SEAT_SIZE_RATIO,
    );
  }

  const singleSeatGap =
    Math.min(bounds.width, bounds.height * input.seatMapHeightRatio) * 100 * 0.5;

  return clampDirectSeatSizePercent(singleSeatGap);
}

function getPolygonBoundedSeatSizePercent(input: {
  point: Point;
  polygon: Point[];
  seatMapHeightRatio: number;
  seatSizePercent: number;
}) {
  const boundaryDistance = getDistanceToPolygonBoundary(input);

  if (!Number.isFinite(boundaryDistance) || boundaryDistance <= 0) {
    return 0;
  }

  return Math.min(
    input.seatSizePercent,
    boundaryDistance * 2 * 100 * DIRECT_SEAT_BOUNDARY_RATIO,
  );
}

export function PracticeClient({
  concert,
  schedules,
  seatMap,
  zones,
}: PracticeClientProps) {
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const [templateType, setTemplateType] =
    useState<TicketTemplateType>("nol_old");
  const [difficulty, setDifficulty] =
    useState<PracticeDifficulty>("normal");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [captchaText, setCaptchaText] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [initialQueueCount, setInitialQueueCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    schedules[0]?.id ?? null,
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    null,
  );
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [seatSelectView, setSeatSelectView] = useState<"zone" | "seat">("zone");
  const [selectableSeatIds, setSelectableSeatIds] = useState<string[]>([]);
  const [soldOutSeatIds, setSoldOutSeatIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [isStartReady, setIsStartReady] = useState(false);
  const [startReadyAt, setStartReadyAt] = useState<number | null>(null);
  const [startDelayMs, setStartDelayMs] = useState<number | null>(null);
  const [isStartRequestSent, setIsStartRequestSent] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [seatMapZoom, setSeatMapZoom] = useState(DIRECT_SEAT_MAP_DEFAULT_ZOOM);
  const [loadedSeatMapMetrics, setLoadedSeatMapMetrics] = useState<{
    seatMapId: string;
    heightRatio: number;
  } | null>(null);
  const [result, setResult] = useState<{
    status: "success" | "failed";
    elapsedMs: number;
    startDelayMs: number;
    failReason?: string | null;
  } | null>(null);
  const completingRef = useRef(false);
  const startClickTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const directSeatMapScrollRef = useRef<HTMLDivElement | null>(null);

  const steps = PRACTICE_TEMPLATE_STEPS[templateType];
  const currentStep = phase === "running" ? steps[currentStepIndex] : null;
  const isSplitSeatSelect = templateType === "nol_old";
  const isDirectSeatMapSelect = templateType === "nol_new";
  const seatMapHeightRatio =
    loadedSeatMapMetrics?.seatMapId === seatMap.id
      ? loadedSeatMapMetrics.heightRatio
      : getSeatMapHeightRatio(seatMap);
  const zonesWithGeometry = useMemo<SeatZoneWithGeometry[]>(
    () =>
      zones.map((zone) => {
        const bbox = parseBbox(zone.bbox);
        const parsedPolygon = parsePolygon(zone.polygon);
        const polygon =
          parsedPolygon && (!bbox || !isBboxCornerPolygon(parsedPolygon, bbox))
            ? parsedPolygon
            : null;

        return {
          ...zone,
          bbox,
          polygon,
          labelPoint: polygon
            ? getPolygonCenter(polygon)
            : bbox
              ? getBboxCenter(bbox)
              : null,
        };
      }),
    [zones],
  );
  const zoneOverlays = useMemo(
    () => zonesWithGeometry.filter((zone) => zone.polygon || zone.bbox),
    [zonesWithGeometry],
  );
  const selectedSchedule =
    schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null;
  const selectedZone =
    zonesWithGeometry.find((zone) => zone.id === selectedZoneId) ?? null;
  const selectedSeat =
    selectedZone?.virtualSeats.find((seat) => seat.id === selectedSeatId) ??
    null;
  const allAvailableSeatIds = useMemo(
    () =>
      zones.flatMap((zone) =>
        zone.virtualSeats
          .filter((seat) => seat.status === "available")
          .map((seat) => seat.id),
      ),
    [zones],
  );
  const remainingSelectableSeatIds = useMemo(
    () => selectableSeatIds.filter((seatId) => !soldOutSeatIds.includes(seatId)),
    [selectableSeatIds, soldOutSeatIds],
  );
  const remainingSelectableSeatIdSet = useMemo(
    () => new Set(remainingSelectableSeatIds),
    [remainingSelectableSeatIds],
  );
  const soldOutSeatIdSet = useMemo(
    () => new Set(soldOutSeatIds),
    [soldOutSeatIds],
  );
  const groupedSeats = useMemo(() => {
    if (!selectedZone) {
      return [];
    }

    const rowMap = new Map<string, VirtualSeatSummary[]>();

    for (const seat of sortSeats(selectedZone.virtualSeats)) {
      const rowSeats = rowMap.get(seat.rowLabel) ?? [];
      rowSeats.push(seat);
      rowMap.set(seat.rowLabel, rowSeats);
    }

    return Array.from(rowMap.entries()).map(([rowLabel, seats]) => ({
      rowLabel,
      seats,
    }));
  }, [selectedZone]);
  const maxSeatsPerRow = groupedSeats.reduce(
    (maxSeatCount, row) => Math.max(maxSeatCount, row.seats.length),
    0,
  );
  const compactSeatSizePx = Math.max(
    22,
    Math.min(36, Math.floor(700 / Math.max(1, maxSeatsPerRow))),
  );
  const directSeatMapSeats = useMemo(
    () =>
      zonesWithGeometry.flatMap((zone) => {
        const bbox = zone.bbox;
        const polygon = zone.polygon;
        const coordinateBounds = getCoordinateBounds(zone.virtualSeats);
        const rowMap = new Map<string, VirtualSeatSummary[]>();

        for (const seat of sortSeats(zone.virtualSeats)) {
          const rowSeats = rowMap.get(seat.rowLabel) ?? [];
          rowSeats.push(seat);
          rowMap.set(seat.rowLabel, rowSeats);
        }

        const rows = Array.from(rowMap.entries()).map(([rowLabel, seats]) => ({
          rowLabel,
          seats,
        }));
        const maxDirectSeatsPerRow = rows.reduce(
          (maxSeatCount, row) => Math.max(maxSeatCount, row.seats.length),
          0,
        );
        const polygonRowLayouts = polygon
          ? rows
              .map((row, rowIndex) =>
                getPolygonRowLayout({
                  polygon,
                  row,
                  rowIndex,
                  rowCount: rows.length,
                }),
              )
              .filter((layout): layout is PolygonSeatRowLayout =>
                Boolean(layout),
              )
          : null;
        const polygonRowLayoutMap = new Map(
          polygonRowLayouts?.map((layout) => [layout.rowLabel, layout]) ?? [],
        );
        const seatSizePercent = getDirectSeatSizePercent({
          bbox,
          coordinateBounds,
          polygonRowLayouts,
          rowCount: rows.length,
          maxSeatsPerRow: maxDirectSeatsPerRow,
          seatMapHeightRatio,
        });

        return rows.flatMap((row, rowIndex) =>
          row.seats.flatMap((seat, seatIndex) => {
            const polygonRowLayout = polygonRowLayoutMap.get(row.rowLabel);
            const polygonPoint = polygonRowLayout
              ? getPolygonSeatPoint({
                  layout: polygonRowLayout,
                  seatIndex,
                })
              : null;
            const fallbackX = bbox
              ? bbox.x + bbox.width * ((seatIndex + 1) / (row.seats.length + 1))
              : null;
            const fallbackY = bbox
              ? bbox.y + bbox.height * ((rowIndex + 1) / (rows.length + 1))
              : null;
            const x = polygon
              ? polygonPoint?.x
              : isNormalizedCoordinate(seat.x)
                ? seat.x
                : fallbackX;
            const y = polygon
              ? polygonPoint?.y
              : isNormalizedCoordinate(seat.y)
                ? seat.y
                : fallbackY;

            if (!isNormalizedCoordinate(x) || !isNormalizedCoordinate(y)) {
              return [];
            }

            const boundedSeatSizePercent =
              polygon && isPointInsidePolygon({ x, y }, polygon)
                ? getPolygonBoundedSeatSizePercent({
                    point: {
                      x,
                      y,
                    },
                    polygon,
                    seatMapHeightRatio,
                    seatSizePercent,
                  })
                : seatSizePercent;

            if (boundedSeatSizePercent <= 0) {
              return [];
            }

            return [
              {
                ...seat,
                zoneId: zone.id,
                zoneName: zone.name,
                zoneGrade: zone.grade,
                x,
                y,
                sizePercent: boundedSeatSizePercent,
              } satisfies PositionedSeatSummary,
            ];
          }),
        );
      }),
    [seatMapHeightRatio, zonesWithGeometry],
  );
  const directSeatMapAvailableSeatIds = useMemo(
    () =>
      directSeatMapSeats
        .filter((seat) => seat.status === "available")
        .map((seat) => seat.id),
    [directSeatMapSeats],
  );
  const queueProgressPercent =
    initialQueueCount > 0
      ? Math.min(
          100,
          Math.max(0, ((initialQueueCount - queueCount) / initialQueueCount) * 100),
        )
      : 0;
  const directSeatMapWidthPercent = seatMapZoom * 100;
  const directSeatMaxSizePx = seatMapZoom * 18;

  const completePractice = useCallback(
    async (input: {
      status: "success" | "failed";
      failReason?: string | null;
      selectedZoneId?: string | null;
      selectedSeatId?: string | null;
    }) => {
      if (!sessionId || !startedAt || completingRef.current) {
        return;
      }

      completingRef.current = true;
      setIsCompleting(true);
      setMessage("");

      const finalElapsedMs = Date.now() - startedAt;
      const finalSelectedZoneId = input.selectedZoneId ?? selectedZoneId;
      const finalSelectedSeatId = input.selectedSeatId ?? selectedSeatId;

      try {
        const response = await fetch(
          `/api/practice-sessions/${sessionId}/complete`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: input.status,
              scheduleId: selectedScheduleId ?? undefined,
              selectedZoneId:
                input.status === "success" ? finalSelectedZoneId : null,
              selectedSeatId:
                input.status === "success" ? finalSelectedSeatId : null,
              elapsedMs: finalElapsedMs,
              failReason: input.failReason ?? null,
            }),
          },
        );
        const payload = await readPracticeSessionResponse(response);

        if (!response.ok) {
          throw new Error(
            payload.error?.message ?? "티켓팅 연습 결과 저장에 실패했습니다.",
          );
        }

        setResult({
          status: input.status,
          elapsedMs: finalElapsedMs,
          startDelayMs: startDelayMs ?? 0,
          failReason: input.failReason,
        });
        setCurrentStepIndex(steps.length - 1);
        setPhase("result");
      } catch (error) {
        completingRef.current = false;
        setMessage(
          error instanceof Error
            ? error.message
            : "티켓팅 연습 결과 저장에 실패했습니다.",
        );
      } finally {
        setIsCompleting(false);
      }
    },
    [
      selectedScheduleId,
      selectedSeatId,
      selectedZoneId,
      sessionId,
      startDelayMs,
      startedAt,
      steps.length,
    ],
  );

  function clearToastTimer() {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function clearStartClickTimer() {
    if (startClickTimerRef.current !== null) {
      window.clearTimeout(startClickTimerRef.current);
      startClickTimerRef.current = null;
    }
  }

  function showToast(nextToastMessage: string) {
    clearToastTimer();
    setToastMessage(nextToastMessage);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 2200);
  }

  function initializeQueueStep() {
    const nextQueueCount = getInitialQueueCount(difficulty);

    setInitialQueueCount(nextQueueCount);
    setQueueCount(nextQueueCount);
  }

  function initializeSeatSelectStep() {
    const availableSeatIds =
      isDirectSeatMapSelect && directSeatMapAvailableSeatIds.length > 0
        ? directSeatMapAvailableSeatIds
        : allAvailableSeatIds;
    const candidateCount = getSelectableSeatCount({
      difficulty,
      totalAvailableSeats: availableSeatIds.length,
    });
    const candidateSeatIds = sampleSeatIds({
      seatIds: availableSeatIds,
      count: candidateCount,
    });

    setSelectableSeatIds(candidateSeatIds);
    setSoldOutSeatIds([]);
    setSelectedSeatId(null);
    setSelectedZoneId(null);
    setSeatSelectView("zone");
  }

  function prepareStep(step: PracticeStep) {
    if (step === "WAITING_QUEUE") {
      initializeQueueStep();
      return;
    }

    if (step === "SEAT_SELECT") {
      initializeSeatSelectStep();
    }
  }

  useEffect(() => {
    if (phase !== "running" || !startedAt || completingRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "running" || currentStep !== "WAITING_QUEUE") {
      return;
    }

    const interval = window.setInterval(() => {
      setQueueCount((currentCount) =>
        getNextQueueCount({
          difficulty,
          currentCount,
        }),
      );
    }, QUEUE_POLICY[difficulty].intervalMs);

    return () => window.clearInterval(interval);
  }, [currentStep, difficulty, phase]);

  useEffect(() => {
    if (
      phase !== "running" ||
      currentStep !== "WAITING_QUEUE" ||
      queueCount !== 0
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      advanceStep();
    }, 0);

    return () => window.clearTimeout(timeout);
    // advanceStep intentionally reads the latest render state for this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, phase, queueCount]);

  useEffect(() => {
    if (phase !== "running" || currentStep !== "SEAT_SELECT") {
      return;
    }

    const interval = window.setInterval(() => {
      setSoldOutSeatIds((currentSoldOutSeatIds) => {
        const currentSoldOutSeatIdSet = new Set(currentSoldOutSeatIds);
        const remainingSeatIds = selectableSeatIds.filter(
          (seatId) => !currentSoldOutSeatIdSet.has(seatId),
        );

        if (remainingSeatIds.length === 0) {
          return currentSoldOutSeatIds;
        }

        const nextSoldOutSeatIds = getNextSoldOutSeatIds({
          difficulty,
          remainingSeatIds,
        });

        return [...currentSoldOutSeatIds, ...nextSoldOutSeatIds];
      });
    }, SEAT_SELL_OUT_POLICY[difficulty].intervalMs);

    return () => window.clearInterval(interval);
  }, [currentStep, difficulty, phase, selectableSeatIds]);

  useEffect(() => {
    if (
      phase !== "running" ||
      currentStep !== "SEAT_SELECT" ||
      selectableSeatIds.length === 0 ||
      remainingSelectableSeatIds.length > 0 ||
      completingRef.current
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void completePractice({
        status: "failed",
        failReason: "선택 가능한 좌석이 모두 사라졌습니다.",
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    completePractice,
    currentStep,
    phase,
    remainingSelectableSeatIds.length,
    selectableSeatIds.length,
  ]);

  useEffect(() => {
    if (phase !== "countdown" || startCountdown === null) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStartCountdown((currentCountdown) => {
        if (currentCountdown === null) {
          return null;
        }

        if (currentCountdown <= 1) {
          setIsStartReady(true);
          setStartReadyAt(Date.now());
          return null;
        }

        return currentCountdown - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [phase, startCountdown]);

  useEffect(() => {
    return () => {
      clearStartClickTimer();
      clearToastTimer();
    };
  }, []);

  function resetStartGate() {
    clearStartClickTimer();
    setStartCountdown(null);
    setIsStartReady(false);
    setStartReadyAt(null);
    setStartDelayMs(null);
    setIsStarting(false);
    setIsStartRequestSent(false);
  }

  function handleStartCountdown() {
    setMessage("");
    setToastMessage("");
    setIsStartReady(false);
    setStartReadyAt(null);
    setStartDelayMs(null);
    setIsStartRequestSent(false);
    setStartCountdown(5);
    setPhase("countdown");
  }

  function handleSeatMapImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { naturalHeight, naturalWidth } = event.currentTarget;

    if (naturalWidth <= 0 || naturalHeight <= 0) {
      return;
    }

    const nextHeightRatio = naturalHeight / naturalWidth;

    setLoadedSeatMapMetrics((currentMetrics) =>
      currentMetrics?.seatMapId === seatMap.id &&
      Math.abs(currentMetrics.heightRatio - nextHeightRatio) <= 0.001
        ? currentMetrics
        : {
            seatMapId: seatMap.id,
            heightRatio: nextHeightRatio,
          },
    );
  }

  function handleSeatMapWheel(event: WheelEvent<HTMLDivElement>) {
    if (directSeatMapSeats.length === 0) {
      return;
    }

    event.preventDefault();

    const container = directSeatMapScrollRef.current;

    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pointerX = event.clientX - containerRect.left;
    const pointerY = event.clientY - containerRect.top;
    const zoomDirection = event.deltaY < 0 ? 1 : -1;
    const nextZoom = clampNumber(
      seatMapZoom + zoomDirection * DIRECT_SEAT_MAP_ZOOM_STEP,
      DIRECT_SEAT_MAP_MIN_ZOOM,
      DIRECT_SEAT_MAP_MAX_ZOOM,
    );

    if (nextZoom === seatMapZoom) {
      return;
    }

    const zoomRatio = nextZoom / seatMapZoom;
    const nextScrollLeft = (container.scrollLeft + pointerX) * zoomRatio - pointerX;
    const nextScrollTop = (container.scrollTop + pointerY) * zoomRatio - pointerY;

    setSeatMapZoom(nextZoom);
    window.requestAnimationFrame(() => {
      container.scrollLeft = nextScrollLeft;
      container.scrollTop = nextScrollTop;
    });
  }

  async function startPractice(finalStartDelayMs: number) {
    if (!isStartReady) {
      handleStartCountdown();
      return;
    }

    setIsStarting(true);
    setIsStartRequestSent(true);
    setMessage("");
    setToastMessage("");
    completingRef.current = false;
    clearToastTimer();

    try {
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concertId: concert.id,
          templateType,
          difficulty,
          startDelayMs: finalStartDelayMs,
        }),
      });
      const payload = await readPracticeSessionResponse(response);

      if (!response.ok || !payload.data?.practiceSession?.id) {
        throw new Error(
          payload.error?.message ?? "티켓팅 연습을 시작하지 못했습니다.",
        );
      }

      setSessionId(payload.data.practiceSession.id);
      setCurrentStepIndex(0);
      setStartedAt(Date.now());
      setElapsedMs(0);
      setStartDelayMs(payload.data.practiceSession.startDelayMs ?? finalStartDelayMs);
      setCaptchaText(generatePracticeCaptcha());
      setCaptchaInput("");
      setSelectedSeatId(null);
      setSelectableSeatIds([]);
      setSoldOutSeatIds([]);
      setResult(null);
      prepareStep(PRACTICE_TEMPLATE_STEPS[templateType][0]);
      setPhase("running");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "티켓팅 연습을 시작하지 못했습니다.",
      );
    } finally {
      setIsStarting(false);
      setIsStartRequestSent(false);
    }
  }

  function handleStart() {
    if (!isStartReady || !startReadyAt) {
      handleStartCountdown();
      return;
    }

    if (isStartRequestSent) {
      return;
    }

    const nextStartDelayMs = Date.now() - startReadyAt;

    setStartDelayMs(nextStartDelayMs);
    setIsStarting(true);
    setMessage("");
    clearStartClickTimer();
    startClickTimerRef.current = window.setTimeout(() => {
      startClickTimerRef.current = null;
      void startPractice(nextStartDelayMs);
    }, 180);
  }

  function advanceStep() {
    const nextStep = getNextStep(steps, currentStepIndex);

    if (nextStep === "RESULT") {
      void completePractice({
        status: "success",
      });
      return;
    }

    prepareStep(nextStep);
    setCurrentStepIndex((value) => value + 1);
    setMessage("");
  }

  function handleCaptchaSubmit() {
    if (captchaInput.trim().toUpperCase() !== captchaText) {
      setMessage("보안문자가 일치하지 않습니다.");
      return;
    }

    advanceStep();
  }

  function handleScheduleConfirm() {
    if (!selectedScheduleId) {
      setMessage("회차를 선택해주세요.");
      return;
    }

    advanceStep();
  }

  function handleSeatClick(seat: VirtualSeatSummary) {
    if (seat.status !== "available") {
      return;
    }

    if (!remainingSelectableSeatIdSet.has(seat.id)) {
      showToast(getSoldOutToastMessage(difficulty));
      return;
    }

    setSelectedSeatId(seat.id);
    setSelectedZoneId(seat.zoneId);
    setMessage("좌석을 선택했습니다. 연습을 완료합니다.");
    void completePractice({
      status: "success",
      selectedZoneId: seat.zoneId,
      selectedSeatId: seat.id,
    });
  }

  function handleZoneSelect(zone: { id: string; name: string }) {
    setSelectedZoneId(zone.id);
    setSelectedSeatId(null);
    setMessage(`${zone.name} 구역을 선택했습니다. 남아있는 좌석을 선택하세요.`);

    if (isSplitSeatSelect) {
      setSeatSelectView("seat");
    }
  }

  function handleRestart() {
    clearToastTimer();
    setPhase("setup");
    resetStartGate();
    setSessionId(null);
    setCurrentStepIndex(0);
    setStartedAt(null);
    setElapsedMs(0);
    setCaptchaText("");
    setCaptchaInput("");
    setInitialQueueCount(0);
    setQueueCount(0);
    setSelectedSeatId(null);
    setSeatSelectView("zone");
    setSelectableSeatIds([]);
    setSoldOutSeatIds([]);
    setMessage("");
    setToastMessage("");
    setResult(null);
    completingRef.current = false;
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
      {toastMessage ? (
        <div
          className="fixed left-1/2 top-6 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-md border bg-background px-4 py-3 text-sm font-medium shadow-lg"
          role="alert"
        >
          {toastMessage}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {concert.artist} · {concert.region} · {concert.venueName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">티켓팅 연습</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            실제 예매가 아닌 연습용 흐름입니다. 좌석은 AI 분석 구역을 바탕으로
            생성한 VirtualSeat입니다.
          </p>
        </div>

        {phase === "setup" ? (
          <div className="mt-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold">사이트 방식 선택</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ACTIVE_TICKET_TEMPLATE_TYPES.map((type, index) => (
                  <button
                    key={type}
                    type="button"
                    className={[
                      "rounded-md border p-4 text-left transition",
                      templateType === type
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/60",
                    ].join(" ")}
                    onClick={() => {
                      setTemplateType(type);
                      resetStartGate();
                    }}
                  >
                    <span className="text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="mt-1 block font-medium">
                      {PRACTICE_TEMPLATE_LABELS[type]}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {PRACTICE_TEMPLATE_STEPS[type]
                        .filter((step) => step !== "RESULT")
                        .map((step) => PRACTICE_STEP_LABELS[step])
                        .join(" → ")}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">난이도</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                난이도가 높을수록 대기 인원이 많고, 선택 가능한 좌석 후보가
                줄어들며, 좌석 매진 속도가 빨라집니다.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {PRACTICE_DIFFICULTIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={[
                      "rounded-md border px-4 py-3 text-left transition",
                      difficulty === item
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/60",
                    ].join(" ")}
                    onClick={() => {
                      setDifficulty(item);
                      resetStartGate();
                    }}
                  >
                    <span className="font-medium">
                      {PRACTICE_DIFFICULTY_LABELS[item]}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <Button onClick={handleStartCountdown}>
              <Ticket className="h-4 w-4" aria-hidden="true" />
              연습 시작
            </Button>
          </div>
        ) : null}

        {phase === "countdown" ? (
          <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-md border bg-secondary px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-background">
              <TimerReset className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {PRACTICE_TEMPLATE_LABELS[templateType]} ·{" "}
              {PRACTICE_DIFFICULTY_LABELS[difficulty]}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">연습 시작 준비</h2>
            <div className="mt-8 flex h-28 w-28 items-center justify-center rounded-full border bg-background text-5xl font-semibold">
              {startCountdown ?? 0}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetStartGate();
                  setPhase("setup");
                }}
                disabled={isStarting}
              >
                설정 다시 선택
              </Button>
              <Button
                onClick={handleStart}
                disabled={!isStartReady || isStartRequestSent}
              >
                {isStarting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                )}
                {isStarting ? "마지막 클릭 반영 중" : "연습 시작"}
              </Button>
            </div>
            {startDelayMs !== null ? (
              <p className="mt-4 text-sm text-muted-foreground">
                시작 버튼 반응 시간 {(startDelayMs / 1000).toFixed(1)}초
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "running" ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">
                  {currentStep ? PRACTICE_STEP_LABELS[currentStep] : ""}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {currentStepIndex + 1}/{steps.length - 1}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {formatTimer(elapsedMs)}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {steps
                .filter((step) => step !== "RESULT")
                .map((step, index) => (
                  <div
                    key={`${step}-${index}`}
                    className={[
                      "rounded-md border px-3 py-2 text-xs",
                      index === currentStepIndex
                        ? "border-primary bg-primary/5 text-primary"
                        : index < currentStepIndex
                          ? "bg-secondary text-muted-foreground"
                          : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {PRACTICE_STEP_LABELS[step]}
                  </div>
                ))}
            </div>

            {currentStep === "WAITING_QUEUE" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">대기열</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      예매 페이지 진입 전 대기 상태를 연습합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-md border bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">
                    현재 대기 인원
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    {queueCount.toLocaleString("ko-KR")}명
                  </p>
                </div>
                <div className="mt-5 h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{
                      width: `${queueProgressPercent}%`,
                    }}
                  />
                </div>
                <Button className="mt-5" disabled>
                  대기 중
                </Button>
              </section>
            ) : null}

            {currentStep === "CAPTCHA" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">보안문자 입력</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      표시된 문자를 정확히 입력해야 다음 단계로 이동합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 inline-flex rounded-md border bg-secondary px-4 py-3 font-mono text-2xl tracking-normal">
                  {captchaText.split("").join(" ")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    className="h-10 min-w-56 rounded-md border bg-background px-3 text-sm uppercase"
                    value={captchaInput}
                    onChange={(event) =>
                      setCaptchaInput(event.target.value.toUpperCase())
                    }
                    placeholder="보안문자 입력"
                  />
                  <Button onClick={handleCaptchaSubmit}>확인</Button>
                </div>
              </section>
            ) : null}

            {currentStep === "DATE_SELECT" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">날짜/회차 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      예매할 공연 회차를 선택합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  {schedules.map((schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      className={[
                        "rounded-md border px-4 py-3 text-left transition",
                        selectedScheduleId === schedule.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/60",
                      ].join(" ")}
                      onClick={() => setSelectedScheduleId(schedule.id)}
                    >
                      <span className="font-medium">{schedule.roundName}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatDateTime(schedule.performanceDate)} ·{" "}
                        {schedule.startTime}
                      </span>
                    </button>
                  ))}
                </div>
                <Button className="mt-5" onClick={handleScheduleConfirm}>
                  회차 선택 완료
                </Button>
              </section>
            ) : null}

            {currentStep === "SEAT_SELECT" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <Ticket className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">좌석 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isDirectSeatMapSelect
                        ? "구역 선택 없이 배치도 위 원형 좌석을 바로 선택합니다."
                        : isSplitSeatSelect && seatSelectView === "seat"
                          ? "선택한 구역의 남아있는 좌석을 선택합니다."
                          : "먼저 배치도에서 구역을 선택한 뒤 남아있는 좌석을 선택합니다."}
                    </p>
                  </div>
                </div>

                {isDirectSeatMapSelect ? (
                  <div className="mt-5 rounded-md border bg-secondary p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          선택 가능 좌석 {remainingSelectableSeatIds.length}석 /{" "}
                          후보 {selectableSeatIds.length}석
                        </span>
                        <span>
                          배치도 위에서 마우스 휠로 확대/축소할 수 있습니다.
                        </span>
                      </div>
                      <span className="font-medium text-foreground">
                        {Math.round(seatMapZoom * 100)}%
                      </span>
                    </div>

                    {directSeatMapSeats.length > 0 ? (
                      <div
                        ref={directSeatMapScrollRef}
                        className="max-h-[72vh] overflow-auto rounded-md border bg-background"
                        onWheel={handleSeatMapWheel}
                      >
                        <div
                          className="relative min-w-full"
                          style={{
                            width: `${directSeatMapWidthPercent}%`,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={seatMap.imageUrl}
                            alt="좌석 배치도"
                            className="block w-full select-none"
                            draggable={false}
                            onLoad={handleSeatMapImageLoad}
                          />
                          {directSeatMapSeats.map((seat) => {
                            const isSelected = selectedSeatId === seat.id;
                            const isCandidate =
                              remainingSelectableSeatIdSet.has(seat.id);
                            const isSoldOut = soldOutSeatIdSet.has(seat.id);
                            const isSelectable =
                              seat.status === "available" && !isCompleting;

                            return (
                              <button
                                key={seat.id}
                                type="button"
                                className={[
                                  "absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border p-0 text-[0px] leading-none shadow-sm transition",
                                  isSelected
                                    ? "z-20 border-primary bg-primary"
                                    : "",
                                  !isSelected && isCandidate
                                    ? "z-10 border-emerald-700 bg-emerald-400 hover:border-primary hover:bg-primary"
                                    : "",
                                  !isSelected && !isCandidate
                                    ? "border-muted-foreground/30 bg-muted-foreground/30 opacity-40"
                                    : "",
                                  isSoldOut
                                    ? "border-destructive/40 bg-destructive/40 opacity-30"
                                    : "",
                                ].join(" ")}
                                style={{
                                  left: `${seat.x * 100}%`,
                                  top: `${seat.y * 100}%`,
                                  width: `min(${directSeatMaxSizePx.toFixed(1)}px, ${seat.sizePercent.toFixed(4)}%)`,
                                }}
                                title={`${seat.zoneName} · ${seat.rowLabel} ${seat.seatNumber}번`}
                                aria-label={`${seat.zoneName} ${seat.rowLabel} ${seat.seatNumber}번 좌석`}
                                disabled={!isSelectable}
                                onClick={() => handleSeatClick(seat)}
                              >
                                {seat.seatNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                        배치도 좌표가 있는 좌석이 없습니다. 좌석 데이터를 다시
                        생성해주세요.
                      </p>
                    )}
                  </div>
                ) : isSplitSeatSelect && seatSelectView === "seat" ? (
                  <div className="mt-5 rounded-md border bg-secondary p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-medium">
                          {selectedZone
                            ? `${selectedZone.name} · ${selectedZone.grade}`
                            : "구역 미선택"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          남아있는 좌석을 선택하면 연습이 완료됩니다.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSeatSelectView("zone");
                          setSelectedSeatId(null);
                          setMessage("배치도에서 구역을 다시 선택하세요.");
                        }}
                        disabled={isCompleting}
                      >
                        구역 다시 선택
                      </Button>
                    </div>

                    {!selectedZone ? (
                      <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                        이전 페이지에서 구역을 먼저 선택하세요.
                      </p>
                    ) : groupedSeats.length > 0 ? (
                      <div className="rounded-md border bg-background p-3">
                        <div className="grid gap-1.5">
                          {groupedSeats.map((row) => (
                            <div
                              key={row.rowLabel}
                              className="grid items-center gap-1.5"
                              style={{
                                gridTemplateColumns: `2.5rem repeat(${maxSeatsPerRow}, minmax(0, 1fr))`,
                              }}
                            >
                              <span className="text-xs text-muted-foreground">
                                {row.rowLabel}
                              </span>
                              {row.seats.map((seat) => {
                                const isSelected = selectedSeatId === seat.id;
                                const isCandidate =
                                  remainingSelectableSeatIdSet.has(seat.id);
                                const isSoldOut = soldOutSeatIdSet.has(seat.id);
                                const isSelectable =
                                  seat.status === "available" &&
                                  !isCompleting;

                                return (
                                  <button
                                    key={seat.id}
                                    type="button"
                                    className={[
                                      "aspect-square rounded-sm border bg-background text-[10px] font-medium transition",
                                      isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "",
                                      !isSelected && isCandidate
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 hover:border-primary"
                                        : "",
                                      !isCandidate
                                        ? "opacity-35"
                                        : "",
                                    ].join(" ")}
                                    style={{
                                      maxWidth: `${compactSeatSizePx}px`,
                                      maxHeight: `${compactSeatSizePx}px`,
                                    }}
                                    title={
                                      isCandidate
                                        ? "선택 가능한 남은 좌석"
                                        : isSoldOut
                                          ? "이미 선택된 좌석입니다."
                                          : "선택할 수 없는 좌석"
                                    }
                                    disabled={!isSelectable}
                                    onClick={() => handleSeatClick(seat)}
                                  >
                                    {seat.seatNumber}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                        선택한 구역에 생성된 가상 좌석이 없습니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    className={[
                      "mt-5 grid gap-4",
                      isSplitSeatSelect
                        ? "xl:grid-cols-1"
                        : "xl:grid-cols-[minmax(0,1fr)_380px]",
                    ].join(" ")}
                  >
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-md border bg-secondary">
                        <div className="relative">
                          {/* Keep the rendered bitmap and zone overlay in the same coordinate space. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={seatMap.imageUrl}
                            alt="좌석 배치도"
                            className="block h-auto w-full"
                          />
                          <svg
                            className="absolute inset-0 h-full w-full"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            aria-label="좌석 구역 선택"
                          >
                            {zoneOverlays.map((zone) => {
                              const isSelected = selectedZone?.id === zone.id;
                              const needsGeometryReview = !zone.polygon;
                              const zoneLabel = `${zone.name} ${zone.grade}`;

                              return (
                                <g
                                  key={zone.id}
                                  className={[
                                    "cursor-pointer transition",
                                    isSelected && !needsGeometryReview
                                      ? "fill-primary/25 stroke-primary"
                                      : isSelected && needsGeometryReview
                                        ? "fill-amber-400/25 stroke-amber-600"
                                        : needsGeometryReview
                                          ? "fill-amber-400/15 stroke-amber-500 hover:fill-amber-400/25"
                                          : "fill-emerald-400/15 stroke-emerald-500 hover:fill-emerald-400/25",
                                  ].join(" ")}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={zoneLabel}
                                  onClick={() => handleZoneSelect(zone)}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      handleZoneSelect(zone);
                                    }
                                  }}
                                >
                                  <title>{zoneLabel}</title>
                                  {zone.polygon ? (
                                    <polygon
                                      points={getPolygonPointsAttribute(
                                        zone.polygon,
                                      )}
                                      strokeWidth={isSelected ? 0.9 : 0.6}
                                      vectorEffect="non-scaling-stroke"
                                    />
                                  ) : zone.bbox ? (
                                    <rect
                                      x={zone.bbox.x * 100}
                                      y={zone.bbox.y * 100}
                                      width={zone.bbox.width * 100}
                                      height={zone.bbox.height * 100}
                                      strokeWidth={isSelected ? 0.9 : 0.6}
                                      vectorEffect="non-scaling-stroke"
                                    />
                                  ) : null}
                                </g>
                              );
                            })}
                          </svg>
                          {zoneOverlays.map((zone) =>
                            zone.labelPoint ? (
                              <button
                                key={`${zone.id}-label`}
                                type="button"
                                title={
                                  zone.polygon
                                    ? `${zone.name} ${zone.grade}`
                                    : `${zone.name} ${zone.grade} - 외곽선 확인 필요`
                                }
                                className={[
                                  "absolute z-10 max-w-36 rounded-md border bg-background/95 px-2 py-1 text-left text-[11px] font-medium shadow-sm transition",
                                  selectedZone?.id === zone.id && zone.polygon
                                    ? "border-primary text-primary"
                                    : selectedZone?.id === zone.id
                                      ? "border-amber-600 text-amber-700"
                                      : !zone.polygon
                                        ? "border-amber-400 text-amber-700 hover:border-amber-600"
                                        : "hover:border-primary/60",
                                ].join(" ")}
                                style={{
                                  left: `${zone.labelPoint.x * 100}%`,
                                  top: `${zone.labelPoint.y * 100}%`,
                                  transform: "translate(-50%, -50%)",
                                }}
                                onClick={() => handleZoneSelect(zone)}
                              >
                                <span className="block truncate">
                                  {zone.name}
                                </span>
                                <span className="block truncate text-muted-foreground">
                                  {zone.grade}
                                </span>
                                {!zone.polygon ? (
                                  <span className="block truncate text-amber-700">
                                    확인 필요
                                  </span>
                                ) : null}
                              </button>
                            ) : null,
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {zonesWithGeometry.map((zone) => (
                          <button
                            key={zone.id}
                            type="button"
                            className={[
                              "rounded-md border bg-background px-3 py-2 text-left text-sm transition",
                              selectedZoneId === zone.id
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/60",
                            ].join(" ")}
                            onClick={() => handleZoneSelect(zone)}
                          >
                            <span className="font-medium">
                              {zone.name} · {zone.grade}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              남은 좌석{" "}
                              {
                                zone.virtualSeats.filter((seat) =>
                                  remainingSelectableSeatIdSet.has(seat.id),
                                ).length
                              }
                              석 / 전체 {zone.virtualSeats.length}석
                            </span>
                            {!zone.polygon ? (
                              <span className="mt-1 block text-xs text-amber-700">
                                외곽선 확인 필요
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!isSplitSeatSelect ? (
                      <div className="rounded-md border bg-secondary p-3">
                        <div className="mb-3 text-xs text-muted-foreground">
                          <p>
                            전체 남은 좌석 {remainingSelectableSeatIds.length}석 /{" "}
                            전체 {selectableSeatIds.length}석
                          </p>
                          {selectedZone ? (
                            <p className="mt-1">
                              선택 구역: {selectedZone.name} ·{" "}
                              {selectedZone.grade}
                            </p>
                          ) : null}
                        </div>

                        {!selectedZone ? (
                          <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                            배치도에서 구역을 먼저 선택하세요.
                          </p>
                        ) : groupedSeats.length > 0 ? (
                          <div className="max-h-96 overflow-auto">
                            <div className="grid min-w-max gap-2">
                              {groupedSeats.map((row) => (
                                <div
                                  key={row.rowLabel}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-10 shrink-0 text-xs text-muted-foreground">
                                    {row.rowLabel}
                                  </span>
                                  <div className="flex gap-1.5">
                                    {row.seats.map((seat) => {
                                      const isSelected =
                                        selectedSeatId === seat.id;
                                      const isCandidate =
                                        remainingSelectableSeatIdSet.has(
                                          seat.id,
                                        );
                                      const isSoldOut = soldOutSeatIdSet.has(
                                        seat.id,
                                      );
                                      const isSelectable =
                                        seat.status === "available" &&
                                        !isCompleting;

                                      return (
                                        <button
                                          key={seat.id}
                                          type="button"
                                          className={[
                                            "h-8 w-8 shrink-0 rounded-md border bg-background text-xs font-medium transition",
                                            isSelected
                                              ? "border-primary bg-primary text-primary-foreground"
                                              : "",
                                            !isSelected && isCandidate
                                              ? "border-emerald-500 bg-emerald-50 text-emerald-900 hover:border-primary"
                                              : "",
                                            !isCandidate ? "opacity-35" : "",
                                          ].join(" ")}
                                          title={
                                            isCandidate
                                              ? "선택 가능한 남은 좌석"
                                              : isSoldOut
                                                ? "이미 선택된 좌석입니다."
                                                : "선택할 수 없는 좌석"
                                          }
                                          disabled={!isSelectable}
                                          onClick={() => handleSeatClick(seat)}
                                        >
                                          {seat.seatNumber}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                            선택한 구역에 생성된 가상 좌석이 없습니다.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : null}

        {phase === "result" && result ? (
          <section className="mt-6 rounded-md border p-5">
            <div className="flex items-center gap-3">
              {result.status === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <TimerReset className="h-6 w-6 text-destructive" />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {result.status === "success" ? "예매 연습 성공" : "예매 연습 실패"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  소요 시간 {(result.elapsedMs / 1000).toFixed(1)}초
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  시작 버튼 반응 시간 {(result.startDelayMs / 1000).toFixed(1)}초
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-sm">
              <p>사이트 방식: {PRACTICE_TEMPLATE_LABELS[templateType]}</p>
              <p>
                회차:{" "}
                {selectedSchedule
                  ? `${selectedSchedule.roundName} · ${formatDateTime(selectedSchedule.performanceDate)}`
                  : "미선택"}
              </p>
              <p>
                좌석:{" "}
                {selectedZone && selectedSeat
                  ? `${selectedZone.name} ${selectedSeat.rowLabel} ${selectedSeat.seatNumber}번`
                  : "미선택"}
              </p>
              {result.failReason ? <p>실패 사유: {result.failReason}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleRestart}>다시 연습하기</Button>
              <Button asChild variant="outline">
                <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
              </Button>
            </div>
          </section>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">{concert.title}</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <p>{concert.artist}</p>
            <p>
              {concert.region} · {concert.venueName}
            </p>
            <p>{formatPriceRange(concert.priceMin, concert.priceMax)}</p>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">연습 요약</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">사이트</span>
              <span>{PRACTICE_TEMPLATE_LABELS[templateType]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">난이도</span>
              <span>{PRACTICE_DIFFICULTY_LABELS[difficulty]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">소요 시간</span>
              <span>{formatTimer(elapsedMs)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">회차</span>
              <span>{selectedSchedule?.roundName ?? "미선택"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">좌석</span>
              <span>
                {selectedZone && selectedSeat
                  ? `${selectedZone.name} ${selectedSeat.rowLabel} ${selectedSeat.seatNumber}번`
                  : "미선택"}
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
