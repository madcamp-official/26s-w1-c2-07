import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ImageUp } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { SeatMapAnalysisPanel } from "@/app/concerts/[concertId]/seat-map/seat-map-analysis-panel";
import { SeatMapUploadForm } from "@/app/concerts/[concertId]/seat-map/seat-map-upload-form";
import { getConcertDetail } from "@/lib/concerts";
import { getCurrentUser } from "@/lib/auth";
import { getLatestSeatMapForConcert } from "@/lib/seat-maps";

const concertIdSchema = z.string().uuid();

type SeatMapPageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

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
            <ImageUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{concert.title}</p>
            <h1 className="mt-1 text-2xl font-semibold">
              좌석 배치도 업로드 및 AI 분석
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              공연장 좌석 배치도 이미지를 업로드하면 공연별 좌석 데이터의 기준
              이미지로 저장됩니다. 업로드된 이미지는 AI가 구역 후보를 분석하고,
              이후 티켓팅 연습과 좌석 리뷰의 기준 데이터로 사용됩니다.
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
