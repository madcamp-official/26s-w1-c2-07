import { prisma } from "@/lib/prisma";
import { formatSeatCode } from "@/utils/format";

export const REVIEW_PAGE_SIZE = 6;
export const REVIEW_SORT_MODES = ["latest", "rating_desc"] as const;
export const REVIEW_SCORE_FIELDS = [
  "total",
  "viewScore",
  "soundScore",
  "distanceScore",
  "satisfactionScore",
] as const;

export type ReviewSortMode = (typeof REVIEW_SORT_MODES)[number];
export type ReviewScoreField = (typeof REVIEW_SCORE_FIELDS)[number];

type ConcertReviewDataOptions = {
  page?: number;
  pageSize?: number;
  sortMode?: ReviewSortMode;
  scoreField?: ReviewScoreField;
  zoneId?: string | null;
};

function normalizePage(value: number | undefined) {
  return Number.isInteger(value) && value && value > 0 ? value : 1;
}

export function normalizeReviewSortMode(value: string | undefined) {
  return REVIEW_SORT_MODES.includes(value as ReviewSortMode)
    ? (value as ReviewSortMode)
    : "latest";
}

export function normalizeReviewScoreField(value: string | undefined) {
  return REVIEW_SCORE_FIELDS.includes(value as ReviewScoreField)
    ? (value as ReviewScoreField)
    : "total";
}

function getReviewScore<
  T extends {
    viewScore: number;
    soundScore: number;
    distanceScore: number;
    satisfactionScore: number;
  },
>(review: T, scoreField: ReviewScoreField) {
  if (scoreField === "total") {
    return (
      (review.viewScore +
        review.soundScore +
        review.distanceScore +
        review.satisfactionScore) /
      4
    );
  }

  return review[scoreField];
}

function getReviewLocationKey(review: {
  seatFloor: string | null;
  seatSection: string | null;
  zone: {
    id: string;
  } | null;
}) {
  if (review.seatFloor && review.seatSection) {
    return `manual:${review.seatFloor}:${formatSeatCode(review.seatSection)}`;
  }

  if (review.zone) {
    return `zone:${review.zone.id}`;
  }

  return "unknown";
}

function normalizeReviewLocationKey(value: string) {
  const [type, floor, section] = value.split(":");

  if (type === "manual" && floor && section) {
    return `manual:${floor}:${formatSeatCode(section)}`;
  }

  return value;
}

function getReviewLocationLabel(review: {
  seatFloor: string | null;
  seatSection: string | null;
  zone: {
    name: string;
    grade: string;
  } | null;
}) {
  if (review.seatFloor && review.seatSection) {
    const floorLabel =
      review.seatFloor === "floor" ? "Floor층" : `${review.seatFloor}층`;

    return `${floorLabel} · ${formatSeatCode(review.seatSection)}`;
  }

  if (review.zone) {
    return `${review.zone.name} · ${review.zone.grade}`;
  }

  return "좌석 정보 미입력";
}

export async function getConcertReviewData(
  concertId: string,
  options: ConcertReviewDataOptions = {},
) {
  const pageSize = options.pageSize ?? REVIEW_PAGE_SIZE;
  const requestedPage = normalizePage(options.page);
  const sortMode = options.sortMode ?? "latest";
  const scoreField = options.scoreField ?? "total";
  const concert = await prisma.concert.findFirst({
    where: {
      id: concertId,
      isVisible: true,
    },
    select: {
      id: true,
      title: true,
      artist: true,
      venueName: true,
      region: true,
      startDate: true,
      endDate: true,
      posterImageUrl: true,
      _count: {
        select: {
          reviews: true,
          schedules: true,
        },
      },
    },
  });

  if (!concert) {
    return null;
  }

  const allReviews = await prisma.review.findMany({
    where: {
      concertId: concert.id,
    },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
      zone: {
        select: {
          id: true,
          name: true,
          grade: true,
          price: true,
        },
      },
    },
  });
  const zoneCounts = new Map<
    string,
    {
      id: string;
      label: string;
      count: number;
    }
  >();

  for (const review of allReviews) {
    const locationKey = getReviewLocationKey(review);
    const currentZone = zoneCounts.get(locationKey);

    zoneCounts.set(locationKey, {
      id: locationKey,
      label: getReviewLocationLabel(review),
      count: (currentZone?.count ?? 0) + 1,
    });
  }

  const zoneOptions = Array.from(zoneCounts.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "ko-KR"),
  );
  const requestedZoneId = options.zoneId
    ? normalizeReviewLocationKey(options.zoneId)
    : null;
  const selectedZoneId =
    requestedZoneId && zoneOptions.some((zone) => zone.id === requestedZoneId)
      ? requestedZoneId
      : null;
  const filteredReviews = selectedZoneId
    ? allReviews.filter((review) => getReviewLocationKey(review) === selectedZoneId)
    : allReviews;
  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (sortMode === "rating_desc") {
      const scoreDiff =
        getReviewScore(b, scoreField) - getReviewScore(a, scoreField);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const totalCount = sortedReviews.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const reviews = sortedReviews.slice((page - 1) * pageSize, page * pageSize);

  return {
    concert,
    reviews,
    zoneOptions,
    filters: {
      sortMode,
      scoreField,
      zoneId: selectedZoneId,
    },
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}
