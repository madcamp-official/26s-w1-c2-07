"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, ImageUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReviewWriteFormProps = {
  concertId: string;
};

type ScoreKey =
  | "viewScore"
  | "soundScore"
  | "distanceScore"
  | "satisfactionScore";

type ScoreState = Record<ScoreKey, number>;

type ImagePreview = {
  file: File;
  url: string;
};

type MutationResponse = {
  error?: {
    message?: string;
  };
};

const FLOOR_OPTIONS = [
  {
    value: "floor",
    label: "Floor층",
  },
  ...Array.from({ length: 10 }, (_, index) => {
    const floor = String(index + 1);

    return {
      value: floor,
      label: `${floor}층`,
    };
  }),
];

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

const REVIEW_IMAGE_MAX_FILE_COUNT = 5;
const REVIEW_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;
const REVIEW_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg"];
const SEAT_CODE_PATTERN = /^[A-Za-z0-9]+$/;

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }

  return `${Math.round(bytes / 1024)}KB`;
}

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
          : "리뷰 저장 중 서버 오류가 발생했습니다.",
      },
    } satisfies MutationResponse;
  }
}

function getSectionPrefix(floor: string) {
  return floor === "floor" ? "f" : floor;
}

function sanitizeSeatCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function ReviewWriteForm({ concertId }: ReviewWriteFormProps) {
  const router = useRouter();
  const [seatFloor, setSeatFloor] = useState("floor");
  const [seatSection, setSeatSection] = useState("");
  const [seatRow, setSeatRow] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [scores, setScores] = useState<ScoreState>(DEFAULT_SCORES);
  const [content, setContent] = useState("");
  const [imagePreviews, setImagePreviews] = useState<ImagePreview[]>([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviewUrlsRef = useRef<string[]>([]);
  const sectionPrefix = getSectionPrefix(seatFloor);

  function clearImagePreviews() {
    for (const previewUrl of imagePreviewUrlsRef.current) {
      URL.revokeObjectURL(previewUrl);
    }

    imagePreviewUrlsRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearImagePreviews();
    };
  }, []);

  function resetImageFiles() {
    clearImagePreviews();
    setImagePreviews([]);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function updateScore(key: ScoreKey, value: number) {
    setScores((currentScores) => ({
      ...currentScores,
      [key]: value,
    }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setMessage("");

    if (nextFiles.length === 0) {
      resetImageFiles();
      return;
    }

    if (nextFiles.length > REVIEW_IMAGE_MAX_FILE_COUNT) {
      resetImageFiles();
      setMessage(
        `사진은 최대 ${REVIEW_IMAGE_MAX_FILE_COUNT}장까지 첨부할 수 있습니다.`,
      );
      return;
    }

    const invalidTypeFile = nextFiles.find(
      (file) => !REVIEW_IMAGE_ALLOWED_TYPES.includes(file.type),
    );

    if (invalidTypeFile) {
      resetImageFiles();
      setMessage("PNG, JPG, JPEG 이미지만 업로드할 수 있습니다.");
      return;
    }

    const oversizedFile = nextFiles.find(
      (file) => file.size > REVIEW_IMAGE_MAX_FILE_SIZE,
    );

    if (oversizedFile) {
      resetImageFiles();
      setMessage(
        `사진은 장당 ${formatFileSize(REVIEW_IMAGE_MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`,
      );
      return;
    }

    clearImagePreviews();

    const nextPreviews = nextFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    imagePreviewUrlsRef.current = nextPreviews.map((preview) => preview.url);
    setImagePreviews(nextPreviews);
  }

  function removeImage(index: number) {
    setImagePreviews((currentPreviews) => {
      const targetPreview = currentPreviews[index];

      if (targetPreview) {
        URL.revokeObjectURL(targetPreview.url);
      }

      const nextPreviews = currentPreviews.filter(
        (_preview, previewIndex) => previewIndex !== index,
      );

      imagePreviewUrlsRef.current = nextPreviews.map((preview) => preview.url);

      if (nextPreviews.length === 0 && imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      return nextPreviews;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedSection = seatSection.trim().toUpperCase();
    const trimmedRow = seatRow.trim().toUpperCase();
    const trimmedNumber = seatNumber.trim().toUpperCase();
    const trimmedContent = content.trim();

    if (trimmedSection.length !== 3) {
      setMessage("구역 이름은 3글자로 입력해주세요.");
      return;
    }

    if (
      !SEAT_CODE_PATTERN.test(trimmedSection) ||
      !SEAT_CODE_PATTERN.test(trimmedRow) ||
      !SEAT_CODE_PATTERN.test(trimmedNumber)
    ) {
      setMessage("구역, 행, 열은 영어와 숫자만 입력해주세요.");
      return;
    }

    if (!trimmedSection.toLowerCase().startsWith(sectionPrefix)) {
      setMessage(
        seatFloor === "floor"
          ? "Floor층 구역은 F로 시작해야 합니다."
          : `${seatFloor}층 구역은 ${seatFloor}로 시작해야 합니다.`,
      );
      return;
    }

    if (!trimmedRow || !trimmedNumber) {
      setMessage("행과 열을 모두 입력해주세요.");
      return;
    }

    if (trimmedContent.length < 10) {
      setMessage("리뷰 내용은 10자 이상 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append("seatFloor", seatFloor);
      formData.append("seatSection", trimmedSection);
      formData.append("seatRow", trimmedRow);
      formData.append("seatNumber", trimmedNumber);

      for (const field of SCORE_FIELDS) {
        formData.append(field.key, String(scores[field.key]));
      }

      formData.append("content", trimmedContent);

      for (const preview of imagePreviews) {
        formData.append("images", preview.file);
      }

      const response = await fetch(`/api/concerts/${concertId}/reviews`, {
        method: "POST",
        body: formData,
      });
      const payload = await readMutationResponse(response);

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "리뷰 저장에 실패했습니다.");
      }

      router.push(`/reviews?concertId=${encodeURIComponent(concertId)}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "리뷰 저장에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            층
            <select
              value={seatFloor}
              onChange={(event) => setSeatFloor(event.target.value)}
              className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              {FLOOR_OPTIONS.map((floor) => (
                <option key={floor.value} value={floor.value}>
                  {floor.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            구역
            <input
              value={seatSection}
              maxLength={3}
              onChange={(event) =>
                setSeatSection(sanitizeSeatCode(event.target.value).slice(0, 3))
              }
              className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={`${sectionPrefix.toUpperCase()}로 시작하는 3글자 구역`}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            행
            <input
              value={seatRow}
              maxLength={20}
              onChange={(event) =>
                setSeatRow(sanitizeSeatCode(event.target.value))
              }
              className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="예: A, 3"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold">
            열
            <input
              value={seatNumber}
              maxLength={20}
              onChange={(event) =>
                setSeatNumber(sanitizeSeatCode(event.target.value))
              }
              className="h-11 rounded-md border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="예: 12"
            />
          </label>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {SCORE_FIELDS.map((field) => (
              <div key={field.key}>
                <p className="text-sm font-semibold">{field.label}</p>
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
          </div>

          <label className="grid gap-2 text-sm font-semibold">
            리뷰 내용
            <textarea
              className="min-h-44 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={1000}
              placeholder="이 좌석의 시야, 음향, 무대와의 거리감을 적어주세요."
            />
            <span className="text-xs font-normal text-muted-foreground">
              {content.trim().length}/1000
            </span>
          </label>
        </div>
      </div>

      <aside className="space-y-4">
        <label className="block text-sm font-black">
          사진 첨부
          <span className="mt-3 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-primary/50 bg-primary/5 px-5 py-6 text-center transition hover:bg-primary/10">
            <ImageUp className="h-8 w-8 text-primary" aria-hidden="true" />
            <span className="mt-3 block font-semibold text-foreground">
              사진을 선택하거나 업로드하세요.
            </span>
            <span className="mt-2 block text-sm font-normal leading-6 text-muted-foreground">
              최대 {REVIEW_IMAGE_MAX_FILE_COUNT}장 · 장당{" "}
              {formatFileSize(REVIEW_IMAGE_MAX_FILE_SIZE)}
            </span>
            <input
              ref={imageInputRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={handleImageChange}
            />
            <span className="mt-4 rounded-md border border-primary/35 bg-background px-4 py-2 text-sm font-bold text-primary">
              파일 선택
            </span>
          </span>
        </label>

        {imagePreviews.length > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black">미리보기</p>
              <button
                type="button"
                className="text-xs font-bold text-muted-foreground transition hover:text-foreground"
                onClick={resetImageFiles}
              >
                모두 지우기
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imagePreviews.map((preview, index) => (
                <div
                  key={preview.url}
                  className="overflow-hidden rounded-md border bg-secondary"
                >
                  <div className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={`리뷰 사진 미리보기 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background/90 text-foreground shadow-sm transition hover:bg-background"
                      aria-label="사진 삭제"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                    <div className="border-t bg-card px-2 py-1.5 text-[11px] text-muted-foreground">
                    <p className="truncate">{preview.file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-12 w-full">
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
          )}
          등록하기
        </Button>

        {message ? (
          <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </aside>
    </form>
  );
}
