"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  MessageSquare,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getBboxCenter,
  getPolygonCenter,
  getPolygonPointsAttribute,
  isBboxCornerPolygon,
  parseBbox,
  parsePolygon,
  type BoundingBox,
  type Point,
} from "@/lib/seat-zone-geometry";

type ConcertSummary = {
  id: string;
  title: string;
  artist: string;
  venueName: string;
  region: string;
};

type SeatMapZone = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
  bbox: unknown;
  polygon: unknown;
};

type SeatMapZoneWithGeometry = Omit<SeatMapZone, "bbox" | "polygon"> & {
  bbox: BoundingBox;
  polygon: Point[] | null;
  labelPoint: Point;
  needsGeometryReview: boolean;
};

type ReviewUser = {
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
};

type ReviewItem = {
  id: string;
  userId: string;
  zoneId: string;
  viewScore: number;
  soundScore: number;
  distanceScore: number;
  satisfactionScore: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user: ReviewUser;
};

type ReviewSummary = {
  count: number;
  averageViewScore: number | null;
  averageSoundScore: number | null;
  averageDistanceScore: number | null;
  averageSatisfactionScore: number | null;
};

type ReviewsResponse = {
  data?: {
    reviews: ReviewItem[];
    summary: ReviewSummary;
  };
  error?: {
    message?: string;
  };
};

type MutationResponse = {
  data?: {
    review?: ReviewItem;
    deleted?: boolean;
  };
  error?: {
    message?: string;
  };
};

type ReviewClientProps = {
  concert: ConcertSummary;
  currentUserId: string | null;
  seatMap: {
    id: string;
    imageUrl: string;
    zones: SeatMapZone[];
  };
};

type ScoreKey =
  | "viewScore"
  | "soundScore"
  | "distanceScore"
  | "satisfactionScore";

type ScoreState = Record<ScoreKey, number>;

const SCORE_FIELDS: Array<{
  key: ScoreKey;
  label: string;
}> = [
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
];

const DEFAULT_SCORES: ScoreState = {
  viewScore: 5,
  soundScore: 5,
  distanceScore: 5,
  satisfactionScore: 5,
};

async function readMutationResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as MutationResponse;
  }

  try {
    return JSON.parse(text) as MutationResponse;
  } catch {
    return {
      error: {
        message: response.ok
          ? "리뷰 응답을 해석하지 못했습니다."
          : "리뷰 요청 처리 중 서버 오류가 발생했습니다.",
      },
    } satisfies MutationResponse;
  }
}

async function readReviewsResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as ReviewsResponse;
  }

  try {
    return JSON.parse(text) as ReviewsResponse;
  } catch {
    return {
      error: {
        message: response.ok
          ? "리뷰 목록 응답을 해석하지 못했습니다."
          : "리뷰 목록 요청 처리 중 서버 오류가 발생했습니다.",
      },
    } satisfies ReviewsResponse;
  }
}

function formatPrice(price: number | null) {
  return typeof price === "number"
    ? `${price.toLocaleString("ko-KR")}원`
    : "가격 미입력";
}

