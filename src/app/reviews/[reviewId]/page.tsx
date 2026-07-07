import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { z } from "zod";

import { ReviewImageGallery } from "@/app/reviews/[reviewId]/review-image-gallery";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatSeatCode } from "@/utils/format";

const reviewIdSchema = z.string().uuid();

type ReviewDetailPageProps = {
  params: Promise<{
    reviewId: string;
  }>;
};

const SCORE_FIELDS = [
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
] as const;

async function getReviewDetail(reviewId: string) {
  return prisma.review.findFirst({
    where: {
      id: reviewId,
      concert: {
        isVisible: true,
      },
    },
    include: {
      concert: {
        select: {
          id: true,
          title: true,
          artist: true,
          venueName: true,
        },
      },
      user: {
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      },
      zone: {
        select: {
          name: true,
          grade: true,
        },
      },
    },
  });
}

function getDisplayName(user: {
  nickname: string | null;
}) {
  return user.nickname?.trim() || "사용자";
}

function getAverageReviewScore(review: {
  viewScore: number;
  soundScore: number;
  distanceScore: number;
  satisfactionScore: number;
}) {
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

function formatSeatLocation(review: Awaited<ReturnType<typeof getReviewDetail>>) {
  if (!review) {
    return "좌석 정보 미입력";
  }

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

function getReviewImageUrls(review: {
  imageUrl: string | null;
  imageUrls: string[];
}) {
  return review.imageUrls.length > 0
    ? review.imageUrls
    : review.imageUrl
      ? [review.imageUrl]
      : [];
}

export default async function ReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const { reviewId } = await params;
  const parsedReviewId = reviewIdSchema.safeParse(reviewId);

  if (!parsedReviewId.success) {
    notFound();
  }

  const review = await getReviewDetail(parsedReviewId.data);

  if (!review) {
    notFound();
  }

  const averageScore = getAverageReviewScore(review);
  const imageUrls = getReviewImageUrls(review);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/reviews?concertId=${review.concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          리뷰 목록
        </Link>
      </Button>

      <article className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">
              {review.concert.artist} · {review.concert.venueName}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-normal">
              {review.concert.title}
            </h1>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              {formatSeatLocation(review)}
            </p>
          </div>
          <div className="rounded-md border bg-primary/10 px-4 py-3 text-primary">
            <p className="text-xs font-bold">총 평점</p>
            <p className="mt-1 inline-flex items-center gap-1 text-2xl font-black">
              <Star className="h-5 w-5 fill-current" aria-hidden="true" />
              {averageScore.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t pt-5">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border bg-secondary">
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
          <div>
            <p className="font-semibold">{getDisplayName(review.user)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0 space-y-6">
            <section>
              <h2 className="text-base font-black">항목별 평점</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {SCORE_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-md border bg-secondary p-3"
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      {field.label}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 font-black">
                      <Star
                        className="h-4 w-4 fill-current text-primary"
                        aria-hidden="true"
                      />
                      {review[field.key]}/5
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-base font-black">리뷰 내용</h2>
              <p className="mt-3 min-h-52 whitespace-pre-wrap break-words rounded-md border bg-background p-4 text-sm leading-7 [overflow-wrap:anywhere]">
                {review.content}
              </p>
            </section>
          </div>

          <aside className="min-w-0">
            <h2 className="text-base font-black">첨부 사진</h2>
            <ReviewImageGallery imageUrls={imageUrls} />
          </aside>
        </div>
      </article>
    </main>
  );
}
