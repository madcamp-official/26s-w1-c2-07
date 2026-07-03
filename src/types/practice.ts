export type PracticeStep =
  | "WAITING_QUEUE"
  | "CAPTCHA"
  | "DATE_SELECT"
  | "SEAT_SELECT"
  | "RESULT";

export type TicketTemplateType = "interpark" | "melon" | "yes24" | "basic";

export type PracticeResult = {
  success: boolean;
  selectedZoneId?: string;
  selectedSeatId?: string;
  elapsedMs: number;
  failReason?: string;
};
