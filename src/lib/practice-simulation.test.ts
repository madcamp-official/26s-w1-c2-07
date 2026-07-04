import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInitialQueueCount,
  getNextQueueCount,
  getSelectableSeatCount,
  QUEUE_POLICY,
  sampleSeatIds,
  SEAT_CLAIM_POLICY,
  shouldClaimSeatSucceed,
} from "@/lib/practice-simulation";

describe("practice-simulation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates queue counts within difficulty policy ranges", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getInitialQueueCount("easy")).toBe(QUEUE_POLICY.easy.min);

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(getInitialQueueCount("hard")).toBeLessThanOrEqual(
      QUEUE_POLICY.hard.max,
    );
    expect(getInitialQueueCount("hard")).toBeGreaterThanOrEqual(
      QUEUE_POLICY.hard.min,
    );
  });

  it("decreases queue count without going below zero", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(
      getNextQueueCount({
        difficulty: "normal",
        currentCount: 20,
      }),
    ).toBe(0);
    expect(
      getNextQueueCount({
        difficulty: "normal",
        currentCount: 100,
      }),
    ).toBe(100 - QUEUE_POLICY.normal.decrementMin);
  });

  it("scales selectable seat count by total seats and difficulty", () => {
    expect(
      getSelectableSeatCount({
        difficulty: "easy",
        totalAvailableSeats: 100,
      }),
    ).toBe(10);
    expect(
      getSelectableSeatCount({
        difficulty: "normal",
        totalAvailableSeats: 100,
      }),
    ).toBe(6);
    expect(
      getSelectableSeatCount({
        difficulty: "hard",
        totalAvailableSeats: 100,
      }),
    ).toBe(3);
    expect(
      getSelectableSeatCount({
        difficulty: "hard",
        totalAvailableSeats: 2,
      }),
    ).toBe(2);
    expect(
      getSelectableSeatCount({
        difficulty: "easy",
        totalAvailableSeats: 0,
      }),
    ).toBe(0);
  });

  it("samples unique seat ids without exceeding requested count", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const sampledSeatIds = sampleSeatIds({
      seatIds: ["a", "b", "c"],
      count: 2,
    });

    expect(sampledSeatIds).toHaveLength(2);
    expect(new Set(sampledSeatIds).size).toBe(2);
    expect(sampledSeatIds.every((seatId) => ["a", "b", "c"].includes(seatId)))
      .toBe(true);
  });

  it("applies seat claim success rates and hard deadline", () => {
    vi.spyOn(Math, "random").mockReturnValue(
      SEAT_CLAIM_POLICY.hard.successRate - 0.01,
    );
    expect(
      shouldClaimSeatSucceed({
        difficulty: "hard",
        selectionElapsedMs: 500,
      }),
    ).toBe(true);

    vi.spyOn(Math, "random").mockReturnValue(
      SEAT_CLAIM_POLICY.hard.successRate + 0.01,
    );
    expect(
      shouldClaimSeatSucceed({
        difficulty: "hard",
        selectionElapsedMs: 500,
      }),
    ).toBe(false);

    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(
      shouldClaimSeatSucceed({
        difficulty: "hard",
        selectionElapsedMs: SEAT_CLAIM_POLICY.hard.selectionDeadlineMs! + 1,
      }),
    ).toBe(false);
  });
});
