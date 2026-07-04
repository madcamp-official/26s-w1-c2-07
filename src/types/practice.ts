export type PracticeStep =
  | "WAITING_QUEUE"
  | "CAPTCHA"
  | "DATE_SELECT"
  | "SEAT_SELECT"
  | "RESULT";

export type TicketTemplateType =
  | "nol"
  | "yes24"
  | "melon"
  | "ticketlink"
  | "interpark"
  | "basic";

export type PracticeDifficulty = "easy" | "normal" | "hard";

export type PracticeResult = {
  success: boolean;
  selectedZoneId?: string;
  selectedSeatId?: string;
  elapsedMs: number;
  failReason?: string;
};
