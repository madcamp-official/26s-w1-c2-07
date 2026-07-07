import { redirect } from "next/navigation";

import { SeatMapAnalysisPanel } from "@/app/concerts/[concertId]/seat-map/seat-map-analysis-panel";
import {
  getSeatMapPageData,
  getSeatMapStageHref,
  toSeatMapPanelData,
  type SeatMapRoutePageProps,
} from "@/app/concerts/[concertId]/seat-map/seat-map-page-data";
import { SeatMapPageShell } from "@/app/concerts/[concertId]/seat-map/seat-map-page-shell";

type SeatMapAnalysisPageProps = SeatMapRoutePageProps & {
  searchParams?: Promise<{
    autoAnalyze?: string;
  }>;
};

export default async function SeatMapAnalysisPage({
  params,
  searchParams,
}: SeatMapAnalysisPageProps) {
  const parsedSearchParams = await searchParams;
  const { concert, latestSeatMap } = await getSeatMapPageData(
    params,
    "analysis",
  );

  if (!latestSeatMap) {
    redirect(getSeatMapStageHref(concert.id, "upload"));
  }

  return (
    <SeatMapPageShell
      activeStage="analysis"
      concert={concert}
      latestSeatMap={latestSeatMap}
    >
      <div className="mt-6">
        <SeatMapAnalysisPanel
          key={`${latestSeatMap.id}-${latestSeatMap.totalSeatCount ?? "auto"}-analysis`}
          mode="analysis"
          autoAnalyze={parsedSearchParams?.autoAnalyze === "1"}
          editHref={getSeatMapStageHref(concert.id, "edit")}
          seatMap={toSeatMapPanelData(latestSeatMap)}
        />
      </div>
    </SeatMapPageShell>
  );
}
