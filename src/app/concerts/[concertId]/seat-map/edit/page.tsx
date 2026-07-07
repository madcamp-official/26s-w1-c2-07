import { redirect } from "next/navigation";

import { SeatMapAnalysisPanel } from "@/app/concerts/[concertId]/seat-map/seat-map-analysis-panel";
import {
  getSeatMapPageData,
  getSeatMapStageHref,
  toSeatMapPanelData,
  type SeatMapRoutePageProps,
} from "@/app/concerts/[concertId]/seat-map/seat-map-page-data";
import { SeatMapPageShell } from "@/app/concerts/[concertId]/seat-map/seat-map-page-shell";

export default async function SeatMapEditPage({
  params,
}: SeatMapRoutePageProps) {
  const { concert, latestSeatMap } = await getSeatMapPageData(params, "edit");

  if (!latestSeatMap) {
    redirect(getSeatMapStageHref(concert.id, "upload"));
  }

  if (latestSeatMap.analysisStatus !== "success") {
    redirect(getSeatMapStageHref(concert.id, "analysis"));
  }

  return (
    <SeatMapPageShell
      activeStage="edit"
      concert={concert}
      latestSeatMap={latestSeatMap}
    >
      <div className="mt-6">
        <SeatMapAnalysisPanel
          key={`${latestSeatMap.id}-${latestSeatMap.totalSeatCount ?? "auto"}-edit`}
          mode="edit"
          analysisHref={getSeatMapStageHref(concert.id, "analysis")}
          practiceHref={`/practice?concertId=${encodeURIComponent(concert.id)}`}
          seatMap={toSeatMapPanelData(latestSeatMap)}
        />
      </div>
    </SeatMapPageShell>
  );
}
