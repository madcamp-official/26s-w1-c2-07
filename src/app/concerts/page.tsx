import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, MessageSquare, Search, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getConcertFilterOptions,
  getConcertList,
  type ConcertListScope,
} from "@/lib/concerts";
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
    q?: string;
    region?: string;
    genre?: string;
  }>;
};

function parseScope(value: string | undefined): ConcertListScope {
  if (value === "latest" || value === "samples" || value === "all") {
    return value;
  }

  return "upcoming";
}

function parseFilterValue(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function getConcertScopeHref(
  scope: ConcertListScope,
  filters: {
    q?: string;
    region?: string;
    genre?: string;
  },
) {
  const params = new URLSearchParams({
    scope,
  });

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.region) {
    params.set("region", filters.region);
  }

  if (filters.genre) {
    params.set("genre", filters.genre);
  }

  return `/concerts?${params.toString()}`;
}

function ConcertPoster({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md border bg-secondary">
      {src ? (
        <Image
          src={src}
          alt={`${title} 포스터`}
          fill
          sizes="(min-width: 1024px) 150px, (min-width: 640px) 150px, calc(100vw - 4rem)"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          포스터 준비 중
        </div>
      )}
    </div>
  );
}

export default async function ConcertListPage({
  searchParams,
}: ConcertListPageProps) {
  const resolvedSearchParams = await searchParams;
  const scope = parseScope(resolvedSearchParams?.scope);
  const filters = {
    q: parseFilterValue(resolvedSearchParams?.q, 100),
    region: parseFilterValue(resolvedSearchParams?.region, 50),
    genre: parseFilterValue(resolvedSearchParams?.genre, 50),
  };
  const [concerts, filterOptions] = await Promise.all([
    getConcertList({
      scope,
      ...filters,
    }),
    getConcertFilterOptions({
      scope,
    }),
  ]);
  const hasActiveFilters = Boolean(filters.q || filters.region || filters.genre);
  const resetHref = getConcertScopeHref(scope, {});
  const countLabel = hasActiveFilters ? "검색 결과" : "등록된 공연";
  const emptyTitle = hasActiveFilters
    ? "검색 결과가 없습니다"
    : "등록된 공연이 없습니다";
  const emptyDescription = hasActiveFilters
    ? "다른 검색어 또는 필터를 사용해보세요."
    : "공연 동기화 또는 seed 데이터를 넣은 뒤 공연 목록을 확인할 수 있습니다.";
  const regionOptions =
    filters.region && !filterOptions.regions.includes(filters.region)
      ? [filters.region, ...filterOptions.regions]
      : filterOptions.regions;
  const genreOptions =
    filters.genre && !filterOptions.genres.includes(filters.genre)
      ? [filters.genre, ...filterOptions.genres]
      : filterOptions.genres;
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
          {countLabel} {concerts.length}개
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
            <Link href={getConcertScopeHref(tab.value, filters)}>
              {tab.label}
            </Link>
          </Button>
        ))}
      </nav>

      <section className="mt-5 rounded-lg border bg-card p-4">
        <form
          action="/concerts"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto] lg:items-end"
        >
          <input type="hidden" name="scope" value={scope} />

          <div className="min-w-0">
            <label
              htmlFor="concert-search"
              className="text-xs font-medium text-muted-foreground"
            >
              검색어
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="concert-search"
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                placeholder="공연명, 아티스트, 공연장"
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="concert-region"
              className="text-xs font-medium text-muted-foreground"
            >
              지역
            </label>
            <select
              id="concert-region"
              name="region"
              defaultValue={filters.region ?? ""}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">전체 지역</option>
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="concert-genre"
              className="text-xs font-medium text-muted-foreground"
            >
              장르
            </label>
            <select
              id="concert-genre"
              name="genre"
              defaultValue={filters.genre ?? ""}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">전체 장르</option>
              {genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            검색
          </Button>

          {hasActiveFilters ? (
            <Button asChild variant="outline">
              <Link href={resetHref}>초기화</Link>
            </Button>
          ) : null}
        </form>
      </section>

      {concerts.length > 0 ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {concerts.map((concert) => (
            <article
              key={concert.id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="grid sm:grid-cols-[150px_1fr]">
                <div className="bg-secondary p-4">
                  <ConcertPoster
                    src={concert.posterImageUrl}
                    title={concert.title}
                  />
                </div>

                <div className="flex min-w-0 flex-col justify-between gap-5 p-5">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {concert.artist}
                    </p>
                    <h2 className="mt-1 break-words text-xl font-semibold">
                      {concert.title}
                    </h2>
                  </div>

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
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </section>
      )}
    </main>
  );
}