function formatAverageScore(score: number | null) {
  return typeof score === "number" ? score.toFixed(1) : "-";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getDisplayName(user: ReviewUser) {
  return user.nickname?.trim() || "사용자";
}

export function ReviewClient({
  concert,
  currentUserId,
  seatMap,
}: ReviewClientProps) {
  const router = useRouter();
  const zones = useMemo(
    () =>
      seatMap.zones
        .map((zone) => {
          const bbox = parseBbox(zone.bbox);
          const parsedPolygon = parsePolygon(zone.polygon);
          const polygon =
            parsedPolygon && bbox && !isBboxCornerPolygon(parsedPolygon, bbox)
              ? parsedPolygon
              : null;

          return {
            ...zone,
            bbox,
            polygon,
            labelPoint: polygon
              ? getPolygonCenter(polygon)
              : bbox
                ? getBboxCenter(bbox)
                : null,
            needsGeometryReview: !polygon,
          };
        })
        .filter(
          (zone): zone is SeatMapZoneWithGeometry =>
            Boolean(zone.bbox && zone.labelPoint),
        ),
    [seatMap.zones],
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    zones[0]?.id ?? null,
  );
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({
    count: 0,
    averageViewScore: null,
    averageSoundScore: null,
    averageDistanceScore: null,
    averageSatisfactionScore: null,
  });
  const [scores, setScores] = useState<ScoreState>(DEFAULT_SCORES);
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const imagePreviewUrlRef = useRef<string | null>(null);

  const selectedZone =
    zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null;
  const isEditing = Boolean(editingReviewId);

  const fetchReviews = useCallback(async (zoneId: string) => {
    setIsLoadingReviews(true);
    setMessage("");

    try {
      const response = await fetch(`/api/seat-zones/${zoneId}/reviews`);
      const payload = await readReviewsResponse(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "구역 리뷰를 불러오지 못했습니다.",
        );
      }

      setReviews(payload.data?.reviews ?? []);
      setSummary(
        payload.data?.summary ?? {
          count: 0,
          averageViewScore: null,
          averageSoundScore: null,
          averageDistanceScore: null,
          averageSatisfactionScore: null,
        },
      );
    } catch (error) {
      setReviews([]);
      setSummary({
        count: 0,
        averageViewScore: null,
        averageSoundScore: null,
        averageDistanceScore: null,
        averageSatisfactionScore: null,
      });
      setMessage(
        error instanceof Error
          ? error.message
          : "구역 리뷰를 불러오지 못했습니다.",
      );
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedZoneId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchReviews(selectedZoneId);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchReviews, selectedZoneId]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []);

  function replaceImageFile(nextImageFile: File | null) {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }

    setImageFile(nextImageFile);

    if (!nextImageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextImageFile);
    imagePreviewUrlRef.current = nextPreviewUrl;
    setImagePreviewUrl(nextPreviewUrl);
  }

  function resetForm() {
    setScores(DEFAULT_SCORES);
    setContent("");
    replaceImageFile(null);
    setEditingReviewId(null);
  }

  function selectZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    resetForm();
    setMessage("");
  }

  function updateScore(key: ScoreKey, value: number) {
    setScores((currentScores) => ({
      ...currentScores,
      [key]: value,
    }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    replaceImageFile(nextFile);
  }

  function startEdit(review: ReviewItem) {
    setEditingReviewId(review.id);
    setScores({
      viewScore: review.viewScore,
      soundScore: review.soundScore,
      distanceScore: review.distanceScore,
      satisfactionScore: review.satisfactionScore,
    });
    setContent(review.content);
    replaceImageFile(null);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedZone) {
      setMessage("리뷰를 작성할 좌석 구역을 선택해주세요.");
      return;
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length < 10) {
      setMessage("리뷰 내용은 10자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = editingReviewId
        ? await fetch(`/api/reviews/${editingReviewId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...scores,
              content: trimmedContent,
            }),
          })
        : await (() => {
            const formData = new FormData();

            for (const field of SCORE_FIELDS) {
              formData.append(field.key, String(scores[field.key]));
            }

            formData.append("content", trimmedContent);

            if (imageFile) {
              formData.append("image", imageFile);
            }

            return fetch(`/api/seat-zones/${selectedZone.id}/reviews`, {
              method: "POST",
              body: formData,
            });
          })();
      const payload = await readMutationResponse(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            (editingReviewId
              ? "리뷰 수정에 실패했습니다."
              : "리뷰 작성에 실패했습니다."),
        );
      }

      setMessage(editingReviewId ? "리뷰를 수정했습니다." : "리뷰를 작성했습니다.");
      resetForm();
      await fetchReviews(selectedZone.id);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingReviewId
            ? "리뷰 수정에 실패했습니다."
            : "리뷰 작성에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(review: ReviewItem) {
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
      const payload = await readMutationResponse(response);

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "리뷰 삭제에 실패했습니다.");
      }

      if (editingReviewId === review.id) {
        resetForm();
      }

      setMessage("리뷰를 삭제했습니다.");

      if (selectedZone) {
        await fetchReviews(selectedZone.id);
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "리뷰 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingReviewId(null);
    }
  }

  if (!selectedZone) {
    return (
      <section className="mt-5 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-black">좌석 구역 리뷰</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          리뷰를 연결할 수 있는 좌석 구역 좌표가 없습니다. 좌석 배치도 분석
          결과를 확인해주세요.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <p className="text-sm text-muted-foreground">
            {concert.artist} · {concert.region} · {concert.venueName}
          </p>
          <h1 className="mt-1 text-2xl font-black">좌석 구역 리뷰</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            좌석 배치도에서 구역을 선택하면 해당 구역의 시야, 음향, 거리감
            후기를 확인하고 작성할 수 있습니다.
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border bg-secondary">
          <div className="relative">
            {/* Keep the rendered bitmap and zone overlay in the same coordinate space. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seatMap.imageUrl}
              alt="좌석 배치도"
              className="block h-auto w-full"
            />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-label="리뷰 좌석 구역 선택"
            >
              {zones.map((zone) => {
                const isSelected = selectedZone.id === zone.id;
                const zoneLabel = `${zone.name} ${zone.grade}`;

                return (
                  <g
                    key={zone.id}
                    className={[
                      "cursor-pointer transition",
                      isSelected && !zone.needsGeometryReview
                        ? "fill-primary/25 stroke-primary"
                        : isSelected && zone.needsGeometryReview
                          ? "fill-amber-400/25 stroke-amber-600"
                          : zone.needsGeometryReview
                            ? "fill-amber-400/15 stroke-amber-500 hover:fill-amber-400/25"
                            : "fill-emerald-400/15 stroke-emerald-500 hover:fill-emerald-400/25",
                    ].join(" ")}
                    role="button"
                    tabIndex={0}
                    aria-label={zoneLabel}
                    onClick={() => selectZone(zone.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectZone(zone.id);
                      }
                    }}
                  >
                    <title>
                      {zoneLabel}
                      {zone.needsGeometryReview ? " - 외곽선 확인 필요" : ""}
                    </title>
                    {zone.polygon ? (
                      <polygon
                        points={getPolygonPointsAttribute(zone.polygon)}
                        strokeWidth={isSelected ? 0.9 : 0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : (
                      <rect
                        x={zone.bbox.x * 100}
                        y={zone.bbox.y * 100}
                        width={zone.bbox.width * 100}
                        height={zone.bbox.height * 100}
                        strokeWidth={isSelected ? 0.9 : 0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            {zones.map((zone) => {
              const isSelected = selectedZone.id === zone.id;

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(zone.id)}
                  className={[
                    "absolute z-10 max-w-40 rounded-md border bg-background/95 px-2 py-1 text-left text-[11px] font-medium shadow-sm outline-none transition",
                    isSelected && !zone.needsGeometryReview
                      ? "border-primary text-primary ring-2 ring-primary/40"
                      : isSelected
                        ? "border-amber-600 text-amber-700 ring-2 ring-amber-400/40"
                        : zone.needsGeometryReview
                          ? "border-amber-400 text-amber-700 hover:border-amber-600"
                          : "hover:border-primary/60",
                  ].join(" ")}
                  style={{
                    left: `${zone.labelPoint.x * 100}%`,
                    top: `${zone.labelPoint.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="inline-flex max-w-full items-center gap-1">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" />
                    <span className="truncate">
                      {zone.name} · {zone.grade}
                    </span>
                  </span>
                  {zone.needsGeometryReview ? (
                    <span className="block truncate text-amber-700">
                      확인 필요
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => {
            const isSelected = selectedZone.id === zone.id;

            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => selectZone(zone.id)}
                className={[
                  "flex min-h-16 flex-col justify-center rounded-md border bg-background px-3 py-2 text-left transition",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "bg-background hover:border-primary/60",
                ].join(" ")}
              >
                <span className="font-medium">
                  {zone.name} · {zone.grade}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {formatPrice(zone.price)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">선택 구역</p>
          <h2 className="mt-1 text-xl font-black">
            {selectedZone.name} · {selectedZone.grade}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatPrice(selectedZone.price)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">리뷰</p>
              <p className="mt-1 font-semibold">{summary.count}개</p>
            </div>
            <div className="rounded-md border bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">만족도</p>
              <p className="mt-1 font-semibold">
                {formatAverageScore(summary.averageSatisfactionScore)}
              </p>
            </div>
            <div className="rounded-md border bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">시야</p>
              <p className="mt-1 font-semibold">
                {formatAverageScore(summary.averageViewScore)}
              </p>
            </div>
            <div className="rounded-md border bg-secondary px-3 py-2">
              <p className="text-xs text-muted-foreground">음향</p>
              <p className="mt-1 font-semibold">
                {formatAverageScore(summary.averageSoundScore)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {isEditing ? "리뷰 수정" : "리뷰 작성"}
            </h2>
            {isEditing ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" aria-hidden="true" />
                취소
              </Button>
            ) : null}
          </div>

          {currentUserId ? (
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              {SCORE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-medium">{field.label}</label>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={[
                          "flex h-9 w-9 items-center justify-center rounded-md border text-sm transition",
                          scores[field.key] === score
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background hover:border-primary/60",
                        ].join(" ")}
                        onClick={() => updateScore(field.key, score)}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="text-sm font-medium" htmlFor="review-content">
                  후기
                </label>
                <textarea
                  id="review-content"
                  className="mt-2 min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="이 구역의 시야, 음향, 무대와의 거리감을 적어주세요."
                  maxLength={1000}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {content.trim().length}/1000
                </p>
              </div>

              {!isEditing ? (
                <div>
                  <label className="text-sm font-medium" htmlFor="review-image">
                    시야 사진
                  </label>
                  <input
                    id="review-image"
                    className="mt-2 block w-full text-sm"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleImageChange}
                  />
                  {imagePreviewUrl ? (
                    <div className="mt-3 overflow-hidden rounded-md border bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreviewUrl}
                        alt="리뷰 이미지 미리보기"
                        className="max-h-48 w-full object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md border bg-secondary px-3 py-2 text-xs text-muted-foreground">
                  MVP에서는 리뷰 수정 시 사진은 유지하고 점수와 내용만 수정합니다.
                </p>
              )}

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : isEditing ? (
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                )}
                {isEditing ? "수정 저장" : "리뷰 작성"}
              </Button>
            </form>
          ) : (
            <div className="mt-4 rounded-md border bg-secondary px-3 py-3 text-sm text-muted-foreground">
              <p>리뷰를 작성하려면 로그인이 필요합니다.</p>
              <Button asChild className="mt-3" size="sm">
                <Link href={`/login?redirect=/concerts/${concert.id}/reviews`}>
                  로그인
                </Link>
              </Button>
            </div>
          )}
        </section>

        {message ? (
          <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </aside>

      <section className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">구역 리뷰</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedZone.name} 구역에 연결된 리뷰입니다.
            </p>
          </div>
          {isLoadingReviews ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              불러오는 중
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {reviews.length > 0 ? (
            reviews.map((review) => {
              const canMutate = currentUserId === review.user.id;
              const isDeleting = deletingReviewId === review.id;

              return (
                <article key={review.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{getDisplayName(review.user)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </p>
                    </div>
                    {canMutate ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(review)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          수정
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(review)}
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
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {SCORE_FIELDS.map((field) => (
                      <span
                        key={field.key}
                        className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-1"
                      >
                        <Star className="h-3 w-3" aria-hidden="true" />
                        {field.label} {review[field.key]}/5
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                    {review.content}
                  </p>

                  {review.imageUrl ? (
                    <div className="mt-4 overflow-hidden rounded-md border bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={review.imageUrl}
                        alt="리뷰 시야 사진"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-md border bg-secondary px-4 py-6 text-center text-sm text-muted-foreground">
              아직 이 구역에 작성된 리뷰가 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
