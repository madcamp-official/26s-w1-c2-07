import { redirect } from "next/navigation";

import {
  getSeatMapStageHref,
  type SeatMapRoutePageProps,
} from "@/app/concerts/[concertId]/seat-map/seat-map-page-data";

export default async function SeatMapPage({ params }: SeatMapRoutePageProps) {
  const { concertId } = await params;

  redirect(getSeatMapStageHref(concertId, "upload"));
}
