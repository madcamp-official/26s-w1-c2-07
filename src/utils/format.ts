export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateRange(startDate: Date, endDate: Date) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return start === end ? start : `${start} - ${end}`;
}

export function formatPriceRange(priceMin: number, priceMax: number) {
  const formatter = new Intl.NumberFormat("ko-KR");

  if (priceMin === priceMax) {
    return `${formatter.format(priceMin)}원`;
  }

  return `${formatter.format(priceMin)}원 - ${formatter.format(priceMax)}원`;
}

