"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  isAllowedSeatMapMimeType,
  SEAT_MAP_MAX_FILE_SIZE,
} from "@/lib/seat-map-upload";

type SeatMapUploadFormProps = {
  concertId: string;
  redirectHref?: string;
};

type ImageSize = {
  width: number;
  height: number;
};

type UploadResponse = {
  data?: {
    seatMap?: {
      id: string;
    };
  };
  error?: {
    message?: string;
  };
};

export function SeatMapUploadForm({
  concertId,
  redirectHref,
}: SeatMapUploadFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  function clearPreviewUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearPreviewUrl();
    };
  }, []);

  function resetFileInput() {
    setFile(null);
    setPreviewUrl(null);
    setImageSize(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    clearPreviewUrl();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setMessage("");

    if (!selectedFile) {
      resetFileInput();
      return;
    }

    if (!isAllowedSeatMapMimeType(selectedFile.type)) {
      resetFileInput();
      setMessage("PNG, JPG, JPEG 이미지만 업로드할 수 있습니다.");
      return;
    }

    if (selectedFile.size > SEAT_MAP_MAX_FILE_SIZE) {
      resetFileInput();
      setMessage(
        `좌석 배치도 이미지는 ${formatFileSize(SEAT_MAP_MAX_FILE_SIZE)} 이하만 업로드할 수 있습니다.`,
      );
      return;
    }

    clearPreviewUrl();

    const objectUrl = URL.createObjectURL(selectedFile);
    const image = new Image();

    objectUrlRef.current = objectUrl;
    setFile(selectedFile);
    setPreviewUrl(objectUrl);
    setImageSize(null);

    image.onload = () => {
      setImageSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      setMessage("이미지 정보를 읽을 수 없습니다. 다른 파일을 선택해주세요.");
    };
    image.src = objectUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setMessage("업로드할 좌석 배치도 이미지를 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("concertId", concertId);
    formData.append("file", file);

    if (imageSize) {
      formData.append("imageWidth", String(imageSize.width));
      formData.append("imageHeight", String(imageSize.height));
    }

    setIsPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/seat-maps/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "좌석 배치도 업로드에 실패했습니다.",
        );
      }

      router.push(redirectHref ?? `/concerts/${concertId}/seat-map/analysis`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "좌석 배치도 업로드에 실패했습니다.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <div className="space-y-4">
          <label className="block text-sm font-black">
            배치도 이미지 업로드
            <span className="mt-3 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-primary/50 bg-primary/5 px-6 py-8 text-center transition hover:bg-primary/10">
              <ImageUp className="h-9 w-9 text-primary" aria-hidden="true" />
              <span className="mt-4 block font-semibold text-foreground">
                이미지를 선택하거나 업로드하세요.
              </span>
              <span className="mt-2 block text-sm font-normal leading-6 text-muted-foreground">
                PNG, JPG, JPEG 형식의 {formatFileSize(SEAT_MAP_MAX_FILE_SIZE)}{" "}
                이하 이미지를 업로드할 수 있습니다.
              </span>
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileChange}
              />
              <span className="mt-5 rounded-md border border-primary/35 bg-background px-4 py-2 text-sm font-bold text-primary">
                파일 선택
              </span>
            </span>
          </label>

          <div className="rounded-md border bg-secondary/70 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-bold text-foreground">이미지 업로드 TIP</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>좌석 구역명이 선명하게 보이는 이미지를 업로드해주세요.</li>
              <li>
                공식 사이트의 좌석 배치도 또는 공연장 안내도를 권장합니다.
              </li>
              <li>업로드 후 AI 분석으로 구역 후보를 자동 추출합니다.</li>
            </ul>
          </div>
        </div>

        <div>
          <p className="text-sm font-black">미리보기</p>
          {previewUrl ? (
            <div className="mt-3 overflow-hidden rounded-md border bg-secondary">
              <div
                className="min-h-80 bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${previewUrl})`,
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-card px-4 py-3 text-sm text-muted-foreground">
                <span className="truncate">{file?.name}</span>
                {imageSize ? (
                  <span>
                    {imageSize.width} x {imageSize.height}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-3 flex min-h-80 items-center justify-center rounded-md border bg-secondary text-sm text-muted-foreground">
              <div className="text-center">
                <ImageUp className="mx-auto h-9 w-9" aria-hidden="true" />
                <p className="mt-3">
                  이미지를 업로드하면 미리보기가 표시됩니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {message ? (
        <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
        <p className="rounded-md border bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          이미지를 업로드하면 AI 분석 페이지로 이동해 좌석 구역 인식을
          시작합니다.
        </p>
        <Button type="submit" disabled={!file || isPending} className="h-12">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          AI 분석하기
        </Button>
      </div>
    </form>
  );
}
