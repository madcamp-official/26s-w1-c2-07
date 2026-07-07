"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Flag, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  REVIEW_REPORT_REASON_LABELS,
  REVIEW_REPORT_REASONS,
  type ReviewReportReason,
} from "@/lib/review-reports";

type ReviewReportFormProps = {
  reviewId: string;
};

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

type ReportResponse = {
  alreadyReported: boolean;
};

async function readApiResponse<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as ApiResponse<T>;
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      error: {
        message: response.ok
          ? "응답을 해석하지 못했습니다."
          : "요청 처리 중 서버 오류가 발생했습니다.",
      },
    } satisfies ApiResponse<T>;
  }
}

export function ReviewReportForm({ reviewId }: ReviewReportFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReviewReportReason>(
    REVIEW_REPORT_REASONS[0],
  );
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
          details,
        }),
      });
      const result = await readApiResponse<ReportResponse>(response);

      if (!response.ok) {
        setMessage(result.error?.message ?? "신고 접수에 실패했습니다.");
        return;
      }

      setIsReported(true);
      setIsOpen(false);
      setMessage(
        result.data?.alreadyReported
          ? "이미 신고한 리뷰입니다."
          : "신고가 접수되었습니다.",
      );
    } catch {
      setMessage("신고 접수 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">리뷰 신고</p>
        <Button
          type="button"
          variant={isReported ? "secondary" : "outline"}
          size="sm"
          disabled={isSubmitting || isReported}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isReported ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Flag className="h-4 w-4" aria-hidden="true" />
          )}
          {isReported ? "신고 완료" : "신고하기"}
        </Button>
      </div>

      {message ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      {isOpen ? (
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold">
            신고 사유
            <select
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reason}
              disabled={isSubmitting}
              onChange={(event) =>
                setReason(event.target.value as ReviewReportReason)
              }
            >
              {REVIEW_REPORT_REASONS.map((reportReason) => (
                <option key={reportReason} value={reportReason}>
                  {REVIEW_REPORT_REASON_LABELS[reportReason]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            추가 설명
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={details}
              maxLength={500}
              disabled={isSubmitting}
              placeholder="필요한 경우 신고 내용을 입력해주세요."
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              취소
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Flag className="h-4 w-4" aria-hidden="true" />
              )}
              접수
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
