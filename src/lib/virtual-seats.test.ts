import { describe, expect, it } from "vitest";

import { getSeatZonePracticeReadiness } from "@/lib/virtual-seats";

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
});
