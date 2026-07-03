"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type AnalysisStatus = "pending" | "success" | "failed";

const LOW_CONFIDENCE_THRESHOLD = 0.65;

type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SeatMapAnalysisPanelProps = {
  seatMap: {
    id: string;
    imageUrl: string;
    analysisStatus: AnalysisStatus;
    zones: Array<{
      id: string;
      name: string;
      grade: string;
      bbox: unknown;
      confidence: number | null;
    }>;
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

export function SeatMapAnalysisPanel({ seatMap }: SeatMapAnalysisPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const zones = useMemo(
    () =>
      seatMap.zones
        .map((zone) => ({
          ...zone,
          bbox: parseBbox(zone.bbox),
        }))
        .filter((zone): zone is typeof zone & { bbox: BoundingBox } =>
          Boolean(zone.bbox),
        ),
    [seatMap.zones],
  );
  const canAnalyze =
    seatMap.analysisStatus === "pending" || seatMap.analysisStatus === "failed";

  async function handleAnalyze() {
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
          disabled={!canAnalyze || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <WandSparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {seatMap.analysisStatus === "failed"
            ? "AI 좌석 구역 다시 분석"
            : "AI 좌석 구역 분석 시작"}
        </Button>
      </div>

      {seatMap.analysisStatus === "failed" ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          이전 분석이 실패했습니다. 이미지를 확인한 뒤 다시 분석할 수 있습니다.
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

            return (
              <div
                key={zone.id}
                className={[
                  "absolute border-2 text-[11px] font-medium",
                  lowConfidence
                    ? "border-amber-500 bg-amber-400/15 text-amber-950"
                    : "border-emerald-500 bg-emerald-400/15 text-emerald-950",
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
                  ) : null}
                  <span className="truncate">
                    {zone.name} · {zone.grade}
                    {lowConfidence ? " · 확인 필요" : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {zones.length > 0 ? (
        <div className="mt-4 grid gap-2 text-sm">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="font-medium">
                {zone.name} · {zone.grade}
              </span>
              <span className="text-muted-foreground">
                신뢰도{" "}
                {typeof zone.confidence === "number"
                  ? `${Math.round(zone.confidence * 100)}%`
                  : "확인 필요"}
              </span>
            </div>
          ))}
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
