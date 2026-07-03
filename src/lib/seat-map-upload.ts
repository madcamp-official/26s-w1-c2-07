export const SEAT_MAP_BUCKET = "seat-maps";
export const SEAT_MAP_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const SEAT_MAP_ALLOWED_TYPES = ["image/png", "image/jpeg"];

export function isAllowedSeatMapMimeType(type: string) {
  return SEAT_MAP_ALLOWED_TYPES.includes(type);
}

export function formatFileSize(bytes: number) {
  const megabytes = bytes / 1024 / 1024;

  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)}MB`;
}

export function getSafeStorageFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || "seat-map";
}

