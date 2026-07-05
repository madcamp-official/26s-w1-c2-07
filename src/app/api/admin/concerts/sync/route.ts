import { z } from "zod";

import { apiData, apiError } from "@/lib/api";
import { syncUpcomingConcerts } from "@/lib/concert-sync";

export const runtime = "nodejs";

const syncRequestSchema = z.object({
  monthsAhead: z.coerce.number().int().min(1).max(12).optional(),
  rows: z.coerce.number().int().min(1).max(50).optional(),
  pages: z.coerce.number().int().min(1).max(5).optional(),
  genreCode: z.string().trim().min(1).max(20).optional(),
});

function getExpectedSyncSecret() {
  return process.env.CONCERT_SYNC_SECRET ?? process.env.CRON_SECRET;
}

function isAuthorized(request: Request) {
  const expectedSecret = getExpectedSyncSecret();

  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerSecret = request.headers.get("x-sync-secret");

  return bearerToken === expectedSecret || headerSecret === expectedSecret;
}

function getQueryInput(request: Request) {
  const url = new URL(request.url);

  return {
    monthsAhead: url.searchParams.get("monthsAhead") ?? undefined,
    rows: url.searchParams.get("rows") ?? undefined,
    pages: url.searchParams.get("pages") ?? undefined,
    genreCode: url.searchParams.get("genreCode") ?? undefined,
  };
}

async function getJsonInput(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return {};
  }

  return request.json().catch(() => null);
}

async function handleSync(request: Request, input: unknown) {
  if (!isAuthorized(request)) {
    return apiError("공연 정보 동기화 권한이 없습니다.", 401);
  }

  const parsed = syncRequestSchema.safeParse(input);

  if (!parsed.success) {
    return apiError("공연 정보 동기화 입력값이 올바르지 않습니다.", 422);
  }

  try {
    const result = await syncUpcomingConcerts(parsed.data);

    return apiData({
      result,
    });
  } catch (error) {
    return apiError(
      error instanceof Error
        ? `공연 정보 동기화에 실패했습니다: ${error.message}`
        : "공연 정보 동기화에 실패했습니다.",
      500,
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request, getQueryInput(request));
}

export async function POST(request: Request) {
  const input = await getJsonInput(request);

  if (input === null) {
    return apiError("공연 정보 동기화 요청 형식이 올바르지 않습니다.", 400);
  }

  return handleSync(request, input);
}
