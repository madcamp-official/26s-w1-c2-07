import { describe, expect, it } from "vitest";

import {
  allocateSeatCountsByArea,
  getSeatZonePracticeReadiness,
  MAX_TOTAL_SEAT_COUNT,
} from "@/lib/virtual-seats";

describe("virtual-seats", () => {
  const bbox = {
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
  };

  it("marks zones with geometry and normalized seat coordinates as ready", () => {
    const readiness = getSeatZonePracticeReadiness({
      id: "zone-1",
      bbox,
      polygon: [],
      virtualSeatConfig: {
        coordinateScope: "seat-map",
      },
      virtualSeats: [
        {
          x: 0.2,
          y: 0.3,
        },
      ],
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.needsRepair).toBe(false);
  });

  it("repairs zones with geometry but no seats", () => {
    const readiness = getSeatZonePracticeReadiness({
      id: "zone-1",
      bbox,
      polygon: [],
      virtualSeats: [],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.needsRepair).toBe(true);
  });

  it("repairs zones with missing or out-of-range coordinates", () => {
    const missingCoordinate = getSeatZonePracticeReadiness({
      id: "zone-1",
      bbox,
      polygon: [],
      virtualSeats: [
        {
          x: null,
          y: 0.3,
        },
      ],
    });
    const outOfRangeCoordinate = getSeatZonePracticeReadiness({
      id: "zone-1",
      bbox,
      polygon: [],
      virtualSeats: [
        {
          x: 1.2,
          y: 0.3,
        },
      ],
    });

    expect(missingCoordinate.needsRepair).toBe(true);
    expect(outOfRangeCoordinate.needsRepair).toBe(true);
  });

  it("does not treat zones without usable geometry as ready", () => {
    const readiness = getSeatZonePracticeReadiness({
      id: "zone-1",
      bbox: null,
      polygon: [],
      virtualSeats: [
        {
          x: 0.2,
          y: 0.3,
        },
      ],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.needsRepair).toBe(false);
  });

  it("allocates total seats by area while preserving the exact total", () => {
    const allocations = allocateSeatCountsByArea(
      [
        {
          id: "small",
          bbox: {
            x: 0,
            y: 0,
            width: 0.1,
            height: 0.1,
          },
          polygon: [],
        },
        {
          id: "large",
          bbox: {
            x: 0.2,
            y: 0,
            width: 0.3,
            height: 0.3,
          },
          polygon: [],
        },
      ],
      100,
    );

    expect(allocations).toHaveLength(2);
    expect(
      allocations.reduce(
        (sum, allocation) => sum + allocation.allocatedSeatCount,
        0,
      ),
    ).toBe(100);
    expect(allocations[1].allocatedSeatCount).toBeGreaterThan(
      allocations[0].allocatedSeatCount,
    );
  });

  it("keeps at least one seat per zone", () => {
    const allocations = allocateSeatCountsByArea(
      [
        {
          id: "a",
          bbox: null,
          polygon: [],
        },
        {
          id: "b",
          bbox: null,
          polygon: [],
        },
        {
          id: "c",
          bbox: null,
          polygon: [],
        },
      ],
      3,
    );

    expect(
      allocations.map((allocation) => allocation.allocatedSeatCount),
    ).toEqual([1, 1, 1]);
  });

  it("rejects totals below zone count and above the configured maximum", () => {
    const zones = [
      {
        id: "a",
        bbox: null,
        polygon: [],
      },
      {
        id: "b",
        bbox: null,
        polygon: [],
      },
    ];

    expect(() => allocateSeatCountsByArea(zones, 1)).toThrow(
      "좌석 구역 수보다 작을 수 없습니다.",
    );
    expect(() =>
      allocateSeatCountsByArea(zones, MAX_TOTAL_SEAT_COUNT + 1),
    ).toThrow("넘을 수 없습니다.");
  });
});
