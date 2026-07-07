import Link from "next/link";
import { ChevronLeft, ChevronRight, ListFilter, PencilLine, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReviewScoreField, ReviewSortMode } from "@/lib/reviews";
import { formatSeatCode } from "@/utils/format";

type ReviewUser = {
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
};

type ReviewZone = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
};

type ReviewItem = {
  id: string;
  viewScore: number;
  soundScore: number;
  distanceScore: number;
  satisfactionScore: number;
  content: string;
  createdAt: Date;
  seatFloor: string | null;
  seatSection: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  user: ReviewUser;
  zone: ReviewZone | null;
};

type ReviewPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type ReviewZoneOption = {
  id: string;
  label: string;
  count: number;
};

type ReviewClientProps = {
  reviews: ReviewItem[];
  filters: {
    sortMode: ReviewSortMode;
    scoreField: ReviewScoreField;
    zoneId: string | null;
  };
  zoneOptions: ReviewZoneOption[];
  pagination: ReviewPagination;
  paginationBaseHref: string;
  filterFormAction: string;
  filterHiddenFields?: Array<{
    name: string;
    value: string;
  }>;
  writeHref: string;
};

type ScoreKey =
  | "viewScore"
  | "soundScore"
  | "distanceScore"
  | "satisfactionScore";

const SCORE_FIELDS: Array<{
  key: ScoreKey;
  label: string;
}> = [
  {
    key: "viewScore",
    label: "시야",
  },
  {
    key: "soundScore",
    label: "음향",
  },
  {
    key: "distanceScore",
    label: "거리감",
  },
  {
    key: "satisfactionScore",
    label: "만족도",
  },
];

const SCORE_FILTER_OPTIONS: Array<{
  value: ReviewScoreField;
  label: string;
}> = [
  {
    value: "total",
    label: "총 평점",
  },
  ...SCORE_FIELDS.map((field) => ({
    value: field.key,
    label: field.label,
  })),
];

function getDisplayName(user: ReviewUser) {
  return user.nickname?.trim() || "사용자";
}

function getAverageReviewScore(review: ReviewItem) {
  return (
    (review.viewScore +
      review.soundScore +
      review.distanceScore +
      review.satisfactionScore) /
    4
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatSeatLocation(review: ReviewItem) {
  if (
    review.seatFloor &&
    review.seatSection &&
    review.seatRow &&
    review.seatNumber
  ) {
    const floorLabel =
      review.seatFloor === "floor" ? "Floor층" : `${review.seatFloor}층`;

    return `${floorLabel} · ${formatSeatCode(review.seatSection)}구역 · ${formatSeatCode(
      review.seatRow,
    )}행 · ${formatSeatCode(review.seatNumber)}열`;
  }

  if (review.zone) {
    return `${review.zone.name} · ${review.zone.grade}`;
  }

  return "좌석 정보 미입력";
}

function getPaginationHref(baseHref: string, page: number) {
  return `${baseHref}${baseHref.includes("?") ? "&" : "?"}page=${page}`;
}

export function ReviewClient({
  reviews,
  filters,
  zoneOptions,
  pagination,
  paginationBaseHref,
  filterFormAction,
  filterHiddenFields = [],
  writeHref,
}: ReviewClientProps) {
  const firstReviewNumber =
    pagination.totalCount === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const lastReviewNumber = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalCount,
  );
  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.page < pagination.totalPages;

  return (
      <section className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">리뷰 목록</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pagination.totalCount > 0
                ? `${pagination.totalCount}개 중 ${firstReviewNumber}-${lastReviewNumber}개`
                : "등록된 리뷰가 없습니다."}
            </p>
          </div>
          <Button asChild>
            <Link href={writeHref}>
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              리뷰 작성하기
            </Link>
          </Button>
        </div>

        <form
          action={filterFormAction}
          className="mt-5 grid gap-3 rounded-md border bg-secondary/60 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          {filterHiddenFields.map((field) => (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              value={field.value}
            />
          ))}
          <label className="grid gap-2 text-sm font-semibold">
            정렬
            <select
              name="sort"
              defaultValue={filters.sortMode}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="latest">최신순</option>
              <option value="rating_desc">평점순</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            평점별
            <select
              name="score"
              defaultValue={filters.scoreField}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SCORE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            구역
            <select
              name="zoneId"
              defaultValue={filters.zoneId ?? ""}
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">전체 구역</option>
              {zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label} ({zone.count})
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="h-10 self-end">
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            적용
          </Button>
        </form>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <Link
                key={review.id}
                href={`/reviews/${review.id}`}
                className="group block rounded-md border p-4 transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border bg-secondary">
                      {review.user.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={review.user.profileImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-black text-muted-foreground">
                          {getDisplayName(review.user).slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {getDisplayName(review.user)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2.5 py-1 text-sm font-black text-primary">
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    {getAverageReviewScore(review).toFixed(1)}
                  </span>
                </div>

                <p className="mt-4 text-sm font-semibold text-primary">
                  {formatSeatLocation(review)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {SCORE_FIELDS.map((field) => (
                    <span
                      key={field.key}
                      className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-1"
                    >
                      <Star className="h-3 w-3" aria-hidden="true" />
                      {field.label} {review[field.key]}/5
                    </span>
                  ))}
                </div>

                <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {review.content}
                </p>

                <div className="mt-3 flex justify-end">
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-md border bg-secondary px-4 py-8 text-center text-sm text-muted-foreground md:col-span-2">
              아직 이 공연에 작성된 리뷰가 없습니다.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            {canGoPrevious ? (
              <Button asChild variant="outline" size="sm">
                <Link href={getPaginationHref(paginationBaseHref, pagination.page - 1)}>
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
            {canGoNext ? (
              <Button asChild variant="outline" size="sm">
                <Link href={getPaginationHref(paginationBaseHref, pagination.page + 1)}>
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
        </div>
      </section>
  );
}
