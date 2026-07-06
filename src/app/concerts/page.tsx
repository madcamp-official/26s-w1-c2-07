import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Grid3X3,
  Heart,
  List,
  MapPin,
  MessageSquare,
  RotateCcw,
  Search,
  Ticket,
  UploadCloud,
} from "lucide-react";

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
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
      {src ? (
        <Image
          src={src}
          alt={`${title} 포스터`}
          fill
          sizes="(min-width: 1280px) 310px, (min-width: 768px) 50vw, 100vw"
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

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-black tracking-normal">공연 찾기</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          보고 싶은 공연을 검색하고, 좌석 배치도와 티켓팅 연습을 함께
          확인해보세요.
        </p>
      </div>

      <section className="mt-7 rounded-lg border bg-card p-4 shadow-sm">
        <form action="/concerts" className="space-y-5">
          <input type="hidden" name="scope" value={scope} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_112px]">
            <label className="relative block">
              <span className="sr-only">공연 검색어</span>
              <Search
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="concert-search"
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                placeholder="공연명, 아티스트, 공연장을 검색하세요"
                className="h-14 w-full rounded-md border bg-background pl-14 pr-4 text-base font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button type="submit" className="h-14">
              검색
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <label className="grid gap-2 text-sm font-semibold">
              기간 선택
              <span className="flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                공연 일정 기준
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              지역
              <select
                id="concert-region"
                name="region"
                defaultValue={filters.region ?? ""}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">전체</option>
                {regionOptions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              공연 분류
              <select
                id="concert-genre"
                name="genre"
                defaultValue={filters.genre ?? ""}
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">전체</option>
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters ? (
              <Button asChild variant="ghost">
                <Link href={resetHref}>
                  초기화
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <div className="hidden lg:block" />
            )}
          </div>
        </form>
      </section>

      <nav className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="공연 목록 필터">
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button type="button" variant="outline" size="icon" aria-label="카드 보기">
            <Grid3X3 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="목록 보기">
            <List className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">
          {filters.q ? (
            <>
              <span className="text-primary">&apos;{filters.q}&apos;</span>{" "}
              검색 결과
            </>
          ) : (
            countLabel
          )}{" "}
          {concerts.length}건
        </h2>
        <span className="rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
          최신 등록순
        </span>
      </div>

      {concerts.length > 0 ? (
        <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {concerts.map((concert) => (
            <article
              key={concert.id}
              className="overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative">
                <Link href={`/concerts/${concert.id}`}>
                  <ConcertPoster
                    src={concert.posterImageUrl}
                    title={concert.title}
                  />
                </Link>
                <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                  {concert.hasSeatMap ? "배치도 등록" : "예정"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="관심 공연"
                  className="absolute right-3 top-3 rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur"
                >
                  <Heart className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="text-sm font-bold text-primary">
                    {concert.artist}
                  </p>
                  <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-black leading-6">
                    {concert.title}
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDateRange(concert.startDate, concert.endDate)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {concert.region} · {concert.venueName}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatPriceRange(concert.priceMin, concert.priceMax)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/concerts/${concert.id}`}>상세보기</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/concerts/${concert.id}/seat-map`}>
                      <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                      배치도
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/concerts/${concert.id}/reviews`}>
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      리뷰
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/concerts/${concert.id}/practice`}>
                      티켓팅
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-10 text-center shadow-sm">
          <h2 className="text-lg font-black">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </section>
      )}
    </main>
  );
}
