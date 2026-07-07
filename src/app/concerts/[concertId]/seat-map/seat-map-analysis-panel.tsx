"use client";

import {
  FormEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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
const DONUT_RADIUS = 44;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

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

type PolygonDragState = {
  pointer: Point;
  polygon: Point[];
};

type SeatMapAnalysisPanelProps = {
  seatMap: {
    id: string;
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
    totalSeatCount: number | null;
    analysisStatus: AnalysisStatus;
    zones: SeatMapZone[];
  };
  mode: "analysis" | "edit";
  autoAnalyze?: boolean;
  editHref?: string;
  analysisHref?: string;
  practiceHref?: string;
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

function getAnalyzeButtonText(status: AnalysisStatus) {
  if (status === "success") {
    return "AI 좌석 구역 다시 분석";
  }

  if (status === "failed") {
    return "AI 좌석 구역 다시 분석";
  }

  return "AI 좌석 구역 분석 시작";
}

function getImageSpacePolygonPointsAttribute(
  points: Point[],
  imageWidth: number,
  imageHeight: number,
) {
  return points
    .map((point) => `${point.x * imageWidth},${point.y * imageHeight}`)
    .join(" ");
}

export function SeatMapAnalysisPanel({
  seatMap,
  mode,
  autoAnalyze = false,
  editHref,
  analysisHref,
  practiceHref,
}: SeatMapAnalysisPanelProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const autoAnalyzeStartedRef = useRef(false);
  const handleAnalyzeRef = useRef<
    (options?: { skipConfirm?: boolean }) => Promise<void>
  >(async () => {});
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(
    seatMap.analysisStatus === "success" ? 100 : 0,
  );
  const [analyzedZoneCount, setAnalyzedZoneCount] = useState<number | null>(
    null,
  );
  const [isMutating, setIsMutating] = useState(false);
  const [isGeneratingSeats, setIsGeneratingSeats] = useState(false);
  const [totalSeatCount, setTotalSeatCount] = useState(
    seatMap.totalSeatCount ? String(seatMap.totalSeatCount) : "",
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [isEditingPolygon, setIsEditingPolygon] = useState(false);
  const [editablePolygon, setEditablePolygon] = useState<Point[]>([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    null,
  );
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(
    null,
  );
  const [draggingPolygon, setDraggingPolygon] =
    useState<PolygonDragState | null>(null);
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
  const isAnalysisMode = mode === "analysis";
  const isEditMode = mode === "edit";
  const imageWidth =
    typeof seatMap.imageWidth === "number" && seatMap.imageWidth > 0
      ? seatMap.imageWidth
      : 100;
  const imageHeight =
    typeof seatMap.imageHeight === "number" && seatMap.imageHeight > 0
      ? seatMap.imageHeight
      : 100;
  const displayedZoneCount =
    analyzedZoneCount ??
    (seatMap.analysisStatus === "success" ? zones.length : 0);
  const displayedAnalysisProgress = isPending
    ? analysisProgress
    : seatMap.analysisStatus === "success"
      ? 100
      : seatMap.analysisStatus === "failed"
        ? 0
        : analysisProgress;
  const analysisProgressDescription = isPending
    ? "이미지에서 좌석 구역 후보를 추출하는 중입니다."
    : seatMap.analysisStatus === "success"
      ? "분석이 완료되었습니다. 구역 수정 단계에서 결과를 조정할 수 있습니다."
      : seatMap.analysisStatus === "failed"
        ? "분석에 실패했습니다. 다시 분석을 시도해주세요."
        : "업로드 페이지에서 AI 분석하기를 누르면 자동으로 시작됩니다.";
  const donutStrokeOffset =
    DONUT_CIRCUMFERENCE * (1 - displayedAnalysisProgress / 100);

  useEffect(() => {
    if (!isPending) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setAnalysisProgress((currentProgress) => {
        if (currentProgress >= 92) {
          return currentProgress;
        }

        const step = currentProgress < 40 ? 7 : currentProgress < 70 ? 4 : 2;

        return Math.min(currentProgress + step, 92);
      });
    }, 700);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPending, seatMap.analysisStatus]);

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
    setIsEditingPolygon(false);
    setEditablePolygon([]);
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
    setDraggingPolygon(null);
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
    setDraggingPolygon(null);
    setIsEditingPolygon(true);
    setMessage("");
  }

  function cancelPolygonEdit() {
    setIsEditingPolygon(false);
    setEditablePolygon([]);
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
    setDraggingPolygon(null);
  }

  function resetPolygonToBbox() {
    if (!selectedZone) {
      return;
    }

    setEditablePolygon(polygonFromBbox(selectedZone.bbox));
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
    setDraggingPolygon(null);
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

  function getNormalizedPointFromPointer(event: PointerEvent<SVGElement>) {
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
    setDraggingPolygon(null);
  }

  function getTranslatedPolygon(
    polygon: Point[],
    deltaX: number,
    deltaY: number,
  ) {
    const minX = Math.min(...polygon.map((point) => point.x));
    const maxX = Math.max(...polygon.map((point) => point.x));
    const minY = Math.min(...polygon.map((point) => point.y));
    const maxY = Math.max(...polygon.map((point) => point.y));
    const clampedDeltaX = Math.min(Math.max(deltaX, -minX), 1 - maxX);
    const clampedDeltaY = Math.min(Math.max(deltaY, -minY), 1 - maxY);

    return polygon.map((point) => ({
      x: point.x + clampedDeltaX,
      y: point.y + clampedDeltaY,
    }));
  }

  function handlePolygonShapePointerDown(
    event: PointerEvent<SVGPolygonElement | SVGRectElement>,
    zone: AnalyzedSeatMapZone,
  ) {
    const isSelected = selectedZone?.id === zone.id;

    if (!isEditingPolygon || !isSelected) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointer = getNormalizedPointFromPointer(event);

    if (!pointer) {
      return;
    }

    const currentPolygon =
      editablePolygon.length >= 3
        ? editablePolygon
        : getEditablePolygonFromZone(zone);

    setEditablePolygon(currentPolygon);
    setSelectedPointIndex(null);
    setDraggingPointIndex(null);
    setDraggingPolygon({
      pointer,
      polygon: currentPolygon,
    });
  }

  function handlePolygonPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (draggingPointIndex === null && !draggingPolygon) {
      return;
    }

    const nextPoint = getNormalizedPointFromPointer(event);

    if (!nextPoint) {
      return;
    }

    if (draggingPointIndex !== null) {
      setEditablePolygon((currentPolygon) =>
        currentPolygon.map((point, index) =>
          index === draggingPointIndex ? nextPoint : point,
        ),
      );
      return;
    }

    if (draggingPolygon) {
      setEditablePolygon(
        getTranslatedPolygon(
          draggingPolygon.polygon,
          nextPoint.x - draggingPolygon.pointer.x,
          nextPoint.y - draggingPolygon.pointer.y,
        ),
      );
    }
  }

  function stopDraggingPolygonPoint() {
    setDraggingPointIndex(null);
    setDraggingPolygon(null);
  }

  async function handleAnalyze(options: { skipConfirm?: boolean } = {}) {
    if (
      !options.skipConfirm &&
      seatMap.analysisStatus === "success" &&
      zones.length > 0
    ) {
      const confirmed = window.confirm(
        "재분석하면 기존 좌석 구역과 사용자가 수정한 내용이 새 분석 결과로 대체될 수 있습니다. 다시 분석할까요?",
      );

      if (!confirmed) {
        return;
      }
    }

    setAnalysisProgress(8);
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

      setAnalyzedZoneCount(payload.data?.zoneCount ?? 0);
      setAnalysisProgress(100);
      setSelectedZoneId(null);
      setName("");
      setGrade("");
      cancelPolygonEdit();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AI 좌석 구역 분석에 실패했습니다.",
      );
      setAnalysisProgress(0);
    } finally {
      setIsPending(false);
    }
  }

  useEffect(() => {
    handleAnalyzeRef.current = handleAnalyze;
  });

  useEffect(() => {
    if (
      !autoAnalyze ||
      !isAnalysisMode ||
      autoAnalyzeStartedRef.current ||
      seatMap.analysisStatus === "success"
    ) {
      return;
    }

    autoAnalyzeStartedRef.current = true;
    void handleAnalyzeRef.current({
      skipConfirm: true,
    });
  }, [autoAnalyze, isAnalysisMode, seatMap.analysisStatus]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedZone) {
      setMessage("수정할 좌석 구역을 선택해주세요.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedGrade = grade.trim() || "미확인";

    if (!trimmedName) {
      setMessage("구역명을 입력해주세요.");
      return;
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
          price: selectedZone.price,
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
      setDraggingPolygon(null);
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

  function renderZoneEditTools() {
    if (!isEditMode || zones.length === 0) {
      return null;
    }

    return (
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
          </div>

          <div className="mt-4 rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold">구역 외곽선</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  외곽선 안쪽을 드래그해 위치를 옮기거나, 점을 드래그해 실제
                  구역 외곽선에 맞춥니다.
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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

        {practiceHref ? (
          <Button asChild variant="outline" className="h-11">
            <Link href={practiceHref}>
              <Ticket className="h-4 w-4" aria-hidden="true" />
              티켓팅 연습으로 이동
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            현재 상태: {getStatusText(seatMap.analysisStatus)}
          </p>
          <h2 className="mt-1 text-xl font-black">
            {isAnalysisMode ? "AI 좌석 구역 분석" : "좌석 구역 수정"}
          </h2>
        </div>
        {isAnalysisMode ? (
          <Button
            type="button"
            onClick={() => {
              void handleAnalyze();
            }}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isPending
              ? "AI 좌석 구역 분석 중"
              : getAnalyzeButtonText(seatMap.analysisStatus)}
          </Button>
        ) : analysisHref ? (
          <Button asChild variant="outline">
            <Link href={analysisHref}>
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
              AI 분석으로 돌아가기
            </Link>
          </Button>
        ) : null}
      </div>

      {isEditMode &&
      seatMap.analysisStatus === "success" &&
      zones.length > 0 ? (
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

      <div
        className={
          isAnalysisMode
            ? "mt-4 grid gap-4 lg:grid-cols-2 lg:items-stretch"
            : isEditMode
              ? "mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
              : "mt-5"
        }
      >
        {isAnalysisMode ? (
          <section className="flex h-[clamp(240px,calc(100vh-540px),360px)] flex-col justify-between rounded-lg border bg-secondary/80 p-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                AI 분석 진행률
              </p>
              <div className="mt-5 flex justify-center">
                <div className="relative h-32 w-32">
                  <svg
                    className="h-full w-full -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r={DONUT_RADIUS}
                      className="fill-none stroke-background"
                      strokeWidth="9"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={DONUT_RADIUS}
                      className="fill-none stroke-primary transition-all duration-500"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={DONUT_CIRCUMFERENCE}
                      strokeDashoffset={donutStrokeOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-primary">
                      {displayedAnalysisProgress}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-center text-sm leading-6 text-muted-foreground">
                {analysisProgressDescription}
              </p>
            </div>

            <div className="grid gap-2">
              {displayedZoneCount > 0 ? (
                <p className="rounded-md border bg-background px-3 py-2 text-center text-sm font-semibold">
                  {displayedZoneCount.toLocaleString("ko-KR")}개 구역 추출 완료
                </p>
              ) : null}
              {message ? (
                <p className="line-clamp-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {message}
                </p>
              ) : null}
              {displayedZoneCount > 0 && editHref ? (
                <Button asChild className="w-full">
                  <Link href={editHref}>구역 수정으로 이동</Link>
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        <div
          className={[
            "overflow-hidden rounded-lg border bg-secondary",
            isAnalysisMode ? "h-[clamp(240px,calc(100vh-540px),360px)]" : "",
          ].join(" ")}
        >
          <div className="relative h-full">
            {/* Keep the rendered bitmap and polygon overlay in the same coordinate space. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seatMap.imageUrl}
              alt="업로드된 좌석 배치도"
              className={
                isAnalysisMode
                  ? "block h-full w-full object-contain"
                  : "block h-auto w-full"
              }
            />
            <svg
              ref={svgRef}
              className="absolute inset-0 h-full w-full touch-none"
              viewBox={
                isAnalysisMode
                  ? `0 0 ${imageWidth} ${imageHeight}`
                  : "0 0 100 100"
              }
              preserveAspectRatio={isAnalysisMode ? "xMidYMid meet" : "none"}
              aria-label="좌석 구역 외곽선"
              onPointerMove={handlePolygonPointerMove}
              onPointerUp={stopDraggingPolygonPoint}
              onPointerLeave={stopDraggingPolygonPoint}
            >
              {zones.map((zone) => {
                const lowConfidence =
                  isLowConfidence(zone.confidence) || zone.needsGeometryReview;
                const isSelected = selectedZone?.id === zone.id;
                const isLockedDuringPolygonEdit =
                  isEditingPolygon && !isSelected;
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
                        : isSelected && isEditingPolygon
                          ? "cursor-move"
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
                    onClick={() => {
                      if (isSelected && isEditingPolygon) {
                        return;
                      }

                      selectZone(zone);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectZone(zone);
                      }
                    }}
                  >
                    <title>
                      {`${zone.name} ${zone.grade}${zone.needsGeometryReview ? " - 외곽선 확인 필요" : ""}`}
                    </title>
                    {points ? (
                      <polygon
                        onPointerDown={(event) =>
                          handlePolygonShapePointerDown(event, zone)
                        }
                        points={
                          isAnalysisMode
                            ? getImageSpacePolygonPointsAttribute(
                                points,
                                imageWidth,
                                imageHeight,
                              )
                            : getPolygonPointsAttribute(points)
                        }
                        strokeWidth={isSelected ? 0.9 : 0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <rect
                        onPointerDown={(event) =>
                          handlePolygonShapePointerDown(event, zone)
                        }
                        x={zone.bbox.x * (isAnalysisMode ? imageWidth : 100)}
                        y={zone.bbox.y * (isAnalysisMode ? imageHeight : 100)}
                        width={
                          zone.bbox.width * (isAnalysisMode ? imageWidth : 100)
                        }
                        height={
                          zone.bbox.height *
                          (isAnalysisMode ? imageHeight : 100)
                        }
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
                      cx={point.x * (isAnalysisMode ? imageWidth : 100)}
                      cy={point.y * (isAnalysisMode ? imageHeight : 100)}
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

              if (isAnalysisMode || (isEditingPolygon && !isSelected)) {
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

        {renderZoneEditTools()}
      </div>

      {zones.length === 0 && isEditMode ? (
        <p className="mt-4 text-sm text-muted-foreground">
          수정할 구역이 없습니다. AI 분석 페이지에서 구역을 먼저 추출해주세요.
        </p>
      ) : null}

      {!isAnalysisMode && message ? (
        <p className="mt-4 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
