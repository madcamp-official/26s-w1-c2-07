export const REVIEW_REPORT_REASONS = [
  "spam",
  "abuse",
  "privacy",
  "irrelevant",
  "other",
] as const;

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export const REVIEW_REPORT_REASON_LABELS: Record<ReviewReportReason, string> = {
  spam: "스팸/광고",
  abuse: "욕설/비방",
  privacy: "개인정보 노출",
  irrelevant: "공연/좌석과 무관",
  other: "기타",
};
