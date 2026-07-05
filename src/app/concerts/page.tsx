import Link from "next/link";
import { CalendarDays, MapPin, MessageSquare, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getConcertList, type ConcertListScope } from "@/lib/concerts";
import { formatDateRange, formatPriceRange } from "@/utils/format";

const scopeTabs: Array<{
  value: ConcertListScope;
  label: string;
}> = [
  {
    value: "upcoming",
    label: "다가오는 공연",
  },
  {
    value: "latest",
    label: "최신 등록",
  },
  {
    value: "samples",
    label: "샘플 공연",
  },
  {
    value: "all",
    label: "전체",
  },
];

type ConcertListPageProps = {
  searchParams?: Promise<{
    scope?: string;
  }>;
};

function parseScope(value: string | undefined): ConcertListScope {
  if (value === "latest" || value === "samples" || value === "all") {
    return value;
  }

  return "upcoming";
}

export default async function ConcertListPage({
  searchParams,
}: ConcertListPageProps) {
  const resolvedSearchParams = await searchParams;
  const scope = parseScope(resolvedSearchParams?.scope);
  const concerts = await getConcertList({
    scope,
  });
  const activeScopeLabel =
    scopeTabs.find((tab) => tab.value === scope)?.label ?? "다가오는 공연";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">공연 선택</p>
          <h1 className="mt-1 text-2xl font-semibold">{activeScopeLabel}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          등록된 공연 {concerts.length}개
        </p>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="공연 목록 필터">
        {scopeTabs.map((tab) => (
          <Button
            key={tab.value}
            asChild
            variant={scope === tab.value ? "default" : "outline"}
            size="sm"
          >
            <Link href={`/concerts?scope=${tab.value}`}>{tab.label}</Link>
          </Button>
        ))}
      </nav>

      {concerts.length > 0 ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {concerts.map((concert) => (
            <article
              key={concert.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div
                className="h-40 bg-secondary bg-cover bg-center"
                style={{
                  backgroundImage: concert.posterImageUrl
                    ? `linear-gradient(90deg, rgb(0 0 0 / 0.62), rgb(0 0 0 / 0.08)), url(${concert.posterImageUrl})`
                    : undefined,
                }}
              >
                <div className="flex h-full flex-col justify-end p-5 text-white">
                  <p className="text-sm opacity-85">{concert.artist}</p>
                  <h2 className="mt-1 text-xl font-semibold">{concert.title}</h2>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDateRange(concert.startDate, concert.endDate)}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {concert.region} · {concert.venueName}
                  </p>
                  <p className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" aria-hidden="true" />
                    {formatPriceRange(concert.priceMin, concert.priceMax)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {concert.genre ? (
                    <span className="rounded-md border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                      {concert.genre}
                    </span>
                  ) : null}
                  <span className="rounded-md border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    좌석 배치도 {concert.hasSeatMap ? "등록됨" : "미등록"}
                  </span>
                  {concert.isSample ? (
                    <span className="rounded-md border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                      샘플 공연
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    리뷰 {concert.reviewCount}
                  </span>
                </div>

                <Button asChild className="w-full">
                  <Link href={`/concerts/${concert.id}`}>상세 보기</Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">등록된 공연이 없습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            공연 동기화 또는 seed 데이터를 넣은 뒤 공연 목록을 확인할 수 있습니다.
          </p>
        </section>
      )}
    </main>
  );
}
