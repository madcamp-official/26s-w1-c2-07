import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { z } from "zod";

import { ReviewWriteForm } from "@/app/concerts/[concertId]/reviews/new/review-write-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getRegisteredReviewConcert } from "@/lib/registered-concerts";

const concertIdSchema = z.string().uuid();

type ReviewWritePageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

export default async function ReviewWritePage({ params }: ReviewWritePageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=/concerts/${parsedConcertId.data}/reviews/new`);
  }

  const concert = await getRegisteredReviewConcert(user.id, parsedConcertId.data);

  if (!concert) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/reviews?concertId=${concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          리뷰 목록
        </Link>
      </Button>

      <section className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {concert.artist} · {concert.venueName}
            </p>
            <h1 className="mt-1 text-2xl font-black">리뷰 작성하기</h1>
          </div>
        </div>

        <div className="mt-6">
          <ReviewWriteForm concertId={concert.id} />
        </div>
      </section>
    </main>
  );
}
