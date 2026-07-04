import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIRTUAL_SEAT_ROWS,
  DEFAULT_VIRTUAL_SEATS_PER_ROW,
  generateVirtualSeats,
  MAX_VIRTUAL_SEAT_TOTAL,
  normalizeVirtualSeatBbox,
} from "@/utils/virtualSeatGenerator";

describe("virtualSeatGenerator", () => {
  it("normalizes valid bbox values and rejects invalid values", () => {
    expect(
      normalizeVirtualSeatBbox({
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
      }),
    ).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });
    expect(normalizeVirtualSeatBbox({ x: 0.8, y: 0, width: 0.3, height: 1 }))
      .toBeNull();
    expect(normalizeVirtualSeatBbox({ x: 0, y: 0, width: 0, height: 1 }))
      .toBeNull();
  });

  it("generates default virtual seats when bbox is not provided", () => {
    const result = generateVirtualSeats({
      zoneId: "zone-1",
    });

    expect(result.config).toEqual({
      rows: DEFAULT_VIRTUAL_SEAT_ROWS,
      seatsPerRow: DEFAULT_VIRTUAL_SEATS_PER_ROW,
      totalSeats: DEFAULT_VIRTUAL_SEAT_ROWS * DEFAULT_VIRTUAL_SEATS_PER_ROW,
      source: "default",
    });
    expect(result.seats[0]).toEqual({
      zoneId: "zone-1",
      rowLabel: "1열",
      seatNumber: 1,
      status: "available",
      x: undefined,
      y: undefined,
    });
  });

  it("generates bbox-based grid size and normalized seat positions", () => {
    const bbox = {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    };
    const result = generateVirtualSeats({
      zoneId: "zone-1",
      bbox,
    });

    expect(result.config.source).toBe("bbox");
    expect(result.config.rows).toBe(12);
    expect(result.config.seatsPerRow).toBe(12);
    expect(result.seats).toHaveLength(144);
    expect(
      result.seats.every(
        (seat) =>
          typeof seat.x === "number" &&
          typeof seat.y === "number" &&
          seat.x > bbox.x &&
          seat.x < bbox.x + bbox.width &&
          seat.y > bbox.y &&
          seat.y < bbox.y + bbox.height,
      ),
    ).toBe(true);
  });

  it("honors explicit grid sizes while enforcing min and max totals", () => {
    const explicit = generateVirtualSeats({
      zoneId: "zone-1",
      rows: 4,
      seatsPerRow: 5,
    });

    expect(explicit.config.rows).toBe(4);
    expect(explicit.config.seatsPerRow).toBe(5);
    expect(explicit.config.totalSeats).toBe(20);

    const capped = generateVirtualSeats({
      zoneId: "zone-1",
      rows: 20,
      seatsPerRow: 30,
    });

    expect(capped.config.totalSeats).toBe(MAX_VIRTUAL_SEAT_TOTAL);
    expect(capped.config.seatsPerRow).toBe(10);
  });
});
