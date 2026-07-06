import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ImageUp,
  MapPin,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RegisteredConcertSummary } from "@/lib/registered-concerts";
import { formatDateRange } from "@/utils/format";

type WorkspaceMode = "practice" | "reviews";

type RegisteredConcertWorkspaceProps = {
  mode: WorkspaceMode;
  title: string;
  description: string;
  sidebarTitle: string;
  tip?: string;
  showTip?: boolean;
  concerts: RegisteredConcertSummary[];
  selectedConcertId: string | null;
  emptyTitle: string;
  emptyDescription: string;
  children?: ReactNode;
};

const modeHref = {
  practice: "/practice",
  reviews: "/reviews",
} satisfies Record<WorkspaceMode, string>;

function formatRegisteredAt(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getSeatMapStatusLabel(
  status: RegisteredConcertSummary["latestSeatMap"]["analysisStatus"],
) {
  if (status === "success") {
    return "분석 완료";
  }

  if (status === "failed") {
    return "분석 실패";
  }

  return "분석 대기";
}

function RegisteredConcertCard({
  concert,
  mode,
  selected,
}: {
  concert: RegisteredConcertSummary;
  mode: WorkspaceMode;
  selected: boolean;
}) {
  const href = `${modeHref[mode]}?concertId=${encodeURIComponent(concert.id)}`;
  const statusLabel = getSeatMapStatusLabel(
    concert.latestSeatMap.analysisStatus,
  );

  return (
    <Link
      href={href}
      className={cn(
        "group grid grid-cols-[76px_minmax(0,1fr)_18px] gap-3 rounded-lg border bg-background p-3 shadow-sm transition hover:border-primary/60",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <div className="overflow-hidden rounded-md border bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={concert.posterImageUrl ?? concert.latestSeatMap.imageUrl}
          alt=""
          className="aspect-square h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-black leading-5">
          {concert.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {concert.artist}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {concert.venueName}
        </p>
        <p className="mt-2 text-xs font-semibold text-primary">
          등록일 {formatRegisteredAt(concert.latestSeatMap.createdAt)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{statusLabel}</p>
      </div>
      <ChevronRight
        className={cn(
          "mt-1 h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary",
          selected && "text-primary",
        )}
        aria-hidden="true"
      />
    </Link>
  );
}

export function RegisteredConcertWorkspace({
  mode,
  title,
  description,
  sidebarTitle,
  tip,
  showTip = true,
  concerts,
  selectedConcertId,
  emptyTitle,
  emptyDescription,
  children,
}: RegisteredConcertWorkspaceProps) {
  const hasConcerts = concerts.length > 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/concerts">
            <ImageUp className="h-4 w-4" aria-hidden="true" />
            배치도 등록할 공연 찾기
          </Link>
        </Button>
      </div>

      {!hasConcerts ? (
        <section className="mt-8 rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageUp className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-black">{emptyTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {emptyDescription}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild>
              <Link href="/concerts">
                공연 찾고 좌석 배치도 등록하기
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{sidebarTitle}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    최신 등록순
                  </p>
                </div>
                <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
                  {concerts.length}개
                </span>
              </div>

              <div className="mt-4 max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
                {concerts.map((concert) => (
                  <RegisteredConcertCard
                    key={concert.id}
                    concert={concert}
                    mode={mode}
                    selected={concert.id === selectedConcertId}
                  />
                ))}
              </div>
            </section>

            {showTip && tip ? (
              <section className="rounded-lg border bg-primary/5 p-4 text-sm shadow-sm">
                <div className="flex gap-3">
                  <Sparkles
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-black text-primary">TIP</p>
                    <p className="mt-2 leading-6 text-muted-foreground">
                      {tip}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 w-full bg-background"
                >
                  <Link href="/concerts">
                    좌석 배치도 추가 등록
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </section>
            ) : null}
          </aside>

          <section className="min-w-0">
            {selectedConcertId ? (
              children
            ) : (
              <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
                <CalendarDays
                  className="mx-auto h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="mt-4 text-xl font-black">공연을 선택해주세요</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  왼쪽 목록에서 확인할 공연을 선택하면 자세한 화면이 표시됩니다.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export function RegisteredConcertHeader({
  concert,
}: {
  concert: RegisteredConcertSummary;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{concert.title}</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {concert.venueName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatDateRange(concert.startDate, concert.endDate)}
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/concerts/${concert.id}`}>
            공연 상세 보기
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
