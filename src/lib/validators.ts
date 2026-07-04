import { z } from "zod";

import {
  ACTIVE_TICKET_TEMPLATE_TYPES,
  PRACTICE_DIFFICULTIES,
} from "@/lib/practice";

export const reviewSchema = z.object({
  zoneId: z.string().uuid(),
  viewScore: z.number().int().min(1).max(5),
  soundScore: z.number().int().min(1).max(5),
  distanceScore: z.number().int().min(1).max(5),
  satisfactionScore: z.number().int().min(1).max(5),
  content: z.string().trim().min(10).max(1000),
  imageUrl: z.string().url().optional(),
});

const reviewBaseSchema = z.object({
  viewScore: z.coerce.number().int().min(1).max(5),
  soundScore: z.coerce.number().int().min(1).max(5),
  distanceScore: z.coerce.number().int().min(1).max(5),
  satisfactionScore: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(10).max(1000),
});

export const reviewCreateSchema = reviewBaseSchema;

export const reviewUpdateSchema = reviewBaseSchema;

export const seatZoneSchema = z.object({
  name: z.string().min(1),
  grade: z.string().min(1),
  price: z.number().int().nonnegative().optional(),
  bbox: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
  polygon: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
    }),
  ),
  confidence: z.number().min(0).max(1).optional(),
});

export const seatZoneUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  grade: z
    .string()
    .trim()
    .max(30)
    .transform((value) => value || "미확인"),
  price: z.number().int().nonnegative().nullable().optional(),
});

export const profileUpdateSchema = z.object({
  nickname: z.string().trim().min(1).max(30).optional(),
  profileImageUrl: z.string().url().nullable().optional(),
});

export const seatMapUploadSchema = z.object({
  concertId: z.string().uuid(),
  imageWidth: z.coerce.number().int().positive().max(50000).optional(),
  imageHeight: z.coerce.number().int().positive().max(50000).optional(),
});

export const virtualSeatGenerateSchema = z.object({
  rows: z.number().int().min(1).max(20).optional(),
  seatsPerRow: z.number().int().min(1).max(30).optional(),
  overwrite: z.boolean().optional(),
});

export const practiceSessionCreateSchema = z.object({
  concertId: z.string().uuid(),
  templateType: z.enum(ACTIVE_TICKET_TEMPLATE_TYPES),
  difficulty: z.enum(PRACTICE_DIFFICULTIES).optional(),
  startDelayMs: z.number().int().min(0).max(60 * 1000).optional(),
});

export const practiceSessionCompleteSchema = z
  .object({
    status: z.enum(["success", "failed"]),
    scheduleId: z.string().uuid().optional(),
    selectedZoneId: z.string().uuid().nullable().optional(),
    selectedSeatId: z.string().uuid().nullable().optional(),
    elapsedMs: z.number().int().min(0).max(10 * 60 * 1000),
    failReason: z.string().trim().max(200).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.status !== "success") {
      return;
    }

    if (!value.scheduleId) {
      context.addIssue({
        code: "custom",
        path: ["scheduleId"],
        message: "성공 기록에는 회차 선택이 필요합니다.",
      });
    }

    if (!value.selectedZoneId) {
      context.addIssue({
        code: "custom",
        path: ["selectedZoneId"],
        message: "성공 기록에는 좌석 구역 선택이 필요합니다.",
      });
    }

    if (!value.selectedSeatId) {
      context.addIssue({
        code: "custom",
        path: ["selectedSeatId"],
        message: "성공 기록에는 좌석 선택이 필요합니다.",
      });
    }
  });
