import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/utils/format";
import {
  getSeatMapStageHref,
  type SeatMapStage,
} from "@/app/concerts/[concertId]/seat-map/seat-map-page-data";

type SeatMapPageShellProps = {
  activeStage: SeatMapStage;
  concert: {
    id: string;
    title: string;
    posterImageUrl: string | null;
    venueName: string;
    startDate: Date;
    endDate: Date;
  };
  latestSeatMap: {
    analysisStatus: string;
  } | null;
  children: ReactNode;
};

type SeatMapStepState = "done" | "active" | "idle";

function SeatMapStep({
  index,
  title,
  description,
  state,
  href,
  disabled = false,
}: {
  index: number;
  title: string;
  description: string;
  state: SeatMapStepState;
  href: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black",
          state === "done"
            ? "border-primary bg-background text-primary"
            : state === "active"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {state === "done" ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          index
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </>
  );

  const className = [
    "flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left transition",
    disabled ? "cursor-not-allowed opacity-55" : "hover:bg-secondary",
  ].join(" ");

  if (disabled) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function SeatMapPageShell({
  activeStage,
  concert,
  latestSeatMap,
  children,
}: SeatMapPageShellProps) {
  const hasSeatMap = Boolean(latestSeatMap);
  const analysisDone = latestSeatMap?.analysisStatus === "success";
  const steps = [
    {
      id: "upload" as const,
      index: 1,
      title: "이미지 업로드",
      description: "배치도 이미지 등록",
      href: getSeatMapStageHref(concert.id, "upload"),
      done: hasSeatMap,
      disabled: false,
    },
    {
      id: "analysis" as const,
      index: 2,
      title: "AI 분석",
      description: "구역 정보 추출",
      href: getSeatMapStageHref(concert.id, "analysis"),
      done: analysisDone,
      disabled: !hasSeatMap,
    },
    {
      id: "edit" as const,
      index: 3,
      title: "구역 수정",
      description: "분석 결과 수정",
      href: getSeatMapStageHref(concert.id, "edit"),
      done: false,
      disabled: !analysisDone,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concerts/${concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          공연 상세
        </Link>
      </Button>

      <section className="mt-5">
        <p className="text-sm font-semibold text-muted-foreground">
          공연 목록 / 배치도 등록
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">
          배치도 등록
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이미지를 업로드하고 AI 분석을 실행한 뒤, 추출된 좌석 구역을 수정할 수
          있습니다.
        </p>

        <div className="mt-7 grid gap-4 rounded-lg border bg-card p-3 shadow-sm lg:grid-cols-3">
          {steps.map((step) => (
            <SeatMapStep
              key={step.id}
              index={step.index}
              title={step.title}
              description={step.description}
              href={step.href}
              disabled={step.disabled}
              state={
                activeStage === step.id ? "active" : step.done ? "done" : "idle"
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-center">
          <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-secondary">
            {concert.posterImageUrl ? (
              <Image
                src={concert.posterImageUrl}
                alt={`${concert.title} 포스터`}
                fill
                sizes="140px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                포스터
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-black">{concert.title}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {concert.venueName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatDateRange(concert.startDate, concert.endDate)}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
          </Button>
        </div>
      </section>

      {children}
    </main>
  );
}
