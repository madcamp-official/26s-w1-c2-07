"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquare,
  Save,
  Star,
  Ticket,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PRACTICE_DIFFICULTY_LABELS,
  PRACTICE_TEMPLATE_LABELS,
} from "@/lib/practice";
import { formatSeatCode } from "@/utils/format";
import type {
  PracticeDifficulty,
  TicketTemplateType,
} from "@/types/practice";

type MyUser = {
  id: string;
  email: string;
};

type MyProfile = {
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
};

type MyReview = {
  id: string;
  concert: {
    id: string;
    title: string;
    venueName: string;
  };
  zone: {
    id: string;
    name: string;
    grade: string;
  } | null;
  seatFloor: string | null;
  seatSection: string | null;
  seatRow: string | null;
  seatNumber: string | null;
  viewScore: number;
  soundScore: number;
  distanceScore: number;
  satisfactionScore: number;
  content: string;
  imageUrl: string | null;
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
};

type PracticeStatus = "started" | "success" | "failed";

type MyPracticeSession = {
  id: string;
  concert: {
    id: string;
    title: string;
    venueName: string;
  };
  schedule: {
    id: string;
    performanceDate: string;
    roundName: string;
    startTime: string;
  } | null;
  templateType: TicketTemplateType;
  difficulty: PracticeDifficulty;
  status: PracticeStatus;
  selectedZone: {
    id: string;
    name: string;
    grade: string;
  } | null;
  selectedSeat: {
    id: string;
    rowLabel: string;
    seatNumber: number;
  } | null;
  elapsedMs: number;
  startDelayMs: number;
  failReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

type MyPageClientProps = {
  initialUser: MyUser;
  initialProfile: MyProfile;
  initialReviews: MyReview[];
  initialPracticeSessions: MyPracticeSession[];
};

type ActiveTab = "reviews" | "practice";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

const PRACTICE_STATUS_LABELS: Record<PracticeStatus, string> = {
  started: "미완료",
  success: "성공",
  failed: "실패",
};

const REVIEW_SCORE_FIELDS = [
  {
    key: "viewScore",
    label: "시야",
  },
  {
    key: "soundScore",
    label: "음향",
  },
  {
    key: "distanceScore",
    label: "거리감",
  },
  {
    key: "satisfactionScore",
    label: "만족도",
  },
] as const;

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatReviewSeat(review: MyReview) {
  if (
    review.seatFloor &&
    review.seatSection &&
    review.seatRow &&
    review.seatNumber
  ) {
    const floorLabel =
      review.seatFloor === "floor" ? "Floor층" : `${review.seatFloor}층`;

    return `${floorLabel} · ${formatSeatCode(review.seatSection)}구역 · ${formatSeatCode(
      review.seatRow,
    )}행 · ${formatSeatCode(review.seatNumber)}열`;
  }

  if (review.zone) {
    return `${review.zone.name} · ${review.zone.grade}`;
  }

  return "좌석 정보 미입력";
}

function getReviewImageUrls(review: MyReview) {
  return review.imageUrls.length > 0
    ? review.imageUrls
    : review.imageUrl
      ? [review.imageUrl]
      : [];
}

function formatElapsed(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const totalSeconds = Math.round(safeMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds}초`;
}

function formatAverageElapsed(milliseconds: number | null) {
  return milliseconds === null ? "-" : formatElapsed(milliseconds);
}

function getStatusTone(status: PracticeStatus) {
  if (status === "success") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-muted bg-secondary text-muted-foreground";
}

export function MyPageClient({
  initialUser,
  initialProfile,
  initialReviews,
  initialPracticeSessions,
}: MyPageClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [nickname, setNickname] = useState(initialProfile.nickname ?? "");
  const [reviews, setReviews] = useState(initialReviews);
  const [practiceSessions] = useState(initialPracticeSessions);
  const [activeTab, setActiveTab] = useState<ActiveTab>("reviews");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const completedSessions = practiceSessions.filter(
      (session) => session.status !== "started",
    );
    const successCount = practiceSessions.filter(
      (session) => session.status === "success",
    ).length;
    const elapsedValues = completedSessions
      .map((session) => session.elapsedMs)
      .filter((elapsedMs) => elapsedMs > 0);
    const averageElapsedMs =
      elapsedValues.length > 0
        ? Math.round(
            elapsedValues.reduce((total, elapsedMs) => total + elapsedMs, 0) /
              elapsedValues.length,
          )
        : null;
    const successRate =
      completedSessions.length > 0
        ? Math.round((successCount / completedSessions.length) * 100)
        : null;

    return {
      reviewCount: reviews.length,
      practiceCount: practiceSessions.length,
      successCount,
      successRate,
      averageElapsedMs,
    };
  }, [practiceSessions, reviews.length]);

  const displayName = profile.nickname?.trim() || initialUser.email || "사용자";

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      setMessage("닉네임을 입력해주세요.");
      return;
    }

    setIsSavingProfile(true);
    setMessage("");

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: trimmedNickname,
        }),
      });
      const payload = await readApiResponse<{ profile: MyProfile }>(response);

      if (!response.ok || !payload.data?.profile) {
        throw new Error(payload.error?.message ?? "프로필 저장에 실패했습니다.");
      }

      setProfile(payload.data.profile);
      setNickname(payload.data.profile.nickname ?? "");
      setMessage("프로필을 저장했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "프로필 저장에 실패했습니다.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleDeleteReview(review: MyReview) {
    const confirmed = window.confirm("이 리뷰를 삭제할까요?");

    if (!confirmed) {
      return;
    }

    setDeletingReviewId(review.id);
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${review.id}`, {
        method: "DELETE",
      });
      const payload = await readApiResponse<{ deleted: boolean }>(response);

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "리뷰 삭제에 실패했습니다.");
      }

      setReviews((currentReviews) =>
        currentReviews.filter((item) => item.id !== review.id),
      );
      setMessage("리뷰를 삭제했습니다.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "리뷰 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">마이페이지</p>
              <h1 className="mt-1 text-2xl font-black">{displayName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {initialUser.email}
              </p>
            </div>
          </div>

          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,220px)_auto]"
            onSubmit={handleProfileSubmit}
          >
            <label className="grid gap-1.5 text-sm font-medium">
              닉네임
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={nickname}
                maxLength={30}
                onChange={(event) => setNickname(event.target.value)}
                disabled={isSavingProfile}
              />
            </label>
            <Button
              className="self-end"
              type="submit"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              저장
            </Button>
          </form>
        </div>

        {message ? (
          <p className="mt-5 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="작성 리뷰" value={`${summary.reviewCount}개`} />
        <SummaryCard label="연습 횟수" value={`${summary.practiceCount}회`} />
        <SummaryCard label="성공 횟수" value={`${summary.successCount}회`} />
        <SummaryCard
          label="성공률"
          value={summary.successRate === null ? "-" : `${summary.successRate}%`}
        />
        <SummaryCard
          label="평균 소요"
          value={formatAverageElapsed(summary.averageElapsedMs)}
        />
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b pb-4">
          <button
            type="button"
            className={[
              "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-bold transition",
              activeTab === "reviews"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:border-primary/60",
            ].join(" ")}
            onClick={() => setActiveTab("reviews")}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            내 리뷰
          </button>
          <button
            type="button"
            className={[
              "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-bold transition",
              activeTab === "practice"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:border-primary/60",
            ].join(" ")}
            onClick={() => setActiveTab("practice")}
          >
            <Ticket className="h-4 w-4" aria-hidden="true" />
            연습 기록
          </button>
        </div>

        {activeTab === "reviews" ? (
          <ReviewList
            reviews={reviews}
            deletingReviewId={deletingReviewId}
            onDeleteReview={handleDeleteReview}
          />
        ) : (
          <PracticeSessionList practiceSessions={practiceSessions} />
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReviewList({
  reviews,
  deletingReviewId,
  onDeleteReview,
}: {
  reviews: MyReview[];
  deletingReviewId: string | null;
  onDeleteReview: (review: MyReview) => void;
}) {
  if (reviews.length === 0) {
    return (
      <div className="mt-5 rounded-md border bg-secondary px-4 py-8 text-center text-sm text-muted-foreground">
        아직 작성한 좌석 리뷰가 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {reviews.map((review) => {
        const isDeleting = deletingReviewId === review.id;

        return (
          <article
            key={review.id}
            className="min-w-0 overflow-hidden rounded-md border p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium">
                  {review.concert.title}
                </p>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {review.concert.venueName} · {formatReviewSeat(review)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(review.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/concerts/${review.concert.id}/reviews`}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    보기
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => onDeleteReview(review)}
                >
                  {isDeleting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  삭제
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {REVIEW_SCORE_FIELDS.map((field) => (
                <span
                  key={field.key}
                  className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-1"
                >
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {field.label} {review[field.key]}/5
                </span>
              ))}
            </div>

            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {review.content}
            </p>

            {getReviewImageUrls(review).length > 0 ? (
              <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                {getReviewImageUrls(review).map((imageUrl, imageIndex) => (
                  <div
                    key={imageUrl}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md border bg-secondary sm:h-28 sm:w-28"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`리뷰 시야 사진 ${imageIndex + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PracticeSessionList({
  practiceSessions,
}: {
  practiceSessions: MyPracticeSession[];
}) {
  if (practiceSessions.length === 0) {
    return (
      <div className="mt-5 rounded-md border bg-secondary px-4 py-8 text-center text-sm text-muted-foreground">
        아직 저장된 티켓팅 연습 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {practiceSessions.map((session) => (
        <article key={session.id} className="rounded-md border p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{session.concert.title}</p>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
                    getStatusTone(session.status),
                  ].join(" ")}
                >
                  {session.status === "success" ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : session.status === "failed" ? (
                    <XCircle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3 w-3" aria-hidden="true" />
                  )}
                  {PRACTICE_STATUS_LABELS[session.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.concert.venueName} ·{" "}
                {PRACTICE_TEMPLATE_LABELS[session.templateType]} ·{" "}
                {PRACTICE_DIFFICULTY_LABELS[session.difficulty]}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(session.createdAt)}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/concerts/${session.concert.id}/practice`}>
                <Ticket className="h-4 w-4" aria-hidden="true" />
                다시 연습
              </Link>
            </Button>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <InfoCell label="소요 시간" value={formatElapsed(session.elapsedMs)} />
            <InfoCell
              label="시작 반응"
              value={formatElapsed(session.startDelayMs)}
            />
            <InfoCell
              label="회차"
              value={
                session.schedule
                  ? `${session.schedule.roundName} · ${session.schedule.startTime}`
                  : "미선택"
              }
            />
            <InfoCell
              label="선택 구역"
              value={
                session.selectedZone
                  ? `${session.selectedZone.name} · ${session.selectedZone.grade}`
                  : "미선택"
              }
            />
            <InfoCell
              label="선택 좌석"
              value={
                session.selectedSeat
                  ? `${session.selectedSeat.rowLabel}열 ${session.selectedSeat.seatNumber}번`
                  : "미선택"
              }
            />
          </div>

          {session.failReason ? (
            <p className="mt-4 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
              실패 사유: {session.failReason}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}
