import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIRTUAL_SEAT_ROWS,
  DEFAULT_VIRTUAL_SEATS_PER_ROW,
  generateVirtualSeats,
  MAX_VIRTUAL_SEAT_TOTAL,
  normalizeVirtualSeatBbox,
  normalizeVirtualSeatPolygon,
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
    expect(
      normalizeVirtualSeatBbox({ x: 0.8, y: 0, width: 0.3, height: 1 }),
    ).toBeNull();
    expect(
      normalizeVirtualSeatBbox({ x: 0, y: 0, width: 0, height: 1 }),
    ).toBeNull();
  });

  it("normalizes valid polygon values and rejects invalid values", () => {
    expect(
      normalizeVirtualSeatPolygon([
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.2 },
        { x: 0.4, y: 0.6 },
      ]),
    ).toEqual([
      { x: 0.1, y: 0.2 },
      { x: 0.5, y: 0.2 },
      { x: 0.4, y: 0.6 },
    ]);
    expect(
      normalizeVirtualSeatPolygon([
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.2 },
      ]),
    ).toBeNull();
    expect(
      normalizeVirtualSeatPolygon([
        { x: 0.1, y: 0.2 },
        { x: 1.2, y: 0.2 },
        { x: 0.4, y: 0.6 },
      ]),
    ).toBeNull();
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
    expect(result.config.seatsPerRow).toBe(9);
    expect(result.seats).toHaveLength(108);
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

  it("adjusts grid shape to match wide and tall zones", () => {
    const wideResult = generateVirtualSeats({
      zoneId: "zone-wide",
      bbox: {
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.1,
      },
    });
    const tallResult = generateVirtualSeats({
      zoneId: "zone-tall",
      bbox: {
        x: 0.1,
        y: 0.2,
        width: 0.1,
        height: 0.5,
      },
    });

    expect(wideResult.config.seatsPerRow).toBeGreaterThan(
      wideResult.config.rows,
    );
    expect(tallResult.config.rows).toBeGreaterThan(
      tallResult.config.seatsPerRow,
    );
  });

  it("generates polygon-based seat positions inside the selected shape", () => {
    const polygon = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.4, y: 0.4 },
      { x: 0.2, y: 0.4 },
    ];
    const result = generateVirtualSeats({
      zoneId: "zone-1",
      polygon,
    });

    expect(result.config.source).toBe("polygon");
    expect(result.seats.length).toBeGreaterThanOrEqual(18);
    expect(
      result.seats.every(
        (seat) =>
          typeof seat.x === "number" &&
          typeof seat.y === "number" &&
          seat.x >= 0.1 &&
          seat.x <= 0.5 &&
          seat.y >= 0.1 &&
          seat.y <= 0.4,
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

  it("generates the exact target seat count without applying the automatic cap", () => {
    const bbox = {
      x: 0.1,
      y: 0.2,
      width: 0.5,
      height: 0.2,
    };
    const result = generateVirtualSeats({
      zoneId: "zone-1",
      bbox,
      targetSeatCount: MAX_VIRTUAL_SEAT_TOTAL + 37,
    });

    expect(result.config.totalSeats).toBe(MAX_VIRTUAL_SEAT_TOTAL + 37);
    expect(result.seats).toHaveLength(MAX_VIRTUAL_SEAT_TOTAL + 37);
    expect(
      result.config.rows * result.config.seatsPerRow,
    ).toBeGreaterThanOrEqual(result.config.totalSeats);
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
});
