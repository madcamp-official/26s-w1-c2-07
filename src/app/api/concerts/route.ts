import { z } from "zod";

import { getConcertList } from "@/lib/concerts";
import { apiData, apiError } from "@/lib/api";

const concertListQuerySchema = z.object({
  scope: z.enum(["upcoming", "latest", "samples", "all"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = concertListQuerySchema.safeParse({
    scope: url.searchParams.get("scope") ?? undefined,
  });

  if (!parsed.success) {
    return apiError("공연 목록 조회 조건이 올바르지 않습니다.", 400);
  }

  const concerts = await getConcertList(parsed.data);

  return apiData({
    concerts,
  });
}
