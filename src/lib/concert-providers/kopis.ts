import { XMLParser } from "fast-xml-parser";
import type { Prisma } from "@prisma/client";

import type {
  ExternalConcertFetchOptions,
  ExternalConcertInput,
} from "@/lib/concert-providers/types";

export const KOPIS_SOURCE = "kopis";

const DEFAULT_KOPIS_BASE_URL = "https://www.kopis.or.kr/openApi/restful";
const KST_TIME_ZONE = "Asia/Seoul";
const FALLBACK_ARTIST = "출연진 미정";
const FALLBACK_START_TIME = "시간 미정";

type KopisRawRecord = Record<string, unknown>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function getKopisApiKey() {
  const apiKey = process.env.KOPIS_API_KEY;

  if (!apiKey || apiKey.startsWith("replace-with-")) {
    throw new Error("KOPIS_API_KEY가 설정되지 않았습니다.");
  }

  return apiKey;
}

function getKopisBaseUrl() {
  return process.env.KOPIS_API_BASE_URL ?? DEFAULT_KOPIS_BASE_URL;
}

function getString(record: KopisRawRecord | null | undefined, key: string) {
  const value = record?.[key];

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function normalizeArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getKopisRecords(xmlText: string) {
  const parsed = xmlParser.parse(xmlText) as {
    dbs?: {
      db?: unknown;
    };
  };

  return normalizeArray(parsed.dbs?.db).filter(
    (record): record is KopisRawRecord =>
      Boolean(record && typeof record === "object" && !Array.isArray(record)),
  );
}

function assertNoKopisError(records: KopisRawRecord[]) {
  const errorRecord = records.find((record) => getString(record, "returncode"));

  if (!errorRecord) {
    return;
  }

  const returnCode = getString(errorRecord, "returncode");
  const message = getString(errorRecord, "errmsg") || "알 수 없는 KOPIS 오류";

  throw new Error(`KOPIS API 오류 ${returnCode}: ${message}`);
}

function formatKopisDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("KOPIS 조회 날짜를 만들 수 없습니다.");
  }

  return `${year}${month}${day}`;
}

function parseKopisDate(value: string, endOfDay = false) {
  const matched = value.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);

  if (!matched) {
    return null;
  }

  const [, year, month, day] = matched;
  const time = endOfDay ? "23:59:59" : "00:00:00";

  return new Date(`${year}-${month}-${day}T${time}+09:00`);
}

function parsePriceRange(value: string) {
  if (!value || value.includes("무료")) {
    return {
      priceMin: 0,
      priceMax: 0,
    };
  }

  const prices = Array.from(value.matchAll(/(\d[\d,]*)\s*원/g))
    .map((match) => Number.parseInt(match[1].replaceAll(",", ""), 10))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (prices.length === 0) {
    return {
      priceMin: 0,
      priceMax: 0,
    };
  }

  return {
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
  };
}

function parseStartTime(value: string) {
  const matched = value.match(/(\d{1,2})\s*(?::|시)\s*(\d{2})?/);

  if (!matched) {
    return FALLBACK_START_TIME;
  }

  const hour = Number.parseInt(matched[1], 10);
  const minute = matched[2] ? Number.parseInt(matched[2], 10) : 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return FALLBACK_START_TIME;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getBookingUrl(record: KopisRawRecord) {
  const related = record.relates;

  if (!related || typeof related !== "object") {
    return null;
  }

  const items = normalizeArray(
    (related as { relate?: KopisRawRecord | KopisRawRecord[] }).relate,
  );

  return (
    items
      .map((item) => getString(item, "relateurl"))
      .find((url) => url.startsWith("http://") || url.startsWith("https://")) ??
    null
  );
}

function getDescription(record: KopisRawRecord) {
  const parts = [
    getString(record, "sty"),
    getString(record, "dtguidance")
      ? `공연 시간: ${getString(record, "dtguidance")}`
      : "",
    getString(record, "prfstate")
      ? `공연 상태: ${getString(record, "prfstate")}`
      : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function fetchKopisXml(path: string, searchParams: Record<string, string>) {
  const url = new URL(`${getKopisBaseUrl().replace(/\/$/, "")}/${path}`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/xml,text/xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`KOPIS API 요청 실패: ${response.status}`);
  }

  return response.text();
}

async function fetchKopisDetail(externalId: string, apiKey: string) {
  const xmlText = await fetchKopisXml(`pblprfr/${encodeURIComponent(externalId)}`, {
    service: apiKey,
  });
  const records = getKopisRecords(xmlText);

  assertNoKopisError(records);

  return records[0] ?? null;
}

export function normalizeKopisConcert(input: {
  listRecord: KopisRawRecord;
  detailRecord?: KopisRawRecord | null;
}) {
  const record = {
    ...input.listRecord,
    ...(input.detailRecord ?? {}),
  };
  const externalId = getString(record, "mt20id");
  const startDate = parseKopisDate(getString(record, "prfpdfrom"));
  const endDate = parseKopisDate(getString(record, "prfpdto"), true);

  if (!externalId || !startDate || !endDate) {
    return null;
  }

  const priceRange = parsePriceRange(getString(record, "pcseguidance"));
  const startTime = parseStartTime(getString(record, "dtguidance"));
  const isSingleDay = formatKopisDate(startDate) === formatKopisDate(endDate);

  return {
    externalSource: KOPIS_SOURCE,
    externalId,
    title: getString(record, "prfnm") || "제목 미정",
    artist:
      getString(record, "prfcast") ||
      getString(record, "entrpsnm") ||
      FALLBACK_ARTIST,
    venueName: getString(record, "fcltynm") || "공연장 미정",
    region: getString(record, "area") || "지역 미정",
    startDate,
    endDate,
    priceMin: priceRange.priceMin,
    priceMax: priceRange.priceMax,
    posterImageUrl: getString(record, "poster") || null,
    description: getDescription(record),
    genre: getString(record, "genrenm") || null,
    bookingUrl: getBookingUrl(record),
    ticketOpenAt: null,
    rawExternalData: toJsonValue({
      list: input.listRecord,
      detail: input.detailRecord ?? null,
    }),
    schedules: [
      {
        performanceDate: startDate,
        roundName: isSingleDay ? "공연일" : "공연 기간",
        startTime,
      },
    ],
  } satisfies ExternalConcertInput;
}

export async function fetchKopisConcerts(options: ExternalConcertFetchOptions) {
  const apiKey = getKopisApiKey();
  const searchParams: Record<string, string> = {
    service: apiKey,
    stdate: formatKopisDate(options.from),
    eddate: formatKopisDate(options.to),
    cpage: String(options.page),
    rows: String(options.rows),
  };

  if (options.genreCode) {
    searchParams.shcate = options.genreCode;
  }

  const xmlText = await fetchKopisXml("pblprfr", searchParams);
  const listRecords = getKopisRecords(xmlText);

  assertNoKopisError(listRecords);

  const concerts: ExternalConcertInput[] = [];

  for (const listRecord of listRecords) {
    const externalId = getString(listRecord, "mt20id");
    const detailRecord = externalId
      ? await fetchKopisDetail(externalId, apiKey).catch(() => null)
      : null;
    const concert = normalizeKopisConcert({
      listRecord,
      detailRecord,
    });

    if (concert) {
      concerts.push(concert);
    }
  }

  return concerts;
}
