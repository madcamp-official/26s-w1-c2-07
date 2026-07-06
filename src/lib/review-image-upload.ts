import { randomUUID } from "node:crypto";

import { getSafeStorageFileName } from "@/lib/seat-map-upload";

export const REVIEW_IMAGE_BUCKET = "review-images";
export const REVIEW_IMAGE_MAX_FILE_COUNT = 5;
export const REVIEW_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const REVIEW_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg"];

export function isAllowedReviewImageMimeType(type: string) {
  return REVIEW_IMAGE_ALLOWED_TYPES.includes(type);
}

export function getReviewImageStoragePath(input: {
  concertId: string;
  zoneId: string;
  userId: string;
  fileName: string;
}) {
  const safeFileName = getSafeStorageFileName(input.fileName);

  return [
    input.concertId,
    input.zoneId,
    input.userId,
    `${Date.now()}-${randomUUID()}-${safeFileName}`,
  ].join("/");
}

export function getReviewImageStoragePathFromPublicUrl(imageUrl: string) {
  const marker = `/object/public/${REVIEW_IMAGE_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const rawPath = imageUrl.slice(markerIndex + marker.length).split("?")[0];

  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}
