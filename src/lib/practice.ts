import type {
  PracticeDifficulty,
  PracticeStep,
  TicketTemplateType,
} from "@/types/practice";

export const ACTIVE_TICKET_TEMPLATE_TYPES = [
  "nol_old",
  "nol_new",
  "yes24",
  "melon",
] as const satisfies readonly TicketTemplateType[];

export const PRACTICE_DIFFICULTIES = [
  "easy",
  "normal",
  "hard",
] as const satisfies readonly PracticeDifficulty[];

export const PRACTICE_TEMPLATE_LABELS: Record<TicketTemplateType, string> = {
  nol_old: "NOL 티켓(구버전)",
  nol_new: "NOL 티켓(신버전)",
  nol: "NOL 티켓",
  yes24: "YES24 티켓",
  melon: "멜론 티켓",
  ticketlink: "ticketlink",
  interpark: "인터파크 티켓",
  basic: "기본 연습",
};

export const PRACTICE_DIFFICULTY_LABELS: Record<PracticeDifficulty, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

export const PRACTICE_TEMPLATE_STEPS: Record<
  TicketTemplateType,
  PracticeStep[]
> = {
  nol_old: ["DATE_SELECT", "WAITING_QUEUE", "CAPTCHA", "SEAT_SELECT", "RESULT"],
  nol_new: ["DATE_SELECT", "WAITING_QUEUE", "CAPTCHA", "SEAT_SELECT", "RESULT"],
  nol: ["WAITING_QUEUE", "CAPTCHA", "DATE_SELECT", "SEAT_SELECT", "RESULT"],
  yes24: ["DATE_SELECT", "WAITING_QUEUE", "CAPTCHA", "SEAT_SELECT", "RESULT"],
  melon: ["WAITING_QUEUE", "DATE_SELECT", "SEAT_SELECT", "CAPTCHA", "RESULT"],
  ticketlink: [
    "CAPTCHA",
    "WAITING_QUEUE",
    "DATE_SELECT",
    "SEAT_SELECT",
    "RESULT",
  ],
  interpark: [
    "WAITING_QUEUE",
    "DATE_SELECT",
    "CAPTCHA",
    "SEAT_SELECT",
    "RESULT",
  ],
  basic: ["WAITING_QUEUE", "CAPTCHA", "DATE_SELECT", "SEAT_SELECT", "RESULT"],
};

export const PRACTICE_STEP_LABELS: Record<PracticeStep, string> = {
  WAITING_QUEUE: "대기열",
  CAPTCHA: "보안문자",
  DATE_SELECT: "날짜/회차",
  SEAT_SELECT: "좌석 선택",
  RESULT: "결과",
};
