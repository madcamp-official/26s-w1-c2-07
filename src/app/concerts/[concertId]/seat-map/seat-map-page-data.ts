import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { getConcertDetail } from "@/lib/concerts";
import { getLatestSeatMapForConcert } from "@/lib/seat-maps";

const concertIdSchema = z.string().uuid();

export type SeatMapStage = "upload" | "analysis" | "edit";

export type SeatMapRoutePageProps = {
  params: Promise<{
    concertId: string;
  }>;
};

type LatestSeatMap = NonNullable<
  Awaited<ReturnType<typeof getLatestSeatMapForConcert>>
>;

export function getSeatMapStageHref(concertId: string, stage: SeatMapStage) {
  return `/concerts/${concertId}/seat-map/${stage}`;
}

export async function getSeatMapPageData(
  params: SeatMapRoutePageProps["params"],
  stage: SeatMapStage,
) {
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
    redirect(
      `/login?redirect=${encodeURIComponent(getSeatMapStageHref(concert.id, stage))}`,
    );
  }

  const latestSeatMap = await getLatestSeatMapForConcert(concert.id, user.id);

  return {
    concert,
    latestSeatMap,
  };
}

export function toSeatMapPanelData(seatMap: LatestSeatMap) {
  return {
    id: seatMap.id,
    imageUrl: seatMap.imageUrl,
    imageWidth: seatMap.imageWidth,
    imageHeight: seatMap.imageHeight,
    totalSeatCount: seatMap.totalSeatCount,
    analysisStatus: seatMap.analysisStatus,
    zones: seatMap.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      grade: zone.grade,
      price: zone.price,
      allocatedSeatCount: zone.allocatedSeatCount,
      bbox: zone.bbox,
      polygon: zone.polygon,
      confidence: zone.confidence,
      isAiGenerated: zone.isAiGenerated,
    })),
  };
}
