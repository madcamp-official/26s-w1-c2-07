import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  CalendarDays,
  ImageUp,
  MapPin,
  MessageSquare,
  PlayCircle,
  Ticket,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getConcertDetail } from "@/lib/concerts";
import { formatDateRange, formatDateTime, formatPriceRange } from "@/utils/format";

const concertIdSchema = z.string().uuid();

type ConcertDetailPageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

export default async function ConcertDetailPage({
  params,
}: ConcertDetailPageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const concert = await getConcertDetail(parsedConcertId.data);

  if (!concert) {
    notFound();
  }

  const isSeatMapAnalyzed =
    concert.latestSeatMap?.analysisStatus === "success" &&
    concert.latestSeatMap.zoneCount > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-lg border bg-card">
          <div
            className="min-h-72 bg-secondary bg-cover bg-center"
            style={{
              backgroundImage: concert.posterImageUrl
                ? `linear-gradient(90deg, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0.18)), url(${concert.posterImageUrl})`
                : undefined,
            }}
          >
            <div className="flex min-h-72 flex-col justify-end p-6 text-white">
              <p className="text-sm opacity-85">{concert.artist}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                {concert.title}
              </h1>
              <div className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
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
                <p className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  리뷰 {concert.reviewCount}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {concert.description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {concert.description}
              </p>
            ) : null}

            <section>
              <h2 className="text-lg font-semibold">공연 일정</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {concert.schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border p-4">
                    <p className="font-medium">{schedule.roundName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDateTime(schedule.performanceDate)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">좌석 데이터</h2>
            {concert.latestSeatMap ? (
              <div className="mt-4 overflow-hidden rounded-md border bg-secondary">
                <div
                  className="min-h-44 bg-contain bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url(${concert.latestSeatMap.imageUrl})`,
                  }}
                />
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">좌석 배치도</span>
                <span>{concert.hasSeatMap ? "등록됨" : "미등록"}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">분석 상태</span>
                <span>{concert.latestSeatMap?.analysisStatus ?? "없음"}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">좌석 구역</span>
                <span>{concert.latestSeatMap?.zoneCount ?? 0}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">리뷰</span>
                <span>{concert.reviewCount}개</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">다음 작업</h2>
            <div className="mt-4 grid gap-2">
              <Button asChild>
                <Link href={`/concerts/${concert.id}/seat-map`}>
                  <ImageUp className="h-4 w-4" aria-hidden="true" />
                  {concert.hasSeatMap ? "좌석 배치도 다시 업로드" : "좌석 배치도 업로드"}
                </Link>
              </Button>

              {concert.hasSeatMap ? (
                <Button asChild variant="outline">
                  <Link href={`/concerts/${concert.id}/seat-map`}>
                    <WandSparkles className="h-4 w-4" aria-hidden="true" />
                    AI 분석 및 결과 확인
                  </Link>
                </Button>
              ) : null}

              {isSeatMapAnalyzed ? (
                <>
                  <Button asChild variant="outline">
                    <Link href={`/concerts/${concert.id}/practice`}>
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      티켓팅 연습 시작
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/concerts/${concert.id}/reviews`}>
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      좌석 리뷰 보기
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" disabled>
                    <PlayCircle className="h-4 w-4" aria-hidden="true" />
                    티켓팅 연습 시작
                  </Button>
                  <Button type="button" variant="outline" disabled>
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    좌석 리뷰 보기
                  </Button>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
