import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  MessageSquare,
  RotateCcw,
  Search,
  Ticket,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import {
  getConcertFilterOptions,
  getConcertList,
  type ConcertListScope,
} from "@/lib/concerts";
import { formatDateRange } from "@/utils/format";

const CONCERT_PAGE_SIZE = 8;

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
    page?: string;
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

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
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

function getConcertPageHref(
  page: number,
  input: {
    scope: ConcertListScope;
    q?: string;
    region?: string;
    genre?: string;
  },
) {
  const params = new URLSearchParams({
    scope: input.scope,
    page: String(page),
  });

  if (input.q) {
    params.set("q", input.q);
  }

  if (input.region) {
    params.set("region", input.region);
  }

  if (input.genre) {
    params.set("genre", input.genre);
  }

  return `/concerts?${params.toString()}`;
}

function ConcertPoster({ src, title }: { src: string | null; title: string }) {
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
  const [resolvedSearchParams, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const scope = parseScope(resolvedSearchParams?.scope);
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const filters = {
    q: parseFilterValue(resolvedSearchParams?.q, 100),
    region: parseFilterValue(resolvedSearchParams?.region, 50),
    genre: parseFilterValue(resolvedSearchParams?.genre, 50),
  };
  const [concerts, filterOptions] = await Promise.all([
    getConcertList({
      scope,
      ...filters,
      seatMapOwnerId: user?.id ?? null,
    }),
    getConcertFilterOptions({
      scope,
    }),
  ]);
  const hasActiveFilters = Boolean(
    filters.q || filters.region || filters.genre,
  );
  const resetHref = getConcertScopeHref(scope, {});
  const countLabel = hasActiveFilters ? "검색 결과" : "등록된 공연";
  const totalConcertCount = concerts.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalConcertCount / CONCERT_PAGE_SIZE),
  );
  const page = Math.min(requestedPage, totalPages);
  const visibleConcerts = concerts.slice(
    (page - 1) * CONCERT_PAGE_SIZE,
    page * CONCERT_PAGE_SIZE,
  );
  const firstConcertNumber =
    totalConcertCount === 0 ? 0 : (page - 1) * CONCERT_PAGE_SIZE + 1;
  const lastConcertNumber = Math.min(
    page * CONCERT_PAGE_SIZE,
    totalConcertCount,
  );
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

      <nav className="mt-6 flex flex-wrap items-center gap-3">
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
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">
          {filters.q ? (
            <>
              <span className="text-primary">&apos;{filters.q}&apos;</span> 검색
              결과
            </>
          ) : (
            countLabel
          )}{" "}
          {totalConcertCount}건
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {totalConcertCount > 0 ? (
            <span className="rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
              {firstConcertNumber}-{lastConcertNumber} / {totalConcertCount}
            </span>
          ) : null}
          <span className="rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground">
            최신 등록순
          </span>
        </div>
      </div>

      {visibleConcerts.length > 0 ? (
        <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {visibleConcerts.map((concert) => {
            const seatMapHref = !concert.hasSeatMap
              ? `/concerts/${concert.id}/seat-map/upload`
              : concert.latestSeatMapStatus === "success"
                ? `/concerts/${concert.id}/seat-map/edit`
                : `/concerts/${concert.id}/seat-map/analysis`;

            return (
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
                    공연 정보
                  </span>
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
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      {formatDateRange(concert.startDate, concert.endDate)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {concert.region} · {concert.venueName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/concerts/${concert.id}`}>
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        상세보기
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={seatMapHref}>
                        <UploadCloud
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        배치도 등록
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/practice?concertId=${concert.id}`}>
                        <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                        티켓팅 연습
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/reviews?concertId=${concert.id}`}>
                        <MessageSquare
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        좌석 리뷰
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-10 text-center shadow-sm">
          <h2 className="text-lg font-black">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </section>
      )}

      {totalPages > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={getConcertPageHref(page - 1, {
                    scope,
                    ...filters,
                  })}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  이전
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                이전
              </Button>
            )}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={getConcertPageHref(page + 1, {
                    scope,
                    ...filters,
                  })}
                >
                  다음
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" disabled>
                다음
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
