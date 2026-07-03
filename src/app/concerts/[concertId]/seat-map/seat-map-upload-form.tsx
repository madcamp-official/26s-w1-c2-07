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

export function SeatMapUploadForm({ concertId }: SeatMapUploadFormProps) {
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

      router.push(`/concerts/${concertId}`);
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
      <label className="block space-y-2 text-sm font-medium">
        좌석 배치도 이미지
        <input
          ref={inputRef}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
        />
      </label>

      <p className="text-sm leading-6 text-muted-foreground">
        PNG, JPG, JPEG 형식의 {formatFileSize(SEAT_MAP_MAX_FILE_SIZE)} 이하
        이미지를 업로드할 수 있습니다.
      </p>

      {previewUrl ? (
        <div className="overflow-hidden rounded-md border bg-secondary">
          <div
            className="min-h-80 bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${previewUrl})`,
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-card px-4 py-3 text-sm text-muted-foreground">
            <span>{file?.name}</span>
            {imageSize ? (
              <span>
                {imageSize.width} x {imageSize.height}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-80 items-center justify-center rounded-md border bg-secondary text-sm text-muted-foreground">
          <div className="text-center">
            <ImageUp className="mx-auto h-8 w-8" aria-hidden="true" />
            <p className="mt-3">업로드 전 이미지 미리보기가 표시됩니다.</p>
          </div>
        </div>
      )}

      {message ? (
        <p className="rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={!file || isPending} className="w-full">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        좌석 배치도 업로드
      </Button>
    </form>
  );
}

