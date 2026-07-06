"use client";

import { useEffect, useState } from "react";
import { ImageIcon, X } from "lucide-react";

type ReviewImageGalleryProps = {
  imageUrls: string[];
};

export function ReviewImageGallery({ imageUrls }: ReviewImageGalleryProps) {
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const primaryImageUrl = imageUrls[0] ?? null;
  const thumbnailImageUrls = imageUrls.slice(1);

  useEffect(() => {
    if (!activeImageUrl) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveImageUrl(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeImageUrl]);

  if (!primaryImageUrl) {
    return (
      <div className="mt-3 flex min-h-52 items-center justify-center rounded-md border bg-secondary text-sm text-muted-foreground">
        <div className="text-center">
          <ImageIcon className="mx-auto h-8 w-8" aria-hidden="true" />
          <p className="mt-2">첨부된 사진이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mt-3 block w-full overflow-hidden rounded-md border bg-secondary transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setActiveImageUrl(primaryImageUrl)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primaryImageUrl}
          alt="리뷰 대표 사진"
          className="max-h-80 w-full object-contain"
        />
      </button>

      {thumbnailImageUrls.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {thumbnailImageUrls.map((imageUrl, imageIndex) => (
            <button
              key={imageUrl}
              type="button"
              className="overflow-hidden rounded-md border bg-secondary transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setActiveImageUrl(imageUrl)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`리뷰 첨부 사진 ${imageIndex + 2}`}
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {activeImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="리뷰 사진 크게 보기"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="사진 창 닫기"
            onClick={() => setActiveImageUrl(null)}
          />
          <div className="relative z-10 flex max-h-full max-w-6xl items-center justify-center">
            <button
              type="button"
              className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-md border bg-background/95 text-foreground shadow-sm transition hover:bg-background"
              aria-label="사진 창 닫기"
              onClick={() => setActiveImageUrl(null)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImageUrl}
              alt="확대된 리뷰 사진"
              className="max-h-[88vh] max-w-full rounded-md object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
