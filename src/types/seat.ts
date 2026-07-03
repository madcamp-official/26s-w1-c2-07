export type Point = {
  x: number;
  y: number;
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SeatZoneAnalysis = {
  name: string;
  grade: string;
  bbox?: BoundingBox;
  polygon: Point[];
  confidence?: number;
};

export type VirtualSeat = {
  id: string;
  zoneId: string;
  rowLabel: string;
  seatNumber: number;
  status: "available" | "sold" | "disabled";
  x?: number;
  y?: number;
};
