"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type SyntheticEvent,
  type WheelEvent,
} from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  polygonFromBbox,
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

type Yes24SeatGroup = {
  id: string;
  label: string;
  zones: SeatZoneWithGeometry[];
  bounds: BoundingBox;
  center: Point;
};

type Yes24SeatGroupNode = {
  zone: SeatZoneWithGeometry;
  bounds: BoundingBox;
  explicitFloorKey: string | null;
  floorKey: string;
  isLarge: boolean;
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
  layout?: "default" | "panel";
  onPhaseChange?: (phase: PracticePhase) => void;
};

export type PracticePhase = "setup" | "countdown" | "running" | "result";

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

const CALENDAR_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

function createLocalCalendarDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 12);
}

function getDateParts(value: string) {
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateMatch) {
    return {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]) - 1,
      day: Number(dateMatch[3]),
    };
  }

  const date = new Date(value);

  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getScheduleDate(value: string) {
  const { year, month, day } = getDateParts(value);

  return createLocalCalendarDate(year, month, day);
}

function getScheduleDateKey(value: string) {
  return getDateKey(getScheduleDate(value));
}

function getInitialCalendarMonth(schedules: ScheduleSummary[]) {
  const firstScheduleDate = schedules[0]
    ? getScheduleDate(schedules[0].performanceDate)
    : new Date();

  return createLocalCalendarDate(
    firstScheduleDate.getFullYear(),
    firstScheduleDate.getMonth(),
    1,
  );
}

