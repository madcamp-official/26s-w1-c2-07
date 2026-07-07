import Link from "next/link";
import { ArrowRight, ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getSeatMapPageData,
  getSeatMapStageHref,
  type SeatMapRoutePageProps,
} from "@/app/concerts/[concertId]/seat-map/seat-map-page-data";
import { SeatMapPageShell } from "@/app/concerts/[concertId]/seat-map/seat-map-page-shell";
import { SeatMapUploadForm } from "@/app/concerts/[concertId]/seat-map/seat-map-upload-form";

export default async function SeatMapUploadPage({
  params,
}: SeatMapRoutePageProps) {
  const { concert, latestSeatMap } = await getSeatMapPageData(params, "upload");
  const analysisHref = getSeatMapStageHref(concert.id, "analysis");
  const autoAnalysisHref = `${analysisHref}?autoAnalyze=1`;

  return (
    <SeatMapPageShell
      activeStage="upload"
      concert={concert}
      latestSeatMap={latestSeatMap}
    >
      <section className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageUp className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-black">이미지 업로드</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              JPG, PNG 형식의 좌석 배치도를 등록합니다. 업로드가 끝나면 AI 분석
              페이지에서 구역 추출을 진행합니다.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SeatMapUploadForm
            concertId={concert.id}
            redirectHref={autoAnalysisHref}
          />
        </div>
      </section>

      {latestSeatMap ? (
        <section className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
            <div>
              <h2 className="text-xl font-black">최근 업로드 이미지</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                새 이미지를 올리면 기존 배치도 대신 최신 업로드 이미지를
                기준으로 분석합니다.
              </p>
              <Button asChild className="mt-4">
                <Link href={autoAnalysisHref}>
                  AI 분석하기
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={latestSeatMap.imageUrl}
                alt="최근 업로드된 좌석 배치도"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </section>
      ) : null}
    </SeatMapPageShell>
  );
}
