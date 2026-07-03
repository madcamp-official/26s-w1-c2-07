import { z } from "zod";

export const reviewSchema = z.object({
  zoneId: z.string().uuid(),
  viewScore: z.number().int().min(1).max(5),
  soundScore: z.number().int().min(1).max(5),
  distanceScore: z.number().int().min(1).max(5),
  satisfactionScore: z.number().int().min(1).max(5),
  content: z.string().min(10),
  imageUrl: z.string().url().optional(),
});

export const seatZoneSchema = z.object({
  name: z.string().min(1),
  grade: z.string().min(1),
  price: z.number().int().nonnegative().optional(),
  polygon: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
    }),
  ),
  confidence: z.number().min(0).max(1).optional(),
});

export const profileUpdateSchema = z.object({
  nickname: z.string().trim().min(1).max(30).optional(),
  profileImageUrl: z.string().url().nullable().optional(),
});
