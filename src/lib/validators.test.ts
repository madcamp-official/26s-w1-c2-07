import { describe, expect, it } from "vitest";

import {
  practiceSessionCompleteSchema,
  practiceSessionCreateSchema,
  reviewCreateSchema,
  seatZoneUpdateSchema,
} from "@/lib/validators";

describe("validators", () => {
  it("validates review creation payloads", () => {
    expect(
      reviewCreateSchema.safeParse({
        viewScore: 5,
        soundScore: 4,
        distanceScore: 3,
        satisfactionScore: 5,
        content: "시야와 음향이 모두 만족스러웠습니다.",
      }).success,
    ).toBe(true);
    expect(
      reviewCreateSchema.safeParse({
        viewScore: 0,
        soundScore: 4,
        distanceScore: 3,
        satisfactionScore: 5,
        content: "짧음",
      }).success,
    ).toBe(false);
  });

  it("validates editable seat zone fields and polygons", () => {
    expect(
      seatZoneUpdateSchema.safeParse({
        name: "A구역",
        grade: "VIP",
        price: 165000,
        polygon: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.2 },
          { x: 0.4, y: 0.6 },
        ],
      }).success,
    ).toBe(true);
    expect(
      seatZoneUpdateSchema.safeParse({
        name: "A구역",
        grade: "VIP",
        polygon: [
          { x: 0.1, y: 0.2 },
          { x: 1.2, y: 0.2 },
          { x: 0.4, y: 0.6 },
        ],
      }).success,
    ).toBe(false);
  });

  it("validates practice session start payloads", () => {
    expect(
      practiceSessionCreateSchema.safeParse({
        concertId: "550e8400-e29b-41d4-a716-446655440000",
        templateType: "nol_old",
        difficulty: "hard",
      }).success,
    ).toBe(true);
    expect(
      practiceSessionCreateSchema.safeParse({
        concertId: "550e8400-e29b-41d4-a716-446655440000",
        templateType: "unknown",
      }).success,
    ).toBe(false);
  });

  it("requires selected schedule, zone, and seat for successful practice completion", () => {
    expect(
      practiceSessionCompleteSchema.safeParse({
        status: "failed",
        elapsedMs: 1200,
        failReason: "선택 가능한 좌석이 모두 사라졌습니다.",
      }).success,
    ).toBe(true);
    expect(
      practiceSessionCompleteSchema.safeParse({
        status: "success",
        elapsedMs: 1200,
      }).success,
    ).toBe(false);
    expect(
      practiceSessionCompleteSchema.safeParse({
        status: "success",
        scheduleId: "550e8400-e29b-41d4-a716-446655440001",
        selectedZoneId: "550e8400-e29b-41d4-a716-446655440002",
        selectedSeatId: "550e8400-e29b-41d4-a716-446655440003",
        elapsedMs: 1200,
      }).success,
    ).toBe(true);
  });
});
