import type { VirtualSeat } from "@/types/seat";

type GenerateVirtualSeatsOptions = {
  zoneId: string;
  rows?: number;
  seatsPerRow?: number;
};

export function generateVirtualSeats({
  zoneId,
  rows = 5,
  seatsPerRow = 12,
}: GenerateVirtualSeatsOptions): VirtualSeat[] {
  return Array.from({ length: rows }).flatMap((_, rowIndex) => {
    const rowLabel = `${rowIndex + 1}열`;

    return Array.from({ length: seatsPerRow }).map((__, seatIndex) => ({
      id: `${zoneId}-${rowIndex + 1}-${seatIndex + 1}`,
      zoneId,
      rowLabel,
      seatNumber: seatIndex + 1,
      status: "available",
    }));
  });
}
