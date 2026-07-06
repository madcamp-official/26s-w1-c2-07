"use client";

import { useCallback, useState } from "react";

import {
  PracticeClient,
  type PracticePhase,
} from "@/app/concerts/[concertId]/practice/practice-client";
import { cn } from "@/lib/utils";

type PracticeWorkspaceSeatMap = {
  id: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  analysisStatus: "pending" | "success" | "failed";
};

type PracticeWorkspaceProps = {
  concert: {
    id: string;
    title: string;
    artist: string;
    venueName: string;
    region: string;
    priceMin: number;
    priceMax: number;
  };
  schedules: {
    id: string;
    performanceDate: string;
    roundName: string;
    startTime: string;
  }[];
  seatMap: PracticeWorkspaceSeatMap;
  zones: {
    id: string;
    name: string;
    grade: string;
    price: number | null;
    bbox: unknown;
    polygon: unknown;
    virtualSeats: {
      id: string;
      rowLabel: string;
      seatNumber: number;
      status: "available" | "sold" | "disabled";
      zoneId: string;
      x: number | null;
      y: number | null;
    }[];
  }[];
};

function getStatusLabel(status: PracticeWorkspaceSeatMap["analysisStatus"]) {
  if (status === "success") {
    return "분석 완료";
  }

  if (status === "failed") {
    return "분석 실패";
  }

  return "분석 대기";
}

function SeatMapPreview({ seatMap }: { seatMap: PracticeWorkspaceSeatMap }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          선택한 공연에 등록된 좌석 배치도를 확인합니다.
        </p>
        <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
          {getStatusLabel(seatMap.analysisStatus)}
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border bg-secondary">
        <div className="relative bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seatMap.imageUrl}
            alt="등록한 좌석 배치도"
            className="block h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}

export function PracticeWorkspaceClient({
  concert,
  schedules,
  seatMap,
  zones,
}: PracticeWorkspaceProps) {
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const showSeatMapPreview = phase === "setup";
  const handlePhaseChange = useCallback((nextPhase: PracticePhase) => {
    setPhase(nextPhase);
  }, []);

  return (
    <div
      className={cn(
        "grid items-start gap-6 transition-[grid-template-columns]",
        showSeatMapPreview
          ? "xl:grid-cols-[minmax(0,1fr)_400px]"
          : "xl:grid-cols-1",
      )}
    >
      {showSeatMapPreview ? <SeatMapPreview seatMap={seatMap} /> : null}
      <div
        className={cn(
          "min-w-0",
          showSeatMapPreview ? "xl:sticky xl:top-28" : "w-full",
        )}
      >
        <PracticeClient
          layout="panel"
          concert={concert}
          schedules={schedules}
          seatMap={{
            id: seatMap.id,
            imageUrl: seatMap.imageUrl,
            imageWidth: seatMap.imageWidth,
            imageHeight: seatMap.imageHeight,
          }}
          zones={zones}
          onPhaseChange={handlePhaseChange}
        />
      </div>
    </div>
  );
}
