import { z } from "zod";

import { getConcertDetail } from "@/lib/concerts";
import { apiData, apiError } from "@/lib/api";

const concertParamsSchema = z.object({
  concertId: z.string().uuid(),
});

type ConcertRouteContext = {
  params: Promise<{
    concertId: string;
  }>;
};

export async function GET(_request: Request, { params }: ConcertRouteContext) {
  const parsed = concertParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return apiError("공연 ID가 올바르지 않습니다.", 400);
  }

  const concert = await getConcertDetail(parsed.data.concertId);

  if (!concert) {
    return apiError("공연을 찾을 수 없습니다.", 404);
  }

  return apiData({
    concert,
  });
}
