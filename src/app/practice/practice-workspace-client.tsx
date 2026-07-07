"use client";

import { useCallback, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";

import {
  PracticeClient,
  type PracticePhase,
} from "@/app/concerts/[concertId]/practice/practice-client";

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
    dateLabel: string;
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

function SelectedPracticeConcertInfo({
  concert,
}: {
  concert: PracticeWorkspaceProps["concert"];
}) {
  return (
    <section className="h-full rounded-lg border bg-card p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">공연명</p>
        <h2 className="mt-1.5 whitespace-normal break-words text-xl font-black leading-tight tracking-normal [overflow-wrap:anywhere]">
          {concert.title}
        </h2>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{concert.venueName}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{concert.dateLabel}</span>
        </p>
      </div>
    </section>
  );
}

function RegisteredSeatMapPreview({
  seatMap,
}: {
  seatMap: PracticeWorkspaceSeatMap;
}) {
  return (
    <section className="min-h-0 rounded-lg border bg-card p-4 shadow-sm xl:flex xl:h-full xl:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          선택한 공연에 등록된 좌석 배치도를 확인합니다.
        </p>
        <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
          {getStatusLabel(seatMap.analysisStatus)}
        </span>
      </div>

      <div className="mt-4 max-h-[240px] overflow-auto rounded-lg border bg-secondary xl:min-h-0 xl:flex-1 xl:max-h-none">
        <div className="relative flex min-h-full items-center justify-center bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={seatMap.imageUrl}
            alt="등록한 좌석 배치도"
            className="block h-auto max-h-[240px] w-full object-contain xl:max-h-full"
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
  const showSetupPreview = phase === "setup";
  const handlePhaseChange = useCallback((nextPhase: PracticePhase) => {
    setPhase(nextPhase);
  }, []);

  return (
    <div
      className={[
        "grid gap-6 transition-[grid-template-columns]",
        showSetupPreview
          ? "xl:grid-cols-[minmax(0,1fr)_400px] xl:items-stretch"
          : "xl:grid-cols-1",
      ].join(" ")}
    >
      {showSetupPreview ? (
        <div
          key="setup-preview"
          className="grid min-w-0 gap-4 xl:h-full xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]"
        >
          <SelectedPracticeConcertInfo concert={concert} />
          <RegisteredSeatMapPreview seatMap={seatMap} />
        </div>
      ) : null}

      <div
        key="practice-panel"
        className={
          showSetupPreview ? "min-w-0 xl:sticky xl:top-28" : "min-w-0"
        }
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
