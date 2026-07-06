import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";

import { ReviewClient } from "@/app/concerts/[concertId]/reviews/review-client";
import { Button } from "@/components/ui/button";
import {
  getConcertReviewData,
  normalizeReviewScoreField,
  normalizeReviewSortMode,
  REVIEW_PAGE_SIZE,
} from "@/lib/reviews";

const concertIdSchema = z.string().uuid();

type ReviewsPageProps = {
  params: Promise<{
    concertId: string;
  }>;
  searchParams?: Promise<{
    page?: string;
    score?: string;
    sort?: string;
    zoneId?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getConcertReviewsPaginationBaseHref(
  concertId: string,
  filters: {
    score: string;
    sort: string;
    zoneId: string | null;
  },
) {
  const params = new URLSearchParams({
    sort: filters.sort,
    score: filters.score,
  });

  if (filters.zoneId) {
    params.set("zoneId", filters.zoneId);
  }

  return `/concerts/${concertId}/reviews?${params.toString()}`;
}

export default async function ReviewsPage({
  params,
  searchParams,
}: ReviewsPageProps) {
  const { concertId } = await params;
  const resolvedSearchParams = await searchParams;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const reviewData = await getConcertReviewData(parsedConcertId.data, {
    page: parsePage(resolvedSearchParams?.page),
    pageSize: REVIEW_PAGE_SIZE,
    sortMode: normalizeReviewSortMode(resolvedSearchParams?.sort),
    scoreField: normalizeReviewScoreField(resolvedSearchParams?.score),
    zoneId: resolvedSearchParams?.zoneId ?? null,
  });

  if (!reviewData) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concerts/${reviewData.concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          공연 상세
        </Link>
      </Button>

      <ReviewClient
        reviews={reviewData.reviews}
        filters={reviewData.filters}
        zoneOptions={reviewData.zoneOptions}
        pagination={reviewData.pagination}
        paginationBaseHref={getConcertReviewsPaginationBaseHref(
          reviewData.concert.id,
          {
            score: reviewData.filters.scoreField,
            sort: reviewData.filters.sortMode,
            zoneId: reviewData.filters.zoneId,
          },
        )}
        filterFormAction={`/concerts/${reviewData.concert.id}/reviews`}
        writeHref={`/concerts/${reviewData.concert.id}/reviews/new`}
      />
    </main>
  );
}
