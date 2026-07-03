export type Point = {
  x: number;
  y: number;
};

export type SeatZoneAnalysis = {
  name: string;
  grade: string;
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
