import {
  Loader2,
  MessageSquare,
  Search,
  Ticket,
  UserRound,
} from "lucide-react";

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-secondary ${className}`} />
  );
}

export function ConcertListRouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div>
        <SkeletonBlock className="h-9 w-40" />
        <SkeletonBlock className="mt-3 h-4 w-96 max-w-full" />
      </div>

      <section className="mt-7 rounded-lg border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_112px]">
          <div className="flex h-14 items-center gap-3 rounded-md border bg-background px-5 text-muted-foreground">
            <Search className="h-5 w-5" aria-hidden="true" />
            <SkeletonBlock className="h-4 flex-1" />
          </div>
          <SkeletonBlock className="h-14" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-10" />
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        공연 목록을 불러오는 중
      </div>

      <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <article
            key={index}
            className="overflow-hidden rounded-lg border bg-card shadow-sm"
          >
            <SkeletonBlock className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-5 w-full" />
              <SkeletonBlock className="h-5 w-4/5" />
              <div className="grid grid-cols-2 gap-2">
                <SkeletonBlock className="h-9" />
                <SkeletonBlock className="h-9" />
                <SkeletonBlock className="h-9" />
                <SkeletonBlock className="h-9" />
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export function ReviewsRouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="h-9 w-36" />
          <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />
        </div>
        <SkeletonBlock className="h-10 w-28" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="mt-2 h-3 w-24" />
            </div>
            <SkeletonBlock className="h-7 w-12 rounded-full" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="grid h-[148px] grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg border bg-background p-3"
              >
                <SkeletonBlock className="h-[76px] w-[76px]" />
                <div className="space-y-2">
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-4/5" />
                  <SkeletonBlock className="h-3 w-2/3" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              좌석 리뷰를 불러오는 중
            </div>
            <SkeletonBlock className="mt-4 h-7 w-72 max-w-full" />
            <SkeletonBlock className="mt-3 h-4 w-96 max-w-full" />
          </div>
          <div className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonBlock key={index} className="h-44" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function MyPageRouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="mt-3 h-7 w-48" />
              <SkeletonBlock className="mt-3 h-4 w-64 max-w-full" />
            </div>
          </div>
          <SkeletonBlock className="h-10 w-80 max-w-full" />
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24" />
        ))}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Ticket className="h-4 w-4" aria-hidden="true" />내 활동을 불러오는 중
        </div>
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-32" />
          ))}
        </div>
      </section>
    </main>
  );
}
