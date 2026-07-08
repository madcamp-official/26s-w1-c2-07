import { Loader2, Ticket } from "lucide-react";

export function PracticeRouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-9 w-44 animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-md bg-secondary" />
        </div>
        <div className="h-10 w-44 animate-pulse rounded-md bg-secondary" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="h-6 w-36 animate-pulse rounded-md bg-secondary" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded-md bg-secondary" />
            </div>
            <div className="h-7 w-12 animate-pulse rounded-full bg-secondary" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="grid h-[148px] grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg border bg-background p-3"
              >
                <div className="h-[76px] w-[76px] animate-pulse rounded-md bg-secondary" />
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-md bg-secondary" />
                  <div className="h-4 w-4/5 animate-pulse rounded-md bg-secondary" />
                  <div className="h-3 w-2/3 animate-pulse rounded-md bg-secondary" />
                  <div className="h-3 w-1/2 animate-pulse rounded-md bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary text-primary">
              <Ticket className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                티켓팅 연습 준비 중
              </div>
              <div className="mt-4 h-6 w-72 max-w-full animate-pulse rounded-md bg-secondary" />
              <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-md bg-secondary" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg border bg-background"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
