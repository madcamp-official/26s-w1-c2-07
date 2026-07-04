import { describe, expect, it } from "vitest";

import {
  clampPoint,
  getBboxCenter,
  getPolygonCenter,
  getPolygonPointsAttribute,
  isBboxCornerPolygon,
  normalizePolygon,
  parseBbox,
  parsePolygon,
  polygonFromBbox,
} from "@/lib/seat-zone-geometry";

describe("seat-zone-geometry", () => {
  const bbox = {
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.4,
  };

  it("parses normalized bbox values", () => {
    expect(parseBbox(bbox)).toEqual(bbox);
  });

  it("rejects invalid bbox values", () => {
    expect(parseBbox(null)).toBeNull();
    expect(parseBbox({ ...bbox, width: 0 })).toBeNull();
    expect(parseBbox({ ...bbox, x: -0.1 })).toBeNull();
    expect(parseBbox({ ...bbox, x: 0.8 })).toBeNull();
    expect(parseBbox({ ...bbox, width: Number.NaN })).toBeNull();
  });

  it("parses polygons with at least three normalized points", () => {
    const polygon = [
      { x: 0.1, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 0.6 },
    ];

    expect(parsePolygon(polygon)).toEqual(polygon);
  });

  it("rejects polygons with too few or out-of-range points", () => {
    expect(parsePolygon([{ x: 0.1, y: 0.2 }])).toBeNull();
    expect(
      parsePolygon([
        { x: 0.1, y: 0.2 },
        { x: 0.4, y: 0.2 },
        { x: 1.1, y: 0.6 },
      ]),
    ).toBeNull();
  });

  it("creates bbox corner polygons and detects bbox-copy polygons", () => {
    const polygon = polygonFromBbox(bbox);

    expect(polygon[0]).toEqual({ x: 0.1, y: 0.2 });
    expect(polygon[1]).toEqual({ x: 0.4, y: 0.2 });
    expect(polygon[2].x).toBeCloseTo(0.4);
    expect(polygon[2].y).toBeCloseTo(0.6);
    expect(polygon[3].x).toBeCloseTo(0.1);
    expect(polygon[3].y).toBeCloseTo(0.6);
    expect(isBboxCornerPolygon(polygon, bbox)).toBe(true);
    expect(
      isBboxCornerPolygon(
        [
          { x: 0.1, y: 0.2 },
          { x: 0.35, y: 0.25 },
          { x: 0.4, y: 0.6 },
          { x: 0.1, y: 0.6 },
        ],
        bbox,
      ),
    ).toBe(false);
  });

  it("calculates bbox and polygon centers without storing center fields", () => {
    const bboxCenter = getBboxCenter(bbox);
    const polygonCenter = getPolygonCenter([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.5, y: 0.4 },
    ]);

    expect(bboxCenter.x).toBeCloseTo(0.25);
    expect(bboxCenter.y).toBeCloseTo(0.4);
    expect(polygonCenter.x).toBeCloseTo(0.3);
    expect(polygonCenter.y).toBeCloseTo(0.2);
  });

  it("formats SVG polygon points in percentage coordinates", () => {
    expect(
      getPolygonPointsAttribute([
        { x: 0.1, y: 0.2 },
        { x: 0.34567, y: 0.45678 },
      ]),
    ).toBe("10.0000,20.0000 34.5670,45.6780");
  });

  it("clamps polygon points to normalized coordinates", () => {
    expect(clampPoint({ x: -0.2, y: 1.3 })).toEqual({ x: 0, y: 1 });
    expect(normalizePolygon([{ x: 1.2, y: -0.1 }])).toEqual([
      { x: 1, y: 0 },
    ]);
  });
});
