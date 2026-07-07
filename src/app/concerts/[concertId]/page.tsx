import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  CalendarDays,
  ChevronRight,
  ExternalLink,
  ImageUp,
  MapPin,
  Megaphone,
  MessageSquare,
  PlayCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getConcertDetail } from "@/lib/concerts";
import { formatDateRange } from "@/utils/format";

const concertIdSchema = z.string().uuid();

type ConcertDetailPageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

function ConcertPoster({ src, title }: { src: string | null; title: string }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-secondary shadow-sm">
      {src ? (
        <Image
          src={src}
          alt={`${title} 포스터`}
          fill
          priority
          sizes="(min-width: 1024px) 260px, 70vw"
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

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 items-center gap-5 rounded-lg border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md"
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-black">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="h-6 w-6 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}

export default async function ConcertDetailPage({
  params,
}: ConcertDetailPageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const user = await getCurrentUser();
  const concert = await getConcertDetail(parsedConcertId.data, {
    seatMapOwnerId: user?.id ?? null,
  });

  if (!concert) {
    notFound();
  }

  const isSeatMapAnalyzed =
    concert.latestSeatMap?.analysisStatus === "success" &&
    concert.latestSeatMap.zoneCount > 0;
  const seatMapHref = !concert.hasSeatMap
    ? `/concerts/${concert.id}/seat-map/upload`
    : isSeatMapAnalyzed
      ? `/concerts/${concert.id}/seat-map/edit`
      : `/concerts/${concert.id}/seat-map/analysis`;
  const practiceHref = isSeatMapAnalyzed
    ? `/practice?concertId=${concert.id}`
    : seatMapHref;
  const concertDateRange = formatDateRange(concert.startDate, concert.endDate);
  const infoRows = [
    {
      label: "공연소개",
      value: concert.description ?? "등록된 공연 소개가 없습니다.",
    },
    {
      label: "공연일정",
      value: concertDateRange,
    },
    {
      label: "공연장",
      value: `${concert.region} · ${concert.venueName}`,
    },
    {
      label: "좌석 데이터",
      value: "배치도 등록 화면에서 내 좌석 데이터를 확인할 수 있습니다.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          홈
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <Link href="/concerts" className="hover:text-primary">
          공연
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-foreground">공연 상세</span>
      </nav>

      <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div>
          <div className="grid gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
            <ConcertPoster src={concert.posterImageUrl} title={concert.title} />

            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-primary/12 px-3 py-1 text-sm font-bold text-primary">
                  공연 정보
                </span>
                {concert.genre ? (
                  <span className="rounded-md bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
                    {concert.genre}
                  </span>
                ) : null}
                {concert.isSample ? (
                  <span className="rounded-md bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
                    샘플 공연
                  </span>
                ) : null}
              </div>

              <h1 className="mt-5 break-words text-4xl font-black leading-tight tracking-normal">
                {concert.title}
              </h1>

              <div className="mt-6 space-y-3 text-base font-medium text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                  {concert.venueName}
                </p>
                <p className="flex items-center gap-2">
                  <CalendarDays
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                  {formatDateRange(concert.startDate, concert.endDate)}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-md bg-muted px-3 py-1.5 text-sm font-semibold">
                  리뷰 {concert.reviewCount}개
                </span>
                <span className="rounded-md bg-muted px-3 py-1.5 text-sm font-semibold">
                  연습 기록 {concert.practiceSessionCount}개
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t pt-8">
            <dl className="grid gap-x-8 gap-y-5 text-sm md:grid-cols-[140px_minmax(0,1fr)]">
              {infoRows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="font-black text-foreground">{row.label}</dt>
                  <dd className="leading-6 text-muted-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {concert.bookingUrl ? (
              <Button asChild variant="outline" className="mt-7">
                <a href={concert.bookingUrl} target="_blank" rel="noreferrer">
                  예매 정보 보기
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <aside className="space-y-5 lg:border-l lg:pl-10">
          <ActionCard
            href={seatMapHref}
            icon={<ImageUp className="h-8 w-8" aria-hidden="true" />}
            title="배치도 등록"
            description="공연장의 좌석 배치도를 등록하고 AI 분석 결과를 확인하세요."
          />
          <ActionCard
            href={practiceHref}
            icon={<PlayCircle className="h-8 w-8" aria-hidden="true" />}
            title="티켓팅 연습"
            description="사이트별 예매 흐름과 좌석 선택 과정을 실전처럼 연습하세요."
          />
          <ActionCard
            href={`/reviews?concertId=${concert.id}`}
            icon={<MessageSquare className="h-8 w-8" aria-hidden="true" />}
            title="좌석 리뷰"
            description="다른 사람들의 좌석 후기를 확인하고 나의 리뷰도 남겨보세요."
          />

          <div className="rounded-lg border bg-primary/5 p-5 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Megaphone
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p>
                공연 일정 및 좌석 배치는 주최측 사정에 따라 변경될 수 있습니다.
                연습용 좌석 데이터는 실제 좌석 정보와 다를 수 있습니다.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
