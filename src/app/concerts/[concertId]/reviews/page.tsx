import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageUp, MessageSquare } from "lucide-react";
import { z } from "zod";

import { ReviewClient } from "@/app/concerts/[concertId]/reviews/review-client";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const concertIdSchema = z.string().uuid();

type ReviewsPageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

export default async function ReviewsPage({ params }: ReviewsPageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const [user, concert] = await Promise.all([
    getCurrentUser(),
    prisma.concert.findUnique({
      where: {
        id: parsedConcertId.data,
      },
      select: {
        id: true,
        title: true,
        artist: true,
        venueName: true,
        region: true,
        seatMaps: {
          where: {
            analysisStatus: "success",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            imageUrl: true,
            zones: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                name: true,
                grade: true,
                price: true,
                bbox: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!concert) {
    notFound();
  }

  const latestSeatMap = concert.seatMaps[0] ?? null;

  if (!latestSeatMap || latestSeatMap.zones.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/concerts/${concert.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            공연 상세
          </Link>
        </Button>

        <section className="mt-5 rounded-lg border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-secondary">
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{concert.title}</p>
              <h1 className="mt-1 text-2xl font-semibold">
                좌석 구역 리뷰 준비가 필요합니다
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                구역별 리뷰를 작성하려면 좌석 배치도 업로드와 AI 좌석 구역
                분석이 먼저 완료되어야 합니다.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/concerts/${concert.id}/seat-map`}>
                <ImageUp className="h-4 w-4" aria-hidden="true" />
                좌석 배치도 준비하기
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concerts/${concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          공연 상세
        </Link>
      </Button>

      <ReviewClient
        concert={{
          id: concert.id,
          title: concert.title,
          artist: concert.artist,
          venueName: concert.venueName,
          region: concert.region,
        }}
        currentUserId={user?.id ?? null}
        seatMap={{
          id: latestSeatMap.id,
          imageUrl: latestSeatMap.imageUrl,
          zones: latestSeatMap.zones,
        }}
      />
    </main>
  );
}