function getCalendarDays(monthDate: Date) {
  const firstDay = createLocalCalendarDate(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const calendarStart = createLocalCalendarDate(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    1 - firstDay.getDay(),
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = createLocalCalendarDate(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + index,
    );

    return {
      date,
      key: getDateKey(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function formatCalendarMonth(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatDateKeyLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(createLocalCalendarDate(year, month - 1, day));
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
const DIRECT_SEAT_MAP_IMAGE_OPACITY = 0.38;
const DIRECT_SEAT_MAX_PIXEL_SIZE = 22;
const MELON_MINI_MAP_MIN_ZOOM = 1;
const MELON_MINI_MAP_MAX_ZOOM = 4;
const MELON_MINI_MAP_ZOOM_STEP = 0.18;
const GEOMETRY_EPSILON = 0.000001;
const UNKNOWN_ZONE_GRADE_LABEL = "미확인";
const YES24_GROUP_ADJACENCY_TOLERANCE = 0.035;
const YES24_GROUP_MAX_ZONE_COUNT = 3;
const YES24_GROUP_PADDING_RATIO = 0.12;
const YES24_GROUP_MIN_PADDING = 0.018;
const YES24_INFERRED_FLOOR_VERTICAL_TOLERANCE = 0.12;
const YES24_LARGE_ZONE_AREA_THRESHOLD = 0.055;
const YES24_LARGE_ZONE_WIDTH_THRESHOLD = 0.34;
const YES24_LARGE_ZONE_HEIGHT_THRESHOLD = 0.28;
const YES24_RECT_SEAT_WIDTH_HEIGHT_RATIO = 0.78;
const YES24_RECT_SEAT_MAX_PIXEL_WIDTH = 12;
const YES24_RECT_SEAT_MIN_WIDTH_PERCENT = 1.2;
const YES24_RECT_SEAT_MAX_WIDTH_PERCENT = 4.2;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getVisibleZoneGrade(grade: string) {
  const trimmedGrade = grade.trim();

  if (!trimmedGrade || trimmedGrade === UNKNOWN_ZONE_GRADE_LABEL) {
    return "";
  }

  return trimmedGrade;
}

function formatSeatZoneLabel(name: string, grade: string, separator = " · ") {
  const visibleGrade = getVisibleZoneGrade(grade);

  if (!visibleGrade) {
    return name;
  }

  return `${name}${separator}${visibleGrade}`;
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

function getZoneDisplayPolygon(zone: SeatZoneWithGeometry) {
  if (zone.polygon) {
    return zone.polygon;
  }

  if (zone.bbox) {
    return polygonFromBbox(zone.bbox);
  }

  return null;
}

function getZoneGeometryBounds(zone: SeatZoneWithGeometry) {
  if (zone.polygon) {
    return getPointBounds(zone.polygon);
  }

  return zone.bbox;
}

function getUnionBounds(boundsList: BoundingBox[]) {
  const minX = Math.min(...boundsList.map((bounds) => bounds.x));
  const maxX = Math.max(...boundsList.map((bounds) => bounds.x + bounds.width));
  const minY = Math.min(...boundsList.map((bounds) => bounds.y));
  const maxY = Math.max(
    ...boundsList.map((bounds) => bounds.y + bounds.height),
  );

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  } satisfies BoundingBox;
}

function expandBounds(bounds: BoundingBox, ratio: number) {
  const paddingX = Math.max(bounds.width * ratio, YES24_GROUP_MIN_PADDING);
  const paddingY = Math.max(bounds.height * ratio, YES24_GROUP_MIN_PADDING);
  const x = Math.max(0, bounds.x - paddingX);
  const y = Math.max(0, bounds.y - paddingY);
  const right = Math.min(1, bounds.x + bounds.width + paddingX);
  const bottom = Math.min(1, bounds.y + bounds.height + paddingY);

  return {
    x,
    y,
    width: Math.max(right - x, GEOMETRY_EPSILON),
    height: Math.max(bottom - y, GEOMETRY_EPSILON),
  } satisfies BoundingBox;
}

function mapPointToBounds(point: Point, bounds: BoundingBox) {
  return {
    x: clampNumber((point.x - bounds.x) / bounds.width, 0, 1),
    y: clampNumber((point.y - bounds.y) / bounds.height, 0, 1),
  } satisfies Point;
}

function mapPolygonToBounds(points: Point[], bounds: BoundingBox) {
  return points.map((point) => mapPointToBounds(point, bounds));
}

function getExplicitFloorKey(zone: SeatZoneWithGeometry) {
  const compactText = `${zone.name} ${zone.grade}`.replace(/\s+/g, "");
  const suffixMatch = compactText.match(/([0-9]+)(?:층|F|FLOOR)/i);
  const prefixMatch = compactText.match(/(?:층|F|FLOOR)([0-9]+)/i);
  const floorValue = suffixMatch?.[1] ?? prefixMatch?.[1];

  return floorValue ? `floor-${Number(floorValue)}` : null;
}

function isLargeYes24Zone(bounds: BoundingBox) {
  return (
    bounds.width * bounds.height >= YES24_LARGE_ZONE_AREA_THRESHOLD ||
    bounds.width >= YES24_LARGE_ZONE_WIDTH_THRESHOLD ||
    bounds.height >= YES24_LARGE_ZONE_HEIGHT_THRESHOLD
  );
}

function getInferredFloorKey(input: {
  bounds: BoundingBox;
  floorBands: {
    key: string;
    centerY: number;
    nodeCount: number;
  }[];
}) {
  const centerY = getBboxCenter(input.bounds).y;
  const matchedFloorBand = input.floorBands.find(
    (floorBand) =>
      Math.abs(floorBand.centerY - centerY) <=
      Math.max(YES24_INFERRED_FLOOR_VERTICAL_TOLERANCE, input.bounds.height),
  );

  if (!matchedFloorBand) {
    const nextFloorBand = {
      key: `inferred-floor-${input.floorBands.length + 1}`,
      centerY,
      nodeCount: 1,
    };

    input.floorBands.push(nextFloorBand);
    return nextFloorBand.key;
  }

  matchedFloorBand.centerY =
    (matchedFloorBand.centerY * matchedFloorBand.nodeCount + centerY) /
    (matchedFloorBand.nodeCount + 1);
  matchedFloorBand.nodeCount += 1;

  return matchedFloorBand.key;
}

function createYes24SeatGroupNodes(zones: SeatZoneWithGeometry[]) {
  const floorBands: {
    key: string;
    centerY: number;
    nodeCount: number;
  }[] = [];

  return zones
    .map((zone) => ({
      zone,
      bounds: getZoneGeometryBounds(zone),
      explicitFloorKey: getExplicitFloorKey(zone),
    }))
    .filter(
      (
        node,
      ): node is {
        zone: SeatZoneWithGeometry;
        bounds: BoundingBox;
        explicitFloorKey: string | null;
      } => Boolean(node.bounds),
    )
    .sort((firstNode, secondNode) => {
      const firstCenter = getBboxCenter(firstNode.bounds);
      const secondCenter = getBboxCenter(secondNode.bounds);

      return (
        firstCenter.y - secondCenter.y ||
        firstCenter.x - secondCenter.x ||
        firstNode.zone.name.localeCompare(secondNode.zone.name, "ko-KR")
      );
    })
    .map((node) => ({
      ...node,
      floorKey:
        node.explicitFloorKey ??
        getInferredFloorKey({
          bounds: node.bounds,
          floorBands,
        }),
      isLarge: isLargeYes24Zone(node.bounds),
    }));
}

function getDisplayRangeOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return Math.max(
    0,
    Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart),
  );
}

function getDisplayRangeGap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  if (firstEnd < secondStart) {
    return secondStart - firstEnd;
  }

  if (secondEnd < firstStart) {
    return firstStart - secondEnd;
  }

  return 0;
}

function getBoundsCenterDistance(
  firstBounds: BoundingBox,
  secondBounds: BoundingBox,
) {
  const firstCenter = getBboxCenter(firstBounds);
  const secondCenter = getBboxCenter(secondBounds);

  return Math.hypot(
    firstCenter.x - secondCenter.x,
    firstCenter.y - secondCenter.y,
  );
}

function areZoneBoundsAdjacent(
  firstBounds: BoundingBox,
  secondBounds: BoundingBox,
) {
  const firstRight = firstBounds.x + firstBounds.width;
  const secondRight = secondBounds.x + secondBounds.width;
  const horizontalGap = getDisplayRangeGap(
    firstBounds.x,
    firstRight,
    secondBounds.x,
    secondRight,
  );
  const firstBottom = firstBounds.y + firstBounds.height;
  const secondBottom = secondBounds.y + secondBounds.height;
  const verticalOverlap = getDisplayRangeOverlap(
    firstBounds.y,
    firstBottom,
    secondBounds.y,
    secondBottom,
  );
  const minHeight = Math.min(firstBounds.height, secondBounds.height);
  const hasMeaningfulVerticalOverlap =
    minHeight <= GEOMETRY_EPSILON || verticalOverlap / minHeight >= 0.18;

  return (
    horizontalGap <= YES24_GROUP_ADJACENCY_TOLERANCE &&
    hasMeaningfulVerticalOverlap
  );
}

function getYes24GroupCandidateScore(
  candidateNode: Yes24SeatGroupNode,
  groupNodes: Yes24SeatGroupNode[],
) {
  return Math.min(
    ...groupNodes.map((groupNode) =>
      getBoundsCenterDistance(candidateNode.bounds, groupNode.bounds),
    ),
  );
}

function getNextYes24GroupCandidate(
  nodes: Yes24SeatGroupNode[],
  groupNodes: Yes24SeatGroupNode[],
  visitedZoneIds: Set<string>,
) {
  return nodes
    .filter((candidateNode) => !visitedZoneIds.has(candidateNode.zone.id))
    .sort((firstNode, secondNode) => {
      const firstIsAdjacent = groupNodes.some((groupNode) =>
        areZoneBoundsAdjacent(groupNode.bounds, firstNode.bounds),
      );
      const secondIsAdjacent = groupNodes.some((groupNode) =>
        areZoneBoundsAdjacent(groupNode.bounds, secondNode.bounds),
      );
      const scoreDiff =
        getYes24GroupCandidateScore(firstNode, groupNodes) -
        getYes24GroupCandidateScore(secondNode, groupNodes);

      return (
        Number(secondIsAdjacent) - Number(firstIsAdjacent) ||
        scoreDiff ||
        firstNode.bounds.x - secondNode.bounds.x ||
        firstNode.bounds.y - secondNode.bounds.y ||
        firstNode.zone.name.localeCompare(secondNode.zone.name, "ko-KR")
      );
    })[0];
}

function getYes24TargetGroupSize(remainingNodeCount: number) {
  if (remainingNodeCount <= YES24_GROUP_MAX_ZONE_COUNT) {
    return remainingNodeCount;
  }

  if (remainingNodeCount % YES24_GROUP_MAX_ZONE_COUNT === 1) {
    return YES24_GROUP_MAX_ZONE_COUNT - 1;
  }

  return YES24_GROUP_MAX_ZONE_COUNT;
}

function createYes24SeatGroupFromNodes(groupNodes: Yes24SeatGroupNode[]) {
  const sortedZones = groupNodes
    .map((groupNode) => groupNode.zone)
    .sort((firstZone, secondZone) => {
      const firstBounds = getZoneGeometryBounds(firstZone);
      const secondBounds = getZoneGeometryBounds(secondZone);

      if (!firstBounds || !secondBounds) {
        return firstZone.name.localeCompare(secondZone.name, "ko-KR");
      }

      return (
        firstBounds.y - secondBounds.y ||
        firstBounds.x - secondBounds.x ||
        firstZone.name.localeCompare(secondZone.name, "ko-KR")
      );
    });
  const groupBounds = getUnionBounds(
    groupNodes.map((groupNode) => groupNode.bounds),
  );
  const firstZoneName = sortedZones[0]?.name ?? "구역";
  const label =
    sortedZones.length > 1
      ? `${firstZoneName} 외 ${sortedZones.length - 1}구역`
      : firstZoneName;

  return {
    id: sortedZones
      .map((zone) => zone.id)
      .sort()
      .join(":"),
    label,
    zones: sortedZones,
    bounds: groupBounds,
    center: getBboxCenter(groupBounds),
  } satisfies Yes24SeatGroup;
}

function createYes24SmallSeatGroupsForFloor(floorNodes: Yes24SeatGroupNode[]) {
  const sortedFloorNodes = [...floorNodes].sort((firstNode, secondNode) => {
    const firstCenter = getBboxCenter(firstNode.bounds);
    const secondCenter = getBboxCenter(secondNode.bounds);

    return (
      firstCenter.y - secondCenter.y ||
      firstCenter.x - secondCenter.x ||
      firstNode.zone.name.localeCompare(secondNode.zone.name, "ko-KR")
    );
  });
  const visitedZoneIds = new Set<string>();
  const groups: Yes24SeatGroup[] = [];

  for (const node of sortedFloorNodes) {
    if (visitedZoneIds.has(node.zone.id)) {
      continue;
    }

    const remainingNodeCount = sortedFloorNodes.filter(
      (candidateNode) => !visitedZoneIds.has(candidateNode.zone.id),
    ).length;
    const targetGroupSize = getYes24TargetGroupSize(remainingNodeCount);
    const groupNodes = [node];
    visitedZoneIds.add(node.zone.id);

    while (groupNodes.length < targetGroupSize) {
      const nextCandidateNode = getNextYes24GroupCandidate(
        sortedFloorNodes,
        groupNodes,
        visitedZoneIds,
      );

      if (!nextCandidateNode) {
        break;
      }

      groupNodes.push(nextCandidateNode);
      visitedZoneIds.add(nextCandidateNode.zone.id);
    }

    groups.push(createYes24SeatGroupFromNodes(groupNodes));
  }

  return groups;
}

function createYes24SeatGroups(zones: SeatZoneWithGeometry[]) {
  const nodes = createYes24SeatGroupNodes(zones);
  const floorNodeMap = new Map<string, Yes24SeatGroupNode[]>();
  const groups: Yes24SeatGroup[] = [];

  for (const node of nodes) {
    const floorNodes = floorNodeMap.get(node.floorKey) ?? [];
    floorNodes.push(node);
    floorNodeMap.set(node.floorKey, floorNodes);
  }

  for (const floorNodes of floorNodeMap.values()) {
    const largeNodes = floorNodes.filter((node) => node.isLarge);
    const smallNodes = floorNodes.filter((node) => !node.isLarge);

    groups.push(
      ...largeNodes.map((node) => createYes24SeatGroupFromNodes([node])),
      ...createYes24SmallSeatGroupsForFloor(smallNodes),
    );
  }

  return groups.sort(
    (firstGroup, secondGroup) =>
      firstGroup.bounds.y - secondGroup.bounds.y ||
      firstGroup.center.x - secondGroup.center.x ||
      firstGroup.label.localeCompare(secondGroup.label, "ko-KR"),
  );
}

function getDefaultYes24SeatGroupId(groups: Yes24SeatGroup[]) {
  return (
    [...groups].sort((firstGroup, secondGroup) => {
      const firstHasSeats = firstGroup.zones.some(
        (zone) => zone.virtualSeats.length > 0,
      );
      const secondHasSeats = secondGroup.zones.some(
        (zone) => zone.virtualSeats.length > 0,
      );

      return (
        Number(secondHasSeats) - Number(firstHasSeats) ||
        firstGroup.bounds.y - secondGroup.bounds.y ||
        secondGroup.center.x - firstGroup.center.x ||
        firstGroup.label.localeCompare(secondGroup.label, "ko-KR")
      );
    })[0]?.id ?? null
  );
}

function getYes24GroupSeatWidthPercent(
  seat: PositionedSeatSummary,
  cropBounds: BoundingBox,
) {
  return clampNumber(
    seat.sizePercent / cropBounds.width,
    YES24_RECT_SEAT_MIN_WIDTH_PERCENT,
    YES24_RECT_SEAT_MAX_WIDTH_PERCENT,
  );
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
    Math.min(bounds.width, bounds.height * input.seatMapHeightRatio) *
    100 *
    0.5;

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
  layout = "default",
  onPhaseChange,
}: PracticeClientProps) {
  const isPanelLayout = layout === "panel";
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const [templateType, setTemplateType] =
    useState<TicketTemplateType>("nol_old");
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("normal");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [captchaText, setCaptchaText] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [initialQueueCount, setInitialQueueCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const [selectedScheduleDateKey, setSelectedScheduleDateKey] = useState<
    string | null
  >(null);
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(() =>
    getInitialCalendarMonth(schedules),
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedYes24SeatGroupId, setSelectedYes24SeatGroupId] = useState<
    string | null
  >(null);
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
  const [melonMiniMapZoom, setMelonMiniMapZoom] = useState(
    MELON_MINI_MAP_MIN_ZOOM,
  );
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
  const melonMiniMapScrollRef = useRef<HTMLDivElement | null>(null);
  const melonMiniMapDragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    hasMoved: boolean;
  } | null>(null);
  const suppressMelonMiniMapClickRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  const steps = PRACTICE_TEMPLATE_STEPS[templateType];
  const currentStep = phase === "running" ? steps[currentStepIndex] : null;
  const isSplitSeatSelect = templateType === "nol_old";
  const isDirectSeatMapSelect = templateType === "nol_new";
  const isYes24SeatSelect = templateType === "yes24";
  const isMelonSeatSelect = templateType === "melon";
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
  const yes24SeatGroups = useMemo(
    () => createYes24SeatGroups(zonesWithGeometry),
    [zonesWithGeometry],
  );
  const defaultYes24SeatGroupId = useMemo(
    () => getDefaultYes24SeatGroupId(yes24SeatGroups),
    [yes24SeatGroups],
  );
  const activeYes24SeatGroup =
    yes24SeatGroups.find((group) => group.id === selectedYes24SeatGroupId) ??
    yes24SeatGroups.find((group) => group.id === defaultYes24SeatGroupId) ??
    null;
  const activeYes24SeatGroupZoneIds = useMemo(
    () => new Set(activeYes24SeatGroup?.zones.map((zone) => zone.id) ?? []),
    [activeYes24SeatGroup],
  );
  const activeYes24SeatGroupCropBounds = useMemo(
    () =>
      activeYes24SeatGroup
        ? expandBounds(activeYes24SeatGroup.bounds, YES24_GROUP_PADDING_RATIO)
        : null,
    [activeYes24SeatGroup],
  );
  const activeYes24SeatGroupDisplayRatio = activeYes24SeatGroupCropBounds
    ? Math.max(
        (activeYes24SeatGroupCropBounds.height * seatMapHeightRatio) /
          Math.max(activeYes24SeatGroupCropBounds.width, GEOMETRY_EPSILON),
        GEOMETRY_EPSILON,
      )
    : 1;
  const schedulesByDate = useMemo(() => {
    const scheduleMap = new Map<string, ScheduleSummary[]>();

    for (const schedule of schedules) {
      const dateKey = getScheduleDateKey(schedule.performanceDate);
      const dateSchedules = scheduleMap.get(dateKey) ?? [];

      dateSchedules.push(schedule);
      scheduleMap.set(dateKey, dateSchedules);
    }

    return scheduleMap;
  }, [schedules]);
  const scheduleDateKeySet = useMemo(
    () => new Set(schedulesByDate.keys()),
    [schedulesByDate],
  );
  const calendarDays = useMemo(
    () => getCalendarDays(visibleCalendarMonth),
    [visibleCalendarMonth],
  );
  const selectedDateSchedules = selectedScheduleDateKey
    ? (schedulesByDate.get(selectedScheduleDateKey) ?? [])
    : [];
  const selectedScheduleDateLabel = selectedScheduleDateKey
    ? formatDateKeyLabel(selectedScheduleDateKey)
    : null;
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
    () =>
      selectableSeatIds.filter((seatId) => !soldOutSeatIds.includes(seatId)),
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
            const storedX = isNormalizedCoordinate(seat.x) ? seat.x : null;
            const storedY = isNormalizedCoordinate(seat.y) ? seat.y : null;
            const x = polygonPoint?.x ?? storedX ?? fallbackX;
            const y = polygonPoint?.y ?? storedY ?? fallbackY;

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
  const activeYes24SeatGroupSeats = useMemo(
    () =>
      activeYes24SeatGroup
        ? directSeatMapSeats.filter((seat) =>
            activeYes24SeatGroupZoneIds.has(seat.zoneId),
          )
        : [],
    [activeYes24SeatGroup, activeYes24SeatGroupZoneIds, directSeatMapSeats],
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
          Math.max(
            0,
            ((initialQueueCount - queueCount) / initialQueueCount) * 100,
          ),
        )
      : 0;
  const directSeatMapWidthPercent = seatMapZoom * 100;
  const directSeatMaxSizePx = seatMapZoom * DIRECT_SEAT_MAX_PIXEL_SIZE;

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
      (isDirectSeatMapSelect || isYes24SeatSelect) &&
      directSeatMapAvailableSeatIds.length > 0
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
    setSelectedYes24SeatGroupId(
      isYes24SeatSelect ? defaultYes24SeatGroupId : null,
    );
    setSeatSelectView("zone");
    setMelonMiniMapZoom(MELON_MINI_MAP_MIN_ZOOM);
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

  function resetScheduleSelection() {
    setSelectedScheduleDateKey(null);
    setSelectedScheduleId(null);
    setVisibleCalendarMonth(getInitialCalendarMonth(schedules));
  }

  function moveCalendarMonth(monthOffset: number) {
    setVisibleCalendarMonth((currentMonth) =>
      createLocalCalendarDate(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + monthOffset,
        1,
      ),
    );
  }

  function handleScheduleDateSelect(dateKey: string) {
    if (!schedulesByDate.has(dateKey)) {
      return;
    }

    setSelectedScheduleDateKey(dateKey);
    setSelectedScheduleId(null);
    setMessage("");
  }

  function handleScheduleSelect(scheduleId: string) {
    setSelectedScheduleId(scheduleId);
    setMessage("");
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
    const nextScrollLeft =
      (container.scrollLeft + pointerX) * zoomRatio - pointerX;
    const nextScrollTop =
      (container.scrollTop + pointerY) * zoomRatio - pointerY;

    setSeatMapZoom(nextZoom);
    window.requestAnimationFrame(() => {
      container.scrollLeft = nextScrollLeft;
      container.scrollTop = nextScrollTop;
    });
  }

  function handleMelonMiniMapWheel(event: WheelEvent<HTMLDivElement>) {
    if (zoneOverlays.length === 0) {
      return;
    }

    event.preventDefault();

    const container = melonMiniMapScrollRef.current;

    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const pointerX = event.clientX - containerRect.left;
    const pointerY = event.clientY - containerRect.top;
    const zoomDirection = event.deltaY < 0 ? 1 : -1;
    const nextZoom = clampNumber(
      melonMiniMapZoom + zoomDirection * MELON_MINI_MAP_ZOOM_STEP,
      MELON_MINI_MAP_MIN_ZOOM,
      MELON_MINI_MAP_MAX_ZOOM,
    );

    if (nextZoom === melonMiniMapZoom) {
      return;
    }

    const zoomRatio = nextZoom / melonMiniMapZoom;
    const nextScrollLeft =
      (container.scrollLeft + pointerX) * zoomRatio - pointerX;
    const nextScrollTop =
      (container.scrollTop + pointerY) * zoomRatio - pointerY;

    setMelonMiniMapZoom(nextZoom);
    window.requestAnimationFrame(() => {
      container.scrollLeft = nextScrollLeft;
      container.scrollTop = nextScrollTop;
    });
  }

  function handleMelonMiniMapMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || zoneOverlays.length === 0) {
      return;
    }

    const container = melonMiniMapScrollRef.current;

    if (!container) {
      return;
    }

    melonMiniMapDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      hasMoved: false,
    };
  }

  function handleMelonMiniMapMouseMove(event: MouseEvent<HTMLDivElement>) {
    const dragState = melonMiniMapDragRef.current;
    const container = melonMiniMapScrollRef.current;

    if (!dragState || !container) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
      dragState.hasMoved = true;
      event.preventDefault();
    }

    container.scrollLeft = dragState.scrollLeft - deltaX;
    container.scrollTop = dragState.scrollTop - deltaY;
  }

  function finishMelonMiniMapDrag() {
    const dragState = melonMiniMapDragRef.current;

    if (dragState?.hasMoved) {
      suppressMelonMiniMapClickRef.current = true;
      window.setTimeout(() => {
        suppressMelonMiniMapClickRef.current = false;
      }, 150);
    }

    melonMiniMapDragRef.current = null;
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
      setStartDelayMs(
        payload.data.practiceSession.startDelayMs ?? finalStartDelayMs,
      );
      setCaptchaText(generatePracticeCaptcha(6));
      setCaptchaInput("");
      resetScheduleSelection();
      setSelectedSeatId(null);
      setSelectedZoneId(null);
      setSelectedYes24SeatGroupId(null);
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
    if (!selectedScheduleDateKey) {
      setMessage("날짜를 선택해주세요.");
      return;
    }

    if (!selectedScheduleId) {
      setMessage("시간/회차를 선택해주세요.");
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

    if (isSplitSeatSelect || isMelonSeatSelect) {
      setSeatSelectView("seat");
    }
  }

  function handleMelonMiniMapZoneSelect(zone: SeatZoneWithGeometry) {
    if (suppressMelonMiniMapClickRef.current) {
      return;
    }

    handleZoneSelect(zone);
  }

  function handleYes24GroupSelect(group: Yes24SeatGroup) {
    setSelectedYes24SeatGroupId(group.id);
    setSelectedSeatId(null);
    setSelectedZoneId(null);
    setMessage(
      `${group.label} 그룹을 선택했습니다. 남아있는 좌석을 선택하세요.`,
    );
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
    resetScheduleSelection();
    setSelectedZoneId(null);
    setSelectedSeatId(null);
    setSelectedYes24SeatGroupId(null);
    setSeatSelectView("zone");
    setMelonMiniMapZoom(MELON_MINI_MAP_MIN_ZOOM);
    setSelectableSeatIds([]);
    setSoldOutSeatIds([]);
    setMessage("");
    setToastMessage("");
    setResult(null);
    completingRef.current = false;
  }

  function handleSeatMapOverview() {
    setSeatSelectView("zone");
    setSelectedZoneId(null);
    setSelectedSeatId(null);
    setMessage("배치도에서 구역을 다시 선택하세요.");
  }

  function renderSeatZoneMap({
    alt,
    ariaLabel,
    onZoneSelect = handleZoneSelect,
    showLabels = true,
    miniMap = false,
  }: {
    alt: string;
    ariaLabel: string;
    onZoneSelect?: (zone: SeatZoneWithGeometry) => void;
    showLabels?: boolean;
    miniMap?: boolean;
  }) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={seatMap.imageUrl}
          alt={alt}
          className={[
            "block h-auto w-full select-none",
            miniMap ? "contrast-75 saturate-75" : "",
          ].join(" ")}
          draggable={false}
          onLoad={handleSeatMapImageLoad}
          style={
            miniMap
              ? {
                  opacity: DIRECT_SEAT_MAP_IMAGE_OPACITY,
                }
              : undefined
          }
        />
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label={ariaLabel}
        >
          {zoneOverlays.map((zone) => {
            const isSelected = selectedZone?.id === zone.id;
            const needsGeometryReview = !zone.polygon;
            const zoneLabel = formatSeatZoneLabel(zone.name, zone.grade, " ");

            return (
              <g
                key={zone.id}
                className={[
                  "cursor-pointer transition",
                  miniMap && isSelected && !needsGeometryReview
                    ? "fill-primary/30 stroke-primary"
                    : "",
                  miniMap && isSelected && needsGeometryReview
                    ? "fill-amber-400/25 stroke-amber-600"
                    : "",
                  miniMap && !isSelected
                    ? "fill-transparent stroke-slate-400/70 hover:fill-emerald-400/15 hover:stroke-emerald-600"
                    : "",
                  !miniMap && isSelected && !needsGeometryReview
                    ? "fill-primary/25 stroke-primary"
                    : "",
                  !miniMap && isSelected && needsGeometryReview
                    ? "fill-amber-400/25 stroke-amber-600"
                    : "",
                  !miniMap && !isSelected && needsGeometryReview
                    ? "fill-amber-400/15 stroke-amber-500 hover:fill-amber-400/25"
                    : "",
                  !miniMap && !isSelected && !needsGeometryReview
                    ? "fill-emerald-400/15 stroke-emerald-500 hover:fill-emerald-400/25"
                    : "",
                ].join(" ")}
                role="button"
                tabIndex={0}
                aria-label={zoneLabel}
                onClick={() => onZoneSelect(zone)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onZoneSelect(zone);
                  }
                }}
              >
                <title>{zoneLabel}</title>
                {zone.polygon ? (
                  <polygon
                    points={getPolygonPointsAttribute(zone.polygon)}
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
        {showLabels
          ? zoneOverlays.map((zone) => {
              const visibleGrade = getVisibleZoneGrade(zone.grade);
              const zoneLabel = formatSeatZoneLabel(zone.name, zone.grade, " ");
              const zoneTitle = zone.polygon
                ? zoneLabel
                : `${zoneLabel} - 외곽선 확인 필요`;

              return zone.labelPoint ? (
                <button
                  key={`${zone.id}-label`}
                  type="button"
                  title={zoneTitle}
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
                  onClick={() => onZoneSelect(zone)}
                >
                  <span className="block truncate">{zone.name}</span>
                  {visibleGrade ? (
                    <span className="block truncate text-muted-foreground">
                      {visibleGrade}
                    </span>
                  ) : null}
                  {!zone.polygon ? (
                    <span className="block truncate text-amber-700">
                      확인 필요
                    </span>
                  ) : null}
                </button>
              ) : null;
            })
          : null}
      </div>
    );
  }

  function renderNolOldSeatGrid({
    className = "",
    showResetButton = true,
  }: {
    className?: string;
    showResetButton?: boolean;
  } = {}) {
    return (
      <div
        className={["rounded-md border bg-secondary p-4", className].join(" ")}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {selectedZone
                ? formatSeatZoneLabel(selectedZone.name, selectedZone.grade)
                : "구역 미선택"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              남아있는 좌석을 선택하면 연습이 완료됩니다.
            </p>
          </div>
          {showResetButton ? (
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
          ) : null}
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
                    const isCandidate = remainingSelectableSeatIdSet.has(
                      seat.id,
                    );
                    const isSoldOut = soldOutSeatIdSet.has(seat.id);
                    const isSelectable =
                      seat.status === "available" && !isCompleting;

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
                          !isCandidate ? "opacity-35" : "",
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
            선택한 구역의 좌석 데이터를 준비하지 못했습니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        isPanelLayout
          ? "relative min-w-0"
          : "mt-5 grid gap-6 lg:grid-cols-[1fr_340px]"
      }
    >
      {toastMessage ? (
        <div
          className="fixed left-1/2 top-6 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-md border bg-background px-4 py-3 text-sm font-medium shadow-lg"
          role="alert"
        >
          {toastMessage}
        </div>
      ) : null}

      <section
        className={
          isPanelLayout
            ? "rounded-lg border bg-card p-5 shadow-sm"
            : "rounded-lg border bg-card p-6 shadow-sm"
        }
      >
        <div>
          {!isPanelLayout ? (
            <p className="text-sm text-muted-foreground">
              {concert.artist} · {concert.region} · {concert.venueName}
            </p>
          ) : null}
          <h1
            className={
              isPanelLayout ? "text-xl font-black" : "mt-1 text-2xl font-black"
            }
          >
            티켓팅 연습
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            실제 예매가 아닌 연습용 흐름입니다. 좌석은 AI 분석 구역을 바탕으로
            준비한 연습용 좌석 데이터입니다.
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
                      "rounded-lg border bg-background p-4 text-left shadow-sm transition",
                      templateType === type
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/60",
                    ].join(" ")}
                    onClick={() => {
                      setTemplateType(type);
                      resetScheduleSelection();
                      setSelectedZoneId(null);
                      setSelectedSeatId(null);
                      setSelectedYes24SeatGroupId(null);
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
                      "rounded-lg border bg-background px-4 py-3 text-left shadow-sm transition",
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
          <div className="mt-6 flex min-h-[360px] flex-col items-center justify-center rounded-lg border bg-primary/5 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-background text-primary">
              <TimerReset className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {PRACTICE_TEMPLATE_LABELS[templateType]} ·{" "}
              {PRACTICE_DIFFICULTY_LABELS[difficulty]}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">연습 시작 준비</h2>
            <div className="mt-8 flex h-28 w-28 items-center justify-center rounded-full border bg-background text-5xl font-black text-primary shadow-sm">
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/5 px-4 py-3">
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
              <section className="rounded-lg border bg-card p-5 shadow-sm">
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
              <section className="rounded-lg border bg-card p-5 shadow-sm">
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCaptchaSubmit();
                      }
                    }}
                    maxLength={6}
                    placeholder="보안문자 입력"
                  />
                  <Button onClick={handleCaptchaSubmit}>확인</Button>
                </div>
              </section>
            ) : null}

            {currentStep === "DATE_SELECT" ? (
              <section className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">날짜/회차 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      달력에서 날짜를 선택한 뒤 시간/회차를 선택합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.78fr)]">
                  <div className="rounded-md border bg-secondary p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="이전 달"
                        onClick={() => moveCalendarMonth(-1)}
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <p className="text-sm font-semibold">
                        {formatCalendarMonth(visibleCalendarMonth)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="다음 달"
                        onClick={() => moveCalendarMonth(1)}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
                      {CALENDAR_WEEKDAYS.map((weekday) => (
                        <span key={weekday}>{weekday}</span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {calendarDays.map((calendarDay) => {
                        const hasSchedule = scheduleDateKeySet.has(
                          calendarDay.key,
                        );
                        const isSelected =
                          selectedScheduleDateKey === calendarDay.key;

                        return (
                          <button
                            key={calendarDay.key}
                            type="button"
                            className={[
                              "h-10 min-w-0 rounded-md border text-sm font-semibold transition",
                              calendarDay.isCurrentMonth
                                ? ""
                                : "text-muted-foreground/45",
                              hasSchedule
                                ? "bg-background hover:border-primary/60"
                                : "cursor-not-allowed bg-background/45 text-muted-foreground/35",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground hover:border-primary"
                                : "",
                            ].join(" ")}
                            disabled={!hasSchedule}
                            aria-pressed={isSelected}
                            onClick={() =>
                              handleScheduleDateSelect(calendarDay.key)
                            }
                          >
                            {calendarDay.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-md border bg-secondary/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">시간/회차 선택</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedScheduleDateLabel ??
                            "날짜를 먼저 선택하세요."}
                        </p>
                      </div>
                      {selectedDateSchedules.length > 0 ? (
                        <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {selectedDateSchedules.length}개
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2">
                      {!selectedScheduleDateKey ? (
                        <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                          달력에서 공연 날짜를 선택하세요.
                        </p>
                      ) : selectedDateSchedules.length > 0 ? (
                        selectedDateSchedules.map((schedule) => (
                          <button
                            key={schedule.id}
                            type="button"
                            className={[
                              "rounded-md border bg-background px-4 py-3 text-left transition",
                              selectedScheduleId === schedule.id
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/60",
                            ].join(" ")}
                            onClick={() => handleScheduleSelect(schedule.id)}
                          >
                            <span className="font-medium">
                              {schedule.roundName}
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                              {schedule.startTime || "시간 미정"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                          선택한 날짜에 등록된 회차가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Button className="mt-5" onClick={handleScheduleConfirm}>
                  회차 선택 완료
                </Button>
              </section>
            ) : null}

            {currentStep === "SEAT_SELECT" ? (
              <section
                className={[
                  "rounded-lg border bg-card shadow-sm",
                  isYes24SeatSelect ? "p-3 sm:p-4" : "p-5",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <Ticket className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">좌석 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isDirectSeatMapSelect
                        ? "구역 선택 없이 배치도 위 원형 좌석을 바로 선택합니다."
                        : isYes24SeatSelect
                          ? "미니맵에서 구역 그룹을 선택한 뒤 직사각형 좌석을 선택합니다."
                          : isMelonSeatSelect
                            ? seatSelectView === "seat"
                              ? "선택한 구역의 남아있는 좌석을 선택합니다."
                              : "배치도 또는 미니맵에서 구역을 선택한 뒤 남아있는 좌석을 선택합니다."
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
                            className="block w-full select-none contrast-75 saturate-75"
                            draggable={false}
                            onLoad={handleSeatMapImageLoad}
                            style={{
                              opacity: DIRECT_SEAT_MAP_IMAGE_OPACITY,
                            }}
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
                                  "absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-2 p-0 text-[0px] leading-none shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_3px_10px_rgba(15,23,42,0.35)] transition",
                                  isSelected
                                    ? "z-20 border-primary bg-primary ring-2 ring-white"
                                    : "",
                                  !isSelected && isCandidate
                                    ? "z-10 border-emerald-950 bg-emerald-400 ring-1 ring-white hover:border-primary hover:bg-primary"
                                    : "",
                                  !isSelected && !isCandidate
                                    ? "border-slate-500 bg-slate-300 opacity-80"
                                    : "",
                                  isSoldOut
                                    ? "border-destructive bg-destructive/70 opacity-85"
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
                              />
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
                ) : isYes24SeatSelect ? (
                  <div className="mt-3 grid items-start gap-2 xl:grid-cols-[minmax(0,1fr)_150px] 2xl:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="rounded-md border bg-secondary p-2.5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span>
                            선택 가능 좌석 {remainingSelectableSeatIds.length}석
                            / 후보 {selectableSeatIds.length}석
                          </span>
                          {activeYes24SeatGroup ? (
                            <span className="truncate">
                              표시 그룹 {activeYes24SeatGroup.label} ·{" "}
                              {activeYes24SeatGroup.zones.length}구역
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {activeYes24SeatGroup &&
                      activeYes24SeatGroupCropBounds &&
                      activeYes24SeatGroupSeats.length > 0 ? (
                        <div className="rounded-md border bg-background p-2">
                          <div
                            className="relative mx-auto bg-background"
                            style={{
                              width: `min(100%, 520px, ${(58 / activeYes24SeatGroupDisplayRatio).toFixed(2)}vh)`,
                              aspectRatio: `${activeYes24SeatGroupCropBounds.width} / ${
                                activeYes24SeatGroupCropBounds.height *
                                seatMapHeightRatio
                              }`,
                            }}
                          >
                            <svg
                              className="absolute inset-0 h-full w-full"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              {activeYes24SeatGroup.zones.map((zone) => {
                                const polygon = getZoneDisplayPolygon(zone);

                                if (!polygon) {
                                  return null;
                                }

                                return (
                                  <polygon
                                    key={zone.id}
                                    points={getPolygonPointsAttribute(
                                      mapPolygonToBounds(
                                        polygon,
                                        activeYes24SeatGroupCropBounds,
                                      ),
                                    )}
                                    className="fill-emerald-400/10 stroke-emerald-700/60"
                                    strokeWidth={0.55}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                );
                              })}
                            </svg>
                            {activeYes24SeatGroupSeats.map((seat) => {
                              const isSelected = selectedSeatId === seat.id;
                              const isCandidate =
                                remainingSelectableSeatIdSet.has(seat.id);
                              const isSoldOut = soldOutSeatIdSet.has(seat.id);
                              const isSelectable =
                                seat.status === "available" && !isCompleting;
                              const mappedPoint = mapPointToBounds(
                                {
                                  x: seat.x,
                                  y: seat.y,
                                },
                                activeYes24SeatGroupCropBounds,
                              );
                              const seatWidthPercent =
                                getYes24GroupSeatWidthPercent(
                                  seat,
                                  activeYes24SeatGroupCropBounds,
                                );

                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  className={[
                                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-[2px] border p-0 text-[0px] leading-none shadow-[0_0_0_1px_rgba(255,255,255,0.95),0_2px_7px_rgba(15,23,42,0.28)] transition",
                                    isSelected
                                      ? "z-20 border-primary bg-primary ring-2 ring-white"
                                      : "",
                                    !isSelected && isCandidate
                                      ? "z-10 border-emerald-950 bg-emerald-400 ring-1 ring-white hover:border-primary hover:bg-primary"
                                      : "",
                                    !isSelected && !isCandidate
                                      ? "border-slate-500 bg-slate-300 opacity-75"
                                      : "",
                                    isSoldOut
                                      ? "border-destructive bg-destructive/70 opacity-85"
                                      : "",
                                  ].join(" ")}
                                  style={{
                                    left: `${mappedPoint.x * 100}%`,
                                    top: `${mappedPoint.y * 100}%`,
                                    width: `min(${YES24_RECT_SEAT_MAX_PIXEL_WIDTH}px, ${seatWidthPercent.toFixed(4)}%)`,
                                    aspectRatio: `${YES24_RECT_SEAT_WIDTH_HEIGHT_RATIO} / 1`,
                                  }}
                                  title={`${seat.zoneName} · ${seat.rowLabel} ${seat.seatNumber}번`}
                                  aria-label={`${seat.zoneName} ${seat.rowLabel} ${seat.seatNumber}번 좌석`}
                                  disabled={!isSelectable}
                                  onClick={() => handleSeatClick(seat)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                          좌석 선택 화면을 준비하지 못했습니다. 좌석 배치도 분석
                          결과를 확인해주세요.
                        </p>
                      )}
                    </div>

                    <div className="rounded-md border bg-secondary p-2.5 xl:max-w-[150px] 2xl:max-w-[160px]">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>공연장 미니맵</span>
                        <span>{yes24SeatGroups.length}그룹</span>
                      </div>

                      {yes24SeatGroups.length > 0 ? (
                        <div className="overflow-hidden rounded-md border bg-background">
                          <div className="relative w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={seatMap.imageUrl}
                              alt="공연장 미니맵"
                              className="block h-auto w-full select-none contrast-75 saturate-75"
                              draggable={false}
                              onLoad={handleSeatMapImageLoad}
                              style={{
                                opacity: DIRECT_SEAT_MAP_IMAGE_OPACITY,
                              }}
                            />
                            <svg
                              className="absolute inset-0 h-full w-full"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              aria-label="공연장 구역 그룹 선택"
                            >
                              {yes24SeatGroups.map((group) => {
                                const isActive =
                                  activeYes24SeatGroup?.id === group.id;

                                return (
                                  <g
                                    key={group.id}
                                    className={[
                                      "cursor-pointer transition",
                                      isActive
                                        ? "fill-primary/30 stroke-primary"
                                        : "fill-emerald-400/15 stroke-emerald-600 hover:fill-emerald-400/25",
                                    ].join(" ")}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${group.label} 그룹`}
                                    onClick={() =>
                                      handleYes24GroupSelect(group)
                                    }
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                      ) {
                                        event.preventDefault();
                                        handleYes24GroupSelect(group);
                                      }
                                    }}
                                  >
                                    <title>{group.label} 그룹</title>
                                    {group.zones.map((zone) => {
                                      const polygon =
                                        getZoneDisplayPolygon(zone);

                                      if (!polygon) {
                                        return null;
                                      }

                                      return (
                                        <polygon
                                          key={zone.id}
                                          points={getPolygonPointsAttribute(
                                            polygon,
                                          )}
                                          strokeWidth={isActive ? 0.9 : 0.55}
                                          vectorEffect="non-scaling-stroke"
                                        />
                                      );
                                    })}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                          미니맵에 표시할 구역 좌표가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                ) : isMelonSeatSelect ? (
                  <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="rounded-md border bg-secondary p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          선택 가능 좌석 {remainingSelectableSeatIds.length}석 /{" "}
                          후보 {selectableSeatIds.length}석
                        </span>
                        {selectedZone ? (
                          <span>
                            선택 구역 {selectedZone.name} · {selectedZone.grade}
                          </span>
                        ) : null}
                      </div>

                      {seatSelectView === "seat" ? (
                        renderNolOldSeatGrid({
                          showResetButton: false,
                        })
                      ) : (
                        <div className="overflow-hidden rounded-md border bg-background">
                          {renderSeatZoneMap({
                            alt: "좌석 배치도",
                            ariaLabel: "멜론 티켓 좌석 구역 선택",
                            showLabels: false,
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border bg-secondary p-3 xl:max-w-[240px]">
                      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>공연장 미니맵</span>
                        <span>{selectedZone?.name ?? "전체"}</span>
                      </div>

                      {zoneOverlays.length > 0 ? (
                        <div
                          ref={melonMiniMapScrollRef}
                          className="max-h-64 cursor-grab overflow-hidden rounded-md border bg-background select-none active:cursor-grabbing"
                          onWheel={handleMelonMiniMapWheel}
                          onMouseDown={handleMelonMiniMapMouseDown}
                          onMouseMove={handleMelonMiniMapMouseMove}
                          onMouseUp={finishMelonMiniMapDrag}
                          onMouseLeave={finishMelonMiniMapDrag}
                        >
                          <div
                            className="relative min-w-full"
                            style={{
                              width: `${melonMiniMapZoom * 100}%`,
                            }}
                          >
                            {renderSeatZoneMap({
                              alt: "공연장 미니맵",
                              ariaLabel: "멜론 티켓 미니맵 구역 선택",
                              onZoneSelect: handleMelonMiniMapZoneSelect,
                              showLabels: false,
                              miniMap: true,
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-md border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                          미니맵에 표시할 구역 좌표가 없습니다.
                        </p>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={handleSeatMapOverview}
                        disabled={isCompleting}
                      >
                        배치도 전체보기
                      </Button>
                    </div>
                  </div>
                ) : isSplitSeatSelect && seatSelectView === "seat" ? (
                  renderNolOldSeatGrid({
                    className: "mt-5",
                  })
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
                              const zoneLabel = formatSeatZoneLabel(
                                zone.name,
                                zone.grade,
                                " ",
                              );

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
                          {zoneOverlays.map((zone) => {
                            const visibleGrade = getVisibleZoneGrade(
                              zone.grade,
                            );
                            const zoneLabel = formatSeatZoneLabel(
                              zone.name,
                              zone.grade,
                              " ",
                            );
                            const zoneTitle = zone.polygon
                              ? zoneLabel
                              : `${zoneLabel} - 외곽선 확인 필요`;

                            return zone.labelPoint ? (
                              <button
                                key={`${zone.id}-label`}
                                type="button"
                                title={zoneTitle}
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
                                {visibleGrade ? (
                                  <span className="block truncate text-muted-foreground">
                                    {visibleGrade}
                                  </span>
                                ) : null}
                                {!zone.polygon ? (
                                  <span className="block truncate text-amber-700">
                                    확인 필요
                                  </span>
                                ) : null}
                              </button>
                            ) : null;
                          })}
                        </div>
                      </div>

                      {!isSplitSeatSelect ? (
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
                                {formatSeatZoneLabel(zone.name, zone.grade)}
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
                      ) : null}
                    </div>

                    {!isSplitSeatSelect ? (
                      <div className="rounded-md border bg-secondary p-3">
                        <div className="mb-3 text-xs text-muted-foreground">
                          <p>
                            전체 남은 좌석 {remainingSelectableSeatIds.length}석
                            / 전체 {selectableSeatIds.length}석
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
                            선택한 구역의 좌석 데이터를 준비하지 못했습니다.
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
                  {result.status === "success"
                    ? "예매 연습 성공"
                    : "예매 연습 실패"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  소요 시간 {(result.elapsedMs / 1000).toFixed(1)}초
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  시작 버튼 반응 시간 {(result.startDelayMs / 1000).toFixed(1)}
                  초
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
                <Link href={`/concerts/${concert.id}`}>
                  공연 상세로 돌아가기
                </Link>
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

      {!isPanelLayout ? (
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
      ) : null}
    </div>
  );
}
