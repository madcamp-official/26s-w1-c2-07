"use client";

import { FormEvent, PointerEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Ticket,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getBboxCenter,
  getPolygonCenter,
  getPolygonPointsAttribute,
  isBboxCornerPolygon,
  normalizePolygon,
  parseBbox,
  parsePolygon,
  polygonFromBbox,
  type BoundingBox,
  type Point,
} from "@/lib/seat-zone-geometry";

type AnalysisStatus = "pending" | "success" | "failed";

const LOW_CONFIDENCE_THRESHOLD = 0.65;
const MAX_TOTAL_SEAT_COUNT = 50_000;

type SeatMapZone = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
  allocatedSeatCount: number | null;
  bbox: unknown;
  polygon: unknown;
  confidence: number | null;
  isAiGenerated: boolean;
};

type AnalyzedSeatMapZone = Omit<SeatMapZone, "bbox" | "polygon"> & {
  bbox: BoundingBox;
  polygon: Point[] | null;
  labelPoint: Point;
  needsGeometryReview: boolean;
};

type SeatMapAnalysisPanelProps = {
  seatMap: {
    id: string;
    imageUrl: string;
    totalSeatCount: number | null;
    analysisStatus: AnalysisStatus;
    zones: SeatMapZone[];
  };
};

type AnalyzeResponse = {
  data?: {
    zoneCount?: number;
  };
  error?: {
    message?: string;
  };
};

type ZoneMutationResponse = {
  error?: {
    message?: string;
  };
};

type SeatGenerationResponse = {
  data?: {
    totalSeatCount?: number;
    zoneCount?: number;
    seatCount?: number;
  };
  error?: {
    message?: string;
  };
};

function getStatusText(status: AnalysisStatus) {
  if (status === "success") {
    return "분석 완료";
  }

  if (status === "failed") {
    return "분석 실패";
  }

  return "분석 대기";
}

function isLowConfidence(confidence: number | null) {
  return confidence === null || confidence < LOW_CONFIDENCE_THRESHOLD;
}

function formatPrice(price: number | null) {
  return typeof price === "number"
    ? `${price.toLocaleString("ko-KR")}원`
    : "가격 미입력";
}

function getAnalyzeButtonText(status: AnalysisStatus) {
  if (status === "success") {
    return "AI 좌석 구역 다시 분석";
  }

  if (status === "failed") {
    return "AI 좌석 구역 다시 분석";
  }

  return "AI 좌석 구역 분석 시작";
}

