"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type SeatStatus = "available" | "sold" | "disabled";

type SeatZoneSummary = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
};

type VirtualSeatItem = {
  id: string;
  rowLabel: string;
  seatNumber: number;
  status: SeatStatus;
  x: number | null;
  y: number | null;
};

type VirtualSeatsResponse = {
  data?: {
    virtualSeats?: VirtualSeatItem[];
  };
  error?: {
    message?: string;
  };
};

type VirtualSeatPanelProps = {
  zone: SeatZoneSummary;
};

function formatPrice(price: number | null) {
  return typeof price === "number"
    ? `${price.toLocaleString("ko-KR")}원`
    : "가격 미입력";
}

function parseOptionalInteger(value: string, label: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      value: undefined,
      error: null,
    };
  }

  const numberValue = Number.parseInt(trimmedValue, 10);

  if (!Number.isInteger(numberValue)) {
    return {
      value: undefined,
      error: `${label}은 정수로 입력해주세요.`,
    };
  }

  return {
    value: numberValue,
    error: null,
  };
}

function getSeatStatusText(status: SeatStatus) {
  if (status === "sold") {
    return "매진";
  }

  if (status === "disabled") {
    return "선택 불가";
  }

  return "선택 가능";
}

export function VirtualSeatPanel({ zone }: VirtualSeatPanelProps) {
  const [virtualSeats, setVirtualSeats] = useState<VirtualSeatItem[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [rows, setRows] = useState("");
  const [seatsPerRow, setSeatsPerRow] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const groupedSeats = useMemo(() => {
    const rowMap = new Map<string, VirtualSeatItem[]>();

    for (const seat of virtualSeats) {
      const rowSeats = rowMap.get(seat.rowLabel) ?? [];
      rowSeats.push(seat);
      rowMap.set(seat.rowLabel, rowSeats);
    }

    return Array.from(rowMap.entries()).map(([rowLabel, seats]) => ({
      rowLabel,
      seats: seats.sort((a, b) => a.seatNumber - b.seatNumber),
    }));
  }, [virtualSeats]);

  const selectedSeat =
    virtualSeats.find((seat) => seat.id === selectedSeatId) ?? null;

  useEffect(() => {
    let ignore = false;
    const zoneId = zone.id;

    async function loadVirtualSeats() {
      setIsLoading(true);
      setSelectedSeatId(null);
      setMessage("");

      try {
        const response = await fetch(
          `/api/seat-zones/${zoneId}/virtual-seats`,
        );
        const payload = (await response.json()) as VirtualSeatsResponse;

        if (!response.ok) {
          throw new Error(
            payload.error?.message ?? "가상 좌석을 불러오지 못했습니다.",
          );
        }

        if (!ignore) {
          setVirtualSeats(payload.data?.virtualSeats ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setVirtualSeats([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "가상 좌석을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadVirtualSeats();

    return () => {
      ignore = true;
    };
  }, [zone.id]);

  async function handleGenerate() {
    if (!zone) {
      setMessage("좌석 구역을 먼저 선택해주세요.");
      return;
    }

    const parsedRows = parseOptionalInteger(rows, "열 수");
    const parsedSeatsPerRow = parseOptionalInteger(seatsPerRow, "열당 좌석 수");

    if (parsedRows.error || parsedSeatsPerRow.error) {
      setMessage(parsedRows.error ?? parsedSeatsPerRow.error ?? "");
      return;
    }

    if (
      parsedRows.value !== undefined &&
      (parsedRows.value < 1 || parsedRows.value > 20)
    ) {
      setMessage("열 수는 1~20 사이로 입력해주세요.");
      return;
    }

    if (
      parsedSeatsPerRow.value !== undefined &&
      (parsedSeatsPerRow.value < 1 || parsedSeatsPerRow.value > 30)
    ) {
      setMessage("열당 좌석 수는 1~30 사이로 입력해주세요.");
      return;
    }

    if (
      parsedRows.value !== undefined &&
      parsedSeatsPerRow.value !== undefined
    ) {
      const totalSeats = parsedRows.value * parsedSeatsPerRow.value;

      if (totalSeats < 18 || totalSeats > 200) {
        setMessage("가상 좌석은 18~200개 사이로 생성할 수 있습니다.");
        return;
      }
    }

    const overwrite = virtualSeats.length > 0;

    if (overwrite) {
      const confirmed = window.confirm(
        "기존 가상 좌석을 삭제하고 다시 생성할까요?",
      );

      if (!confirmed) {
        return;
      }
    }

    setIsGenerating(true);
    setMessage("");

    try {
      const response = await fetch(`/api/seat-zones/${zone.id}/virtual-seats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: parsedRows.value,
          seatsPerRow: parsedSeatsPerRow.value,
          overwrite,
        }),
      });
      const payload = (await response.json()) as VirtualSeatsResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "가상 좌석 생성에 실패했습니다.",
        );
      }

      setVirtualSeats(payload.data?.virtualSeats ?? []);
      setSelectedSeatId(null);
      setMessage("가상 좌석을 생성했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "가상 좌석 생성에 실패했습니다.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-md border bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">가상 좌석</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {zone.name} · {zone.grade} · {formatPrice(zone.price)}
          </p>
        </div>
        <Armchair className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <p className="mt-3 rounded-md border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
        연습용 가상 좌석이며 실제 공연장 좌석 정보와 다를 수 있습니다.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium">
          열 수
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="자동"
            value={rows}
            onChange={(event) =>
              setRows(event.target.value.replace(/[^0-9]/g, ""))
            }
            disabled={isGenerating}
          />
        </label>

        <label className="grid gap-1.5 text-xs font-medium">
          열당 좌석 수
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="자동"
            value={seatsPerRow}
            onChange={(event) =>
              setSeatsPerRow(event.target.value.replace(/[^0-9]/g, ""))
            }
            disabled={isGenerating}
          />
        </label>
      </div>

      <Button
        type="button"
        variant={virtualSeats.length > 0 ? "outline" : "default"}
        className="mt-3 w-full"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : virtualSeats.length > 0 ? (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Armchair className="h-4 w-4" aria-hidden="true" />
        )}
        {virtualSeats.length > 0 ? "가상 좌석 다시 생성" : "가상 좌석 생성"}
      </Button>

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          가상 좌석을 불러오는 중입니다.
        </p>
      ) : null}

      {!isLoading && virtualSeats.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          아직 생성된 가상 좌석이 없습니다.
        </p>
      ) : null}

      {virtualSeats.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>총 {virtualSeats.length}석</span>
            {selectedSeat ? (
              <span>
                선택: {selectedSeat.rowLabel} {selectedSeat.seatNumber}번
              </span>
            ) : null}
          </div>

          <div className="max-h-72 overflow-auto rounded-md border bg-background p-3">
            <div className="grid min-w-max gap-2">
              {groupedSeats.map((row) => (
                <div key={row.rowLabel} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-xs text-muted-foreground">
                    {row.rowLabel}
                  </span>
                  <div className="flex gap-1.5">
                    {row.seats.map((seat) => {
                      const isSelected = selectedSeatId === seat.id;
                      const isAvailable = seat.status === "available";

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          className={[
                            "h-7 w-7 shrink-0 rounded-md border text-[11px] font-medium transition",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "",
                            !isSelected && isAvailable
                              ? "bg-background hover:border-primary"
                              : "",
                            !isAvailable
                              ? "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
                              : "",
                          ].join(" ")}
                          title={`${seat.rowLabel} ${seat.seatNumber}번 · ${getSeatStatusText(seat.status)}`}
                          disabled={!isAvailable}
                          onClick={() => setSelectedSeatId(seat.id)}
                        >
                          {seat.seatNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
