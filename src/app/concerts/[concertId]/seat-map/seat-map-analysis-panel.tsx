"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type AnalysisStatus = "pending" | "success" | "failed";

const LOW_CONFIDENCE_THRESHOLD = 0.65;

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SeatMapZone = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
  bbox: unknown;
  confidence: number | null;
  isAiGenerated: boolean;
};

type AnalyzedSeatMapZone = Omit<SeatMapZone, "bbox"> & {
  bbox: BoundingBox;
};

type SeatMapAnalysisPanelProps = {
  seatMap: {
    id: string;
    imageUrl: string;
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

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseBbox(value: unknown): BoundingBox | null {
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

  if (x < 0 || x > 1 || y < 0 || y > 1 || width > 1 || height > 1) {
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
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [price, setPrice] = useState("");
  const zones = useMemo(
    () =>
      seatMap.zones
        .map((zone) => ({
          ...zone,
          bbox: parseBbox(zone.bbox),
        }))
        .filter((zone): zone is AnalyzedSeatMapZone => Boolean(zone.bbox)),
    [seatMap.zones],
  );
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  function selectZone(zone: AnalyzedSeatMapZone) {
    setSelectedZoneId(zone.id);
    setName(zone.name);
    setGrade(zone.grade);
    setPrice(typeof zone.price === "number" ? String(zone.price) : "");
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
        `${payload.data?.zoneCount ?? 0}개의 좌석 구역 후보를 저장했습니다.`,
      );
      setSelectedZoneId(null);
      setName("");
      setGrade("");
      setPrice("");
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
        }),
      });
      const payload = (await response.json()) as ZoneMutationResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "좌석 구역 수정에 실패했습니다.",
        );
      }

      setMessage("좌석 구역 정보를 저장했습니다.");
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
    <section className="rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            현재 상태: {getStatusText(seatMap.analysisStatus)}
          </p>
          <h2 className="mt-1 text-xl font-semibold">AI 좌석 구역 분석</h2>
        </div>
        <Button
          type="button"
          onClick={handleAnalyze}
          disabled={isPending}
        >
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

      <div className="mt-5 overflow-hidden rounded-md border bg-secondary">
        <div className="relative">
          {/* Keep the rendered bitmap and bbox overlay in the same coordinate space. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seatMap.imageUrl}
            alt="업로드된 좌석 배치도"
            className="block h-auto w-full"
          />
          {zones.map((zone) => {
            const lowConfidence = isLowConfidence(zone.confidence);
            const isSelected = selectedZone?.id === zone.id;

            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => selectZone(zone)}
                className={[
                  "absolute border-2 text-left text-[11px] font-medium outline-none transition",
                  isSelected
                    ? "border-primary bg-primary/20 ring-2 ring-primary/60"
                    : lowConfidence
                      ? "border-amber-500 bg-amber-400/15"
                      : "border-emerald-500 bg-emerald-400/15",
                ].join(" ")}
                style={{
                  left: `${zone.bbox.x * 100}%`,
                  top: `${zone.bbox.y * 100}%`,
                  width: `${zone.bbox.width * 100}%`,
                  height: `${zone.bbox.height * 100}%`,
                }}
              >
                <span className="inline-flex max-w-full items-center gap-1 bg-background/90 px-1.5 py-1 text-foreground shadow-sm">
                  {lowConfidence ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : !zone.isAiGenerated ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                  <span className="truncate">
                    {zone.name} · {zone.grade}
                    {lowConfidence
                      ? " · 확인 필요"
                      : !zone.isAiGenerated
                        ? " · 수정됨"
                        : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {zones.length > 0 ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2 text-sm">
            {zones.map((zone) => {
              const lowConfidence = isLowConfidence(zone.confidence);
              const isSelected = selectedZone?.id === zone.id;

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(zone)}
                  className={[
                    "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition",
                    isSelected ? "border-primary bg-primary/5" : "",
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
                    {lowConfidence ? " · 확인 필요" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            className="rounded-md border bg-secondary p-4"
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
              {selectedZone && isLowConfidence(selectedZone.confidence) ? (
                <span className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900">
                  확인 필요
                </span>
              ) : null}
            </div>

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