export function SeatMapAnalysisPanel({ seatMap }: SeatMapAnalysisPanelProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isGeneratingSeats, setIsGeneratingSeats] = useState(false);
  const [totalSeatCount, setTotalSeatCount] = useState(
    seatMap.totalSeatCount ? String(seatMap.totalSeatCount) : "",
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [price, setPrice] = useState("");
  const [isEditingPolygon, setIsEditingPolygon] = useState(false);
  const [editablePolygon, setEditablePolygon] = useState<Point[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null,
  );
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(
    null,
  );
  const zones = useMemo(
    () =>
      seatMap.zones
        .map((zone) => {
          const bbox = parseBbox(zone.bbox);
          const parsedPolygon = parsePolygon(zone.polygon);
          const polygon =
            parsedPolygon && bbox && !isBboxCornerPolygon(parsedPolygon, bbox)
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
            needsGeometryReview: !polygon,
          };
        })
        .filter((zone): zone is AnalyzedSeatMapZone => Boolean(zone.bbox)),
    [seatMap.zones],
  );
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const minimumSeatCount = zones.length;

  function selectZone(zone: AnalyzedSeatMapZone) {
    if (isEditingPolygon && zone.id !== selectedZoneId) {
      setMessage(
        "외곽선 편집 중에는 다른 구역을 선택할 수 없습니다. 저장하거나 취소한 뒤 이동해주세요.",
      );
      return;
    }

    setSelectedZoneId(zone.id);
    setName(zone.name);
    setGrade(zone.grade);
    setPrice(typeof zone.price === "number" ? String(zone.price) : "");
    setIsEditingPolygon(false);
    setEditablePolygon([]);
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
  }

  function getEditablePolygonFromZone(zone: AnalyzedSeatMapZone) {
    return zone.polygon?.length ? zone.polygon : polygonFromBbox(zone.bbox);
  }

  function startPolygonEdit() {
    if (!selectedZone) {
      setMessage("외곽선을 수정할 좌석 구역을 선택해주세요.");
      return;
    }

    setEditablePolygon(getEditablePolygonFromZone(selectedZone));
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
    setIsEditingPolygon(true);
    setMessage("");
  }

  function cancelPolygonEdit() {
    setIsEditingPolygon(false);
    setEditablePolygon([]);
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
  }

  function resetPolygonToBbox() {
    if (!selectedZone) {
      return;
    }

    setEditablePolygon(polygonFromBbox(selectedZone.bbox));
    setSelectedPointIndex(null);
    setMessage("bbox 기준 사각형 외곽선으로 초기화했습니다.");
  }

  function addPolygonPoint() {
    if (!selectedZone) {
      return;
    }

    const currentPolygon =
      editablePolygon.length >= 3
        ? editablePolygon
        : getEditablePolygonFromZone(selectedZone);
    const insertAfterIndex =
      selectedPointIndex !== null
        ? selectedPointIndex
        : currentPolygon.length - 1;
    const nextIndex = (insertAfterIndex + 1) % currentPolygon.length;
    const currentPoint = currentPolygon[insertAfterIndex];
    const nextPoint = currentPolygon[nextIndex];
    const pointToInsert = {
      x: (currentPoint.x + nextPoint.x) / 2,
      y: (currentPoint.y + nextPoint.y) / 2,
    };
    const nextPolygon = [
      ...currentPolygon.slice(0, insertAfterIndex + 1),
      pointToInsert,
      ...currentPolygon.slice(insertAfterIndex + 1),
    ];

    setEditablePolygon(normalizePolygon(nextPolygon));
    setSelectedPointIndex(insertAfterIndex + 1);
    setIsEditingPolygon(true);
  }

  function deleteSelectedPolygonPoint() {
    if (selectedPointIndex === null) {
      setMessage("삭제할 외곽선 점을 선택해주세요.");
      return;
    }

    if (editablePolygon.length <= 3) {
      setMessage("외곽선은 최소 3개 점이 필요합니다.");
      return;
    }

    setEditablePolygon((currentPolygon) =>
      currentPolygon.filter((_, index) => index !== selectedPointIndex),
    );
    setSelectedPointIndex(null);
  }

  function getNormalizedPointFromPointer(
    event: PointerEvent<SVGSVGElement | SVGCircleElement>,
  ) {
    const svgElement = svgRef.current;

    if (!svgElement) {
      return null;
    }

    const rect = svgElement.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function handlePolygonPointPointerDown(
    event: PointerEvent<SVGCircleElement>,
    pointIndex: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPointIndex(pointIndex);
    setDraggingPointIndex(pointIndex);
  }

  function handlePolygonPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (draggingPointIndex === null) {
      return;
    }

    const nextPoint = getNormalizedPointFromPointer(event);

    if (!nextPoint) {
      return;
    }

    setEditablePolygon((currentPolygon) =>
      currentPolygon.map((point, index) =>
        index === draggingPointIndex ? nextPoint : point,
      ),
    );
  }

  function stopDraggingPolygonPoint() {
    setDraggingPointIndex(null);
  }

  async function handleAnalyze() {
    if (seatMap.analysisStatus === "success" && zones.length > 0) {
      const confirmed = window.confirm(
        "재분석하면 기존 좌석 구역과 사용자가 수정한 내용이 새 분석 결과로 대체될 수 있습니다. 다시 분석할까요?",
      );

      if (!confirmed) {
        return;
      }
    }

    setIsPending(true);
    setMessage("");

    try {
      const response = await fetch(`/api/seat-maps/${seatMap.id}/analyze`, {
        method: "POST",
      });
      const payload = (await response.json()) as AnalyzeResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "AI 좌석 구역 분석에 실패했습니다.",
        );
      }

      setMessage(
        `${payload.data?.zoneCount ?? 0}개의 좌석 구역을 저장했습니다. 전체 좌석 수를 입력하면 좌석 데이터를 생성할 수 있습니다.`,
      );
      setSelectedZoneId(null);
      setName("");
      setGrade("");
      setPrice("");
      cancelPolygonEdit();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI 좌석 구역 분석에 실패했습니다.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedZone) {
      setMessage("수정할 좌석 구역을 선택해주세요.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedGrade = grade.trim() || "미확인";
    const trimmedPrice = price.trim();
    let parsedPrice: number | null = null;

    if (!trimmedName) {
      setMessage("구역명을 입력해주세요.");
      return;
    }

    if (trimmedPrice.length > 0) {
      parsedPrice = Number.parseInt(trimmedPrice, 10);

      if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
        setMessage("가격은 0 이상의 정수로 입력해주세요.");
        return;
      }
    }

    if (isEditingPolygon && editablePolygon.length < 3) {
      setMessage("외곽선은 최소 3개 점이 필요합니다.");
      return;
    }

    setIsMutating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/seat-zones/${selectedZone.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          grade: trimmedGrade,
          price: parsedPrice,
          ...(isEditingPolygon
            ? {
                polygon: normalizePolygon(editablePolygon),
              }
            : {}),
        }),
      });
      const payload = (await response.json()) as ZoneMutationResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "좌석 구역 수정에 실패했습니다.",
        );
      }

      setMessage(
        isEditingPolygon
          ? "좌석 구역 정보를 저장했습니다. 외곽선을 수정했으므로 전체 좌석 수를 다시 입력해 좌석 데이터를 생성해주세요."
          : "좌석 구역 정보를 저장했습니다.",
      );
      setIsEditingPolygon(false);
      setEditablePolygon([]);
      setSelectedPointIndex(null);
      setDraggingPointIndex(null);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "좌석 구역 수정에 실패했습니다.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleGenerateSeats(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (zones.length === 0) {
      setMessage("좌석을 배분할 구역이 없습니다.");
      return;
    }

    const parsedTotalSeatCount = Number.parseInt(totalSeatCount, 10);

    if (!Number.isInteger(parsedTotalSeatCount)) {
      setMessage("전체 좌석 수는 정수로 입력해주세요.");
      return;
    }

    if (parsedTotalSeatCount < minimumSeatCount) {
      setMessage(
        `전체 좌석 수는 현재 좌석 구역 수(${minimumSeatCount}개) 이상이어야 합니다.`,
      );
      return;
    }

    if (parsedTotalSeatCount > MAX_TOTAL_SEAT_COUNT) {
      setMessage(
        `전체 좌석 수는 ${MAX_TOTAL_SEAT_COUNT.toLocaleString("ko-KR")}석 이하만 입력할 수 있습니다.`,
      );
      return;
    }

    setIsGeneratingSeats(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/seat-maps/${seatMap.id}/virtual-seats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            totalSeatCount: parsedTotalSeatCount,
            overwrite: true,
          }),
        },
      );
      const payload = (await response.json()) as SeatGenerationResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "좌석 데이터 생성에 실패했습니다.",
        );
      }

      setMessage(
        `${payload.data?.zoneCount ?? zones.length}개 구역에 ${payload.data?.seatCount ?? parsedTotalSeatCount}개의 좌석 데이터를 배분했습니다.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "좌석 데이터 생성에 실패했습니다.",
      );
    } finally {
      setIsGeneratingSeats(false);
    }
  }

  async function handleDelete() {
    if (!selectedZone) {
      setMessage("삭제할 좌석 구역을 선택해주세요.");
      return;
    }

    const confirmed = window.confirm(
      `${selectedZone.name} 구역을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setIsMutating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/seat-zones/${selectedZone.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ZoneMutationResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "좌석 구역 삭제에 실패했습니다.",
        );
      }

      setSelectedZoneId(null);
      setName("");
      setGrade("");
      setPrice("");
      cancelPolygonEdit();
      setMessage("좌석 구역을 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "좌석 구역 삭제에 실패했습니다.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            현재 상태: {getStatusText(seatMap.analysisStatus)}
          </p>
          <h2 className="mt-1 text-xl font-black">AI 좌석 구역 분석</h2>
        </div>
        <Button type="button" onClick={handleAnalyze} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <WandSparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {getAnalyzeButtonText(seatMap.analysisStatus)}
        </Button>
      </div>

      {seatMap.analysisStatus === "failed" ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          이전 분석이 실패했습니다. 이미지를 확인한 뒤 다시 분석할 수 있습니다.
        </p>
      ) : null}

      {seatMap.analysisStatus === "success" && zones.length > 0 ? (
        <p className="mt-4 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          재분석하면 현재 좌석 구역과 사용자가 수정한 내용이 새 분석 결과로
          대체됩니다.
        </p>
      ) : null}

      {seatMap.analysisStatus === "success" && zones.length > 0 ? (
        <form
          className="mt-4 rounded-lg border bg-secondary/80 p-4"
          onSubmit={handleGenerateSeats}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_180px] lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">전체 좌석 수 기반 생성</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                입력한 전체 좌석 수를 구역 외곽선 크기에 비례해 배분합니다. 현재
                허용 범위는 {minimumSeatCount.toLocaleString("ko-KR")}석 이상,{" "}
                {MAX_TOTAL_SEAT_COUNT.toLocaleString("ko-KR")}석 이하입니다.
              </p>
              {seatMap.totalSeatCount ? (
                <p className="mt-2 text-sm font-medium text-primary">
                  저장된 전체 좌석 수:{" "}
                  {seatMap.totalSeatCount.toLocaleString("ko-KR")}석
                </p>
              ) : null}
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              전체 좌석 수
              <input
                className="h-11 rounded-md border bg-background px-3 text-sm"
                inputMode="numeric"
                min={minimumSeatCount}
                max={MAX_TOTAL_SEAT_COUNT}
                value={totalSeatCount}
                placeholder="예: 15000"
                onChange={(event) =>
                  setTotalSeatCount(event.target.value.replace(/[^0-9]/g, ""))
                }
                disabled={isGeneratingSeats}
              />
            </label>
            <Button
              type="submit"
              className="h-11"
              disabled={!totalSeatCount || isGeneratingSeats}
            >
              {isGeneratingSeats ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              좌석 생성
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border bg-secondary">
        <div className="relative">
          {/* Keep the rendered bitmap and polygon overlay in the same coordinate space. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seatMap.imageUrl}
            alt="업로드된 좌석 배치도"
            className="block h-auto w-full"
          />
          <svg
            ref={svgRef}
            className="absolute inset-0 h-full w-full touch-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-label="좌석 구역 외곽선"
            onPointerMove={handlePolygonPointerMove}
            onPointerUp={stopDraggingPolygonPoint}
            onPointerLeave={stopDraggingPolygonPoint}
          >
            {zones.map((zone) => {
              const lowConfidence =
                isLowConfidence(zone.confidence) || zone.needsGeometryReview;
              const isSelected = selectedZone?.id === zone.id;
              const isLockedDuringPolygonEdit = isEditingPolygon && !isSelected;
              const points =
                isSelected && isEditingPolygon && editablePolygon.length >= 3
                  ? editablePolygon
                  : zone.polygon;

              return (
                <g
                  key={zone.id}
                  className={[
                    "transition",
                    isLockedDuringPolygonEdit
                      ? "pointer-events-none opacity-35"
                      : "cursor-pointer",
                    isSelected && !lowConfidence
                      ? "fill-primary/25 stroke-primary"
                      : isSelected && lowConfidence
                        ? "fill-amber-400/25 stroke-amber-600"
                        : lowConfidence
                          ? "fill-amber-400/15 stroke-amber-500 hover:fill-amber-400/25"
                          : "fill-emerald-400/15 stroke-emerald-500 hover:fill-emerald-400/25",
                  ].join(" ")}
                  role="button"
                  tabIndex={isLockedDuringPolygonEdit ? -1 : 0}
                  aria-disabled={isLockedDuringPolygonEdit}
                  aria-label={`${zone.name} ${zone.grade}`}
                  onClick={() => selectZone(zone)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectZone(zone);
                    }
                  }}
                >
                  <title>
                    {zone.name} {zone.grade}
                    {zone.needsGeometryReview ? " - 외곽선 확인 필요" : ""}
                  </title>
                  {points ? (
                    <polygon
                      points={getPolygonPointsAttribute(points)}
                      strokeWidth={isSelected ? 0.9 : 0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <rect
                      x={zone.bbox.x * 100}
                      y={zone.bbox.y * 100}
                      width={zone.bbox.width * 100}
                      height={zone.bbox.height * 100}
                      strokeWidth={isSelected ? 0.9 : 0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              );
            })}

            {isEditingPolygon
              ? editablePolygon.map((point, index) => (
                  <circle
                    key={`${index}-${point.x}-${point.y}`}
                    cx={point.x * 100}
                    cy={point.y * 100}
                    r={selectedPointIndex === index ? 1.5 : 1.1}
                    className={[
                      "cursor-grab stroke-background",
                      selectedPointIndex === index
                        ? "fill-primary"
                        : "fill-background",
                    ].join(" ")}
                    strokeWidth={0.45}
                    vectorEffect="non-scaling-stroke"
                    onPointerDown={(event) =>
                      handlePolygonPointPointerDown(event, index)
                    }
                  />
                ))
              : null}
          </svg>

          {zones.map((zone) => {
            const isSelected = selectedZone?.id === zone.id;

            if (isEditingPolygon && !isSelected) {
              return null;
            }

            return (
              <button
                key={`${zone.id}-label`}
                type="button"
                title={
                  zone.needsGeometryReview
                    ? `${zone.name} ${zone.grade} - 외곽선 확인 필요`
                    : `${zone.name} ${zone.grade}`
                }
                className={[
                  "absolute z-10 max-w-40 rounded-md border bg-background/95 px-2 py-1 text-left text-[11px] font-medium shadow-sm transition",
                  isEditingPolygon ? "pointer-events-none opacity-80" : "",
                  isSelected && !zone.needsGeometryReview
                    ? "border-primary text-primary"
                    : isSelected
                      ? "border-amber-600 text-amber-700"
                      : zone.needsGeometryReview
                        ? "border-amber-400 text-amber-700 hover:border-amber-600"
                        : "hover:border-primary/60",
                ].join(" ")}
                style={{
                  left: `${zone.labelPoint.x * 100}%`,
                  top: `${zone.labelPoint.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => selectZone(zone)}
              >
                <span className="block truncate">
                  {zone.name} · {zone.grade}
                </span>
                {zone.needsGeometryReview ? (
                  <span className="block truncate text-amber-700">
                    확인 필요
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {zones.length > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2 text-sm">
            {zones.map((zone) => {
              const lowConfidence =
                isLowConfidence(zone.confidence) || zone.needsGeometryReview;
              const isSelected = selectedZone?.id === zone.id;
              const isLockedDuringPolygonEdit = isEditingPolygon && !isSelected;

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(zone)}
                  disabled={isLockedDuringPolygonEdit}
                  className={[
                    "flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left transition",
                    isSelected ? "border-primary bg-primary/5" : "",
                    isLockedDuringPolygonEdit
                      ? "cursor-not-allowed opacity-45"
                      : "hover:border-primary/60",
                  ].join(" ")}
                >
                  <span className="font-medium">
                    {zone.name} · {zone.grade}
                    {!zone.isAiGenerated ? (
                      <span className="ml-2 text-xs text-primary">
                        사용자 수정됨
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {formatPrice(zone.price)} · 신뢰도{" "}
                    {typeof zone.confidence === "number"
                      ? `${Math.round(zone.confidence * 100)}%`
                      : "확인 필요"}
                    {zone.allocatedSeatCount
                      ? ` · 배분 ${zone.allocatedSeatCount.toLocaleString("ko-KR")}석`
                      : ""}
                    {lowConfidence ? " · 확인 필요" : ""}
                    {zone.needsGeometryReview ? " · 외곽선 확인 필요" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            <form
              className="rounded-lg border bg-secondary/80 p-4"
              onSubmit={handleSave}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">선택 구역 수정</h3>
                  {selectedZone ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedZone.name} · {selectedZone.grade}
                    </p>
                  ) : null}
                </div>
                {selectedZone &&
                (isLowConfidence(selectedZone.confidence) ||
                  selectedZone.needsGeometryReview) ? (
                  <span className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900">
                    확인 필요
                  </span>
                ) : null}
              </div>

              {selectedZone?.needsGeometryReview ? (
                <p className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-900">
                  이 구역은 정밀 외곽선이 없어 bbox 기준 사각형으로 표시되고
                  있습니다. 외곽선을 수정해 저장하면 티켓팅 연습과 리뷰에
                  반영됩니다.
                </p>
              ) : null}

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5 text-sm font-medium">
                  구역명
                  <input
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={name}
                    maxLength={50}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!selectedZone || isMutating}
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-medium">
                  등급
                  <input
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={grade}
                    maxLength={30}
                    placeholder="미확인, VIP, R, S, A"
                    onChange={(event) => setGrade(event.target.value)}
                    disabled={!selectedZone || isMutating}
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-medium">
                  가격
                  <input
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={price}
                    placeholder="예: 165000"
                    onChange={(event) =>
                      setPrice(event.target.value.replace(/[^0-9]/g, ""))
                    }
                    disabled={!selectedZone || isMutating}
                  />
                </label>
              </div>

              <div className="mt-4 rounded-md border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">구역 외곽선</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      점을 드래그해 실제 구역 외곽선에 맞춥니다.
                    </p>
                  </div>
                  {!isEditingPolygon ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startPolygonEdit}
                      disabled={!selectedZone || isMutating}
                    >
                      외곽선 수정
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelPolygonEdit}
                      disabled={isMutating}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      취소
                    </Button>
                  )}
                </div>

                {isEditingPolygon ? (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPolygonPoint}
                        disabled={isMutating}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />점 추가
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={deleteSelectedPolygonPoint}
                        disabled={isMutating || selectedPointIndex === null}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />점 삭제
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetPolygonToBbox}
                        disabled={isMutating}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        bbox로 초기화
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      현재 {editablePolygon.length}개 점
                      {selectedPointIndex !== null
                        ? ` · 선택 점 ${selectedPointIndex + 1}`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedZone?.polygon
                      ? `${selectedZone.polygon.length}개 점으로 저장된 외곽선을 사용 중입니다.`
                      : "정밀 외곽선이 없어 bbox 기준 사각형을 사용 중입니다."}
                  </p>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button type="submit" disabled={!selectedZone || isMutating}>
                  {isMutating ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  저장
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={!selectedZone || isMutating}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  삭제
                </Button>
              </div>
            </form>

            <section className="rounded-md border bg-secondary p-4">
              <h3 className="font-semibold">티켓팅 연습 반영</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedZone
                  ? `${selectedZone.name} 구역은 저장된 외곽선과 크기를 기준으로 좌석 선택 연습에 자동 반영됩니다.`
                  : "좌석 구역을 선택하면 연습 화면에 반영될 기준 정보를 확인할 수 있습니다."}
              </p>
            </section>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          분석을 실행하면 좌석 배치도 위에 구역 후보가 표시됩니다.
        </p>
      )}

      {message ? (
        <p className="mt-4 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
