import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, ImageUp, MapPin } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SeatMapAnalysisPanel } from "@/app/concerts/[concertId]/seat-map/seat-map-analysis-panel";
import { SeatMapUploadForm } from "@/app/concerts/[concertId]/seat-map/seat-map-upload-form";
import { getConcertDetail } from "@/lib/concerts";
import { getCurrentUser } from "@/lib/auth";
import { getLatestSeatMapForConcert } from "@/lib/seat-maps";
import { formatDateRange } from "@/utils/format";

const concertIdSchema = z.string().uuid();

type SeatMapPageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

function SeatMapStep({
  index,
  title,
  description,
  state,
}: {
  index: number;
  title: string;
  description: string;
  state: "done" | "active" | "idle";
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black",
          state === "done"
            ? "border-primary bg-background text-primary"
            : state === "active"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : index}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  );
}

export default async function SeatMapPage({ params }: SeatMapPageProps) {
  const { concertId } = await params;
  const parsedConcertId = concertIdSchema.safeParse(concertId);

  if (!parsedConcertId.success) {
    notFound();
  }

  const concert = await getConcertDetail(parsedConcertId.data);

  if (!concert) {
    notFound();
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?redirect=/concerts/${concert.id}/seat-map`);
  }

  const latestSeatMap = await getLatestSeatMapForConcert(concert.id);
  const hasSeatMap = Boolean(latestSeatMap);
  const analysisDone = latestSeatMap?.analysisStatus === "success";

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/concerts/${concert.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          공연 상세
        </Link>
      </Button>

      <section className="mt-5">
        <p className="text-sm font-semibold text-muted-foreground">
          공연 목록 / 배치도 등록
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">
          배치도 등록
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          이미지를 업로드하면 AI가 좌석 구역을 분석하고, 티켓팅 연습과 리뷰의
          기준 배치도로 사용할 수 있습니다.
        </p>

        <div className="mt-7 grid gap-4 rounded-lg border bg-card p-5 shadow-sm lg:grid-cols-3">
          <SeatMapStep
            index={1}
            title="이미지 업로드"
            description="배치도 이미지 등록"
            state={hasSeatMap ? "done" : "active"}
          />
          <SeatMapStep
            index={2}
            title="AI 분석"
            description="구역 정보 추출"
            state={
              analysisDone ? "done" : hasSeatMap ? "active" : "idle"
            }
          />
          <SeatMapStep
            index={3}
            title="저장 완료"
            description="배치도 생성 완료"
            state={analysisDone ? "active" : "idle"}
          />
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)_auto] md:items-center">
          <div className="relative aspect-[16/10] overflow-hidden rounded-md border bg-secondary">
            {concert.posterImageUrl ? (
              <Image
                src={concert.posterImageUrl}
                alt={`${concert.title} 포스터`}
                fill
                sizes="140px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                포스터
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-black">{concert.title}</h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {concert.venueName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatDateRange(concert.startDate, concert.endDate)}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black">이미지 업로드</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              JPG, PNG 형식의 좌석 배치도를 등록하면 아래 분석 패널에서 AI 구역
              추출과 수정 작업을 이어갈 수 있습니다.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SeatMapUploadForm concertId={concert.id} />
        </div>
      </section>

      {latestSeatMap ? (
        <div className="mt-6">
          <SeatMapAnalysisPanel
            seatMap={{
              id: latestSeatMap.id,
              imageUrl: latestSeatMap.imageUrl,
              analysisStatus: latestSeatMap.analysisStatus,
              zones: latestSeatMap.zones.map((zone) => ({
                id: zone.id,
                name: zone.name,
                grade: zone.grade,
                price: zone.price,
                bbox: zone.bbox,
                polygon: zone.polygon,
                confidence: zone.confidence,
                isAiGenerated: zone.isAiGenerated,
              })),
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
