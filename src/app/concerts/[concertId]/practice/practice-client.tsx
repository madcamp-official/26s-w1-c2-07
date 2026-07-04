"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Ticket,
  TimerReset,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACTIVE_TICKET_TEMPLATE_TYPES,
  PRACTICE_DIFFICULTIES,
  PRACTICE_DIFFICULTY_LABELS,
  PRACTICE_STEP_LABELS,
  PRACTICE_TEMPLATE_LABELS,
  PRACTICE_TEMPLATE_STEPS,
} from "@/lib/practice";
import {
  getInitialQueueCount,
  getNextQueueCount,
  getSelectableSeatCount,
  QUEUE_POLICY,
  sampleSeatIds,
  SEAT_CLAIM_POLICY,
  shouldClaimSeatSucceed,
} from "@/lib/practice-simulation";
import type {
  PracticeDifficulty,
  PracticeStep,
  TicketTemplateType,
} from "@/types/practice";
import { generatePracticeCaptcha } from "@/utils/captchaGenerator";
import { formatPriceRange } from "@/utils/format";

type ConcertSummary = {
  id: string;
  title: string;
  artist: string;
  venueName: string;
  region: string;
  priceMin: number;
  priceMax: number;
};

type ScheduleSummary = {
  id: string;
  performanceDate: string;
  roundName: string;
  startTime: string;
};

type VirtualSeatSummary = {
  id: string;
  rowLabel: string;
  seatNumber: number;
  status: "available" | "sold" | "disabled";
};

type SeatZoneSummary = {
  id: string;
  name: string;
  grade: string;
  price: number | null;
  virtualSeats: VirtualSeatSummary[];
};

type PracticeClientProps = {
  concert: ConcertSummary;
  schedules: ScheduleSummary[];
  zones: SeatZoneSummary[];
};

type PracticePhase = "setup" | "running" | "result";

type PracticeSessionResponse = {
  data?: {
    practiceSession?: {
      id: string;
      status: "started" | "success" | "failed";
      elapsedMs: number;
      failReason?: string | null;
    };
  };
  error?: {
    message?: string;
  };
};

async function readPracticeSessionResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {} as PracticeSessionResponse;
  }

  try {
    return JSON.parse(text) as PracticeSessionResponse;
  } catch {
    return {
      error: {
        message: response.ok
          ? "티켓팅 연습 응답을 해석하지 못했습니다."
          : "티켓팅 연습 요청 처리 중 서버 오류가 발생했습니다.",
      },
    } satisfies PracticeSessionResponse;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTimer(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const seconds = Math.ceil(safeMilliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

function sortSeats(seats: VirtualSeatSummary[]) {
  return [...seats].sort((a, b) => {
    const rowDiff =
      Number.parseInt(a.rowLabel, 10) - Number.parseInt(b.rowLabel, 10);

    if (Number.isFinite(rowDiff) && rowDiff !== 0) {
      return rowDiff;
    }

    return a.seatNumber - b.seatNumber;
  });
}

function getNextStep(steps: PracticeStep[], currentStepIndex: number) {
  return steps[currentStepIndex + 1] ?? "RESULT";
}

export function PracticeClient({
  concert,
  schedules,
  zones,
}: PracticeClientProps) {
  const [phase, setPhase] = useState<PracticePhase>("setup");
  const [templateType, setTemplateType] =
    useState<TicketTemplateType>("nol");
  const [difficulty, setDifficulty] =
    useState<PracticeDifficulty>("normal");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [captchaText, setCaptchaText] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [initialQueueCount, setInitialQueueCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    schedules[0]?.id ?? null,
  );
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    zones[0]?.id ?? null,
  );
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedSeatAt, setSelectedSeatAt] = useState<number | null>(null);
  const [selectableSeatIds, setSelectableSeatIds] = useState<string[]>([]);
  const [expiredSeatIds, setExpiredSeatIds] = useState<string[]>([]);
  const [pendingSeatId, setPendingSeatId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "failed";
    elapsedMs: number;
    failReason?: string | null;
  } | null>(null);
  const completingRef = useRef(false);
  const bookingAttemptTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const steps = PRACTICE_TEMPLATE_STEPS[templateType];
  const currentStep = phase === "running" ? steps[currentStepIndex] : null;
  const seatClaimPolicy = SEAT_CLAIM_POLICY[difficulty];
  const selectedSchedule =
    schedules.find((schedule) => schedule.id === selectedScheduleId) ?? null;
  const selectedZone =
    zones.find((zone) => zone.id === selectedZoneId) ?? zones[0] ?? null;
  const selectedSeat =
    selectedZone?.virtualSeats.find((seat) => seat.id === selectedSeatId) ??
    null;
  const allAvailableSeatIds = useMemo(
    () =>
      zones.flatMap((zone) =>
        zone.virtualSeats
          .filter((seat) => seat.status === "available")
          .map((seat) => seat.id),
      ),
    [zones],
  );
  const remainingSelectableSeatIds = useMemo(
    () =>
      selectableSeatIds.filter((seatId) => !expiredSeatIds.includes(seatId)),
    [expiredSeatIds, selectableSeatIds],
  );
  const remainingSelectableSeatIdSet = useMemo(
    () => new Set(remainingSelectableSeatIds),
    [remainingSelectableSeatIds],
  );
  const expiredSeatIdSet = useMemo(
    () => new Set(expiredSeatIds),
    [expiredSeatIds],
  );
  const groupedSeats = useMemo(() => {
    if (!selectedZone) {
      return [];
    }

    const rowMap = new Map<string, VirtualSeatSummary[]>();

    for (const seat of sortSeats(selectedZone.virtualSeats)) {
      const rowSeats = rowMap.get(seat.rowLabel) ?? [];
      rowSeats.push(seat);
      rowMap.set(seat.rowLabel, rowSeats);
    }

    return Array.from(rowMap.entries()).map(([rowLabel, seats]) => ({
      rowLabel,
      seats,
    }));
  }, [selectedZone]);
  const queueProgressPercent =
    initialQueueCount > 0
      ? Math.min(
          100,
          Math.max(0, ((initialQueueCount - queueCount) / initialQueueCount) * 100),
        )
      : 0;

  const completePractice = useCallback(
    async (input: {
      status: "success" | "failed";
      failReason?: string | null;
    }) => {
      if (!sessionId || !startedAt || completingRef.current) {
        return;
      }

      completingRef.current = true;
      setIsCompleting(true);
      setMessage("");

      const finalElapsedMs = Date.now() - startedAt;

      try {
        const response = await fetch(
          `/api/practice-sessions/${sessionId}/complete`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: input.status,
              scheduleId: selectedScheduleId ?? undefined,
              selectedZoneId:
                input.status === "success" ? selectedZoneId : null,
              selectedSeatId:
                input.status === "success" ? selectedSeatId : null,
              elapsedMs: finalElapsedMs,
              failReason: input.failReason ?? null,
            }),
          },
        );
        const payload = await readPracticeSessionResponse(response);

        if (!response.ok) {
          throw new Error(
            payload.error?.message ?? "티켓팅 연습 결과 저장에 실패했습니다.",
          );
        }

        setResult({
          status: input.status,
          elapsedMs: finalElapsedMs,
          failReason: input.failReason,
        });
        setCurrentStepIndex(steps.length - 1);
        setPhase("result");
      } catch (error) {
        completingRef.current = false;
        setMessage(
          error instanceof Error
            ? error.message
            : "티켓팅 연습 결과 저장에 실패했습니다.",
        );
      } finally {
        setIsCompleting(false);
      }
    },
    [
      selectedScheduleId,
      selectedSeatId,
      selectedZoneId,
      sessionId,
      startedAt,
      steps.length,
    ],
  );

  function clearBookingAttemptTimer() {
    if (bookingAttemptTimerRef.current !== null) {
      window.clearTimeout(bookingAttemptTimerRef.current);
      bookingAttemptTimerRef.current = null;
    }
  }

  function clearToastTimer() {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function showToast(nextToastMessage: string) {
    clearToastTimer();
    setToastMessage(nextToastMessage);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 2200);
  }

  function initializeQueueStep() {
    const nextQueueCount = getInitialQueueCount(difficulty);

    setInitialQueueCount(nextQueueCount);
    setQueueCount(nextQueueCount);
  }

  function initializeSeatSelectStep() {
    clearBookingAttemptTimer();

    const candidateCount = getSelectableSeatCount({
      difficulty,
      totalAvailableSeats: allAvailableSeatIds.length,
    });
    const candidateSeatIds = sampleSeatIds({
      seatIds: allAvailableSeatIds,
      count: candidateCount,
    });
    const firstCandidateZone = zones.find((zone) =>
      zone.virtualSeats.some((seat) => candidateSeatIds.includes(seat.id)),
    );

    setSelectableSeatIds(candidateSeatIds);
    setExpiredSeatIds([]);
    setPendingSeatId(null);
    setSelectedSeatId(null);
    setSelectedSeatAt(null);

    if (firstCandidateZone) {
      setSelectedZoneId(firstCandidateZone.id);
    }
  }

  function prepareStep(step: PracticeStep) {
    if (step === "WAITING_QUEUE") {
      initializeQueueStep();
      return;
    }

    if (step === "SEAT_SELECT") {
      initializeSeatSelectStep();
    }
  }

  useEffect(() => {
    if (phase !== "running" || !startedAt || completingRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [phase, startedAt]);

  useEffect(() => {
    if (phase !== "running" || currentStep !== "WAITING_QUEUE") {
      return;
    }

    const interval = window.setInterval(() => {
      setQueueCount((currentCount) =>
        getNextQueueCount({
          difficulty,
          currentCount,
        }),
      );
    }, QUEUE_POLICY[difficulty].intervalMs);

    return () => window.clearInterval(interval);
  }, [currentStep, difficulty, phase]);

  useEffect(() => {
    if (
      phase !== "running" ||
      currentStep !== "WAITING_QUEUE" ||
      queueCount !== 0
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      advanceStep();
    }, 0);

    return () => window.clearTimeout(timeout);
    // advanceStep intentionally reads the latest render state for this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, phase, queueCount]);

  useEffect(() => {
    return () => {
      clearBookingAttemptTimer();
      clearToastTimer();
    };
  }, []);

  async function handleStart() {
    setIsStarting(true);
    setMessage("");
    setToastMessage("");
    completingRef.current = false;
    clearBookingAttemptTimer();
    clearToastTimer();

    try {
      const response = await fetch("/api/practice-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concertId: concert.id,
          templateType,
          difficulty,
        }),
      });
      const payload = await readPracticeSessionResponse(response);

      if (!response.ok || !payload.data?.practiceSession?.id) {
        throw new Error(
          payload.error?.message ?? "티켓팅 연습을 시작하지 못했습니다.",
        );
      }

      setSessionId(payload.data.practiceSession.id);
      setCurrentStepIndex(0);
      setStartedAt(Date.now());
      setElapsedMs(0);
      setCaptchaText(generatePracticeCaptcha());
      setCaptchaInput("");
      setSelectedSeatId(null);
      setSelectedSeatAt(null);
      setSelectableSeatIds([]);
      setExpiredSeatIds([]);
      setPendingSeatId(null);
      setResult(null);
      prepareStep(PRACTICE_TEMPLATE_STEPS[templateType][0]);
      setPhase("running");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "티켓팅 연습을 시작하지 못했습니다.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function advanceStep() {
    const nextStep = getNextStep(steps, currentStepIndex);

    if (nextStep === "RESULT") {
      void completePractice({
        status: "success",
      });
      return;
    }

    prepareStep(nextStep);
    setCurrentStepIndex((value) => value + 1);
    setMessage("");
  }

  function handleCaptchaSubmit() {
    if (captchaInput.trim().toUpperCase() !== captchaText) {
      setMessage("보안문자가 일치하지 않습니다.");
      return;
    }

    advanceStep();
  }

  function handleScheduleConfirm() {
    if (!selectedScheduleId) {
      setMessage("회차를 선택해주세요.");
      return;
    }

    advanceStep();
  }

  function handleSeatConfirm() {
    if (!selectedZoneId || !selectedSeatId) {
      setMessage("좌석 구역과 좌석을 선택해주세요.");
      return;
    }

    if (pendingSeatId) {
      return;
    }

    const nextPendingSeatId = selectedSeatId;
    const selectionElapsedMs = selectedSeatAt
      ? Date.now() - selectedSeatAt
      : Number.POSITIVE_INFINITY;

    setPendingSeatId(nextPendingSeatId);
    setMessage("예매 요청을 처리하는 중입니다.");

    bookingAttemptTimerRef.current = window.setTimeout(() => {
      bookingAttemptTimerRef.current = null;

      if (
        shouldClaimSeatSucceed({
          difficulty,
          selectionElapsedMs,
        })
      ) {
        setPendingSeatId(null);
        advanceStep();
        return;
      }

      const failedSeatId = nextPendingSeatId;
      setExpiredSeatIds((currentExpiredSeatIds) => {
        const nextExpiredSeatIds = currentExpiredSeatIds.includes(failedSeatId)
          ? currentExpiredSeatIds
          : [...currentExpiredSeatIds, failedSeatId];
        const remainingSeatIds = selectableSeatIds.filter(
          (seatId) => !nextExpiredSeatIds.includes(seatId),
        );

        if (remainingSeatIds.length === 0) {
          window.setTimeout(() => {
            void completePractice({
              status: "failed",
              failReason: "선택 가능한 좌석이 모두 사라졌습니다.",
            });
          }, 0);
        }

        return nextExpiredSeatIds;
      });
      setSelectedSeatId(null);
      setSelectedSeatAt(null);
      setPendingSeatId(null);
      showToast("이미 선택된 좌석입니다.");
      setMessage(
        seatClaimPolicy.selectionDeadlineMs !== null &&
          selectionElapsedMs > seatClaimPolicy.selectionDeadlineMs
          ? "예매 시도가 늦었습니다. 다른 좌석을 선택해 다시 시도해주세요."
          : "다른 좌석을 선택해 예매를 다시 시도해주세요.",
      );
    }, seatClaimPolicy.delayMs);
  }

  function handleSeatClick(seat: VirtualSeatSummary) {
    if (!remainingSelectableSeatIdSet.has(seat.id) || pendingSeatId) {
      return;
    }

    clearBookingAttemptTimer();
    setSelectedSeatId(seat.id);
    setSelectedSeatAt(Date.now());
    setPendingSeatId(null);
    setMessage("좌석을 선택했습니다. 예매 시도 버튼을 눌러 결과를 확인하세요.");
  }

  function handleRestart() {
    clearBookingAttemptTimer();
    clearToastTimer();
    setPhase("setup");
    setSessionId(null);
    setCurrentStepIndex(0);
    setStartedAt(null);
    setElapsedMs(0);
    setCaptchaText("");
    setCaptchaInput("");
    setInitialQueueCount(0);
    setQueueCount(0);
    setSelectedSeatId(null);
    setSelectedSeatAt(null);
    setSelectableSeatIds([]);
    setExpiredSeatIds([]);
    setPendingSeatId(null);
    setMessage("");
    setToastMessage("");
    setResult(null);
    completingRef.current = false;
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
      {toastMessage ? (
        <div
          className="fixed left-1/2 top-6 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-md border bg-background px-4 py-3 text-sm font-medium shadow-lg"
          role="alert"
        >
          {toastMessage}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {concert.artist} · {concert.region} · {concert.venueName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">티켓팅 연습</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            실제 예매가 아닌 연습용 흐름입니다. 좌석은 AI 분석 구역을 바탕으로
            생성한 VirtualSeat입니다.
          </p>
        </div>

        {phase === "setup" ? (
          <div className="mt-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold">사이트 방식 선택</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ACTIVE_TICKET_TEMPLATE_TYPES.map((type, index) => (
                  <button
                    key={type}
                    type="button"
                    className={[
                      "rounded-md border p-4 text-left transition",
                      templateType === type
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/60",
                    ].join(" ")}
                    onClick={() => setTemplateType(type)}
                  >
                    <span className="text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="mt-1 block font-medium">
                      {PRACTICE_TEMPLATE_LABELS[type]}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {PRACTICE_TEMPLATE_STEPS[type]
                        .filter((step) => step !== "RESULT")
                        .map((step) => PRACTICE_STEP_LABELS[step])
                        .join(" → ")}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">난이도</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                난이도가 높을수록 대기 인원이 많고, 선택 가능한 좌석 후보가
                줄어들며, 예매 성공률이 낮아집니다.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {PRACTICE_DIFFICULTIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={[
                      "rounded-md border px-4 py-3 text-left transition",
                      difficulty === item
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/60",
                    ].join(" ")}
                    onClick={() => {
                      setDifficulty(item);
                    }}
                  >
                    <span className="font-medium">
                      {PRACTICE_DIFFICULTY_LABELS[item]}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <Button onClick={handleStart} disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Ticket className="h-4 w-4" aria-hidden="true" />
              )}
              연습 시작
            </Button>
          </div>
        ) : null}

        {phase === "running" ? (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">
                  {currentStep ? PRACTICE_STEP_LABELS[currentStep] : ""}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {currentStepIndex + 1}/{steps.length - 1}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {formatTimer(elapsedMs)}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {steps
                .filter((step) => step !== "RESULT")
                .map((step, index) => (
                  <div
                    key={`${step}-${index}`}
                    className={[
                      "rounded-md border px-3 py-2 text-xs",
                      index === currentStepIndex
                        ? "border-primary bg-primary/5 text-primary"
                        : index < currentStepIndex
                          ? "bg-secondary text-muted-foreground"
                          : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {PRACTICE_STEP_LABELS[step]}
                  </div>
                ))}
            </div>

            {currentStep === "WAITING_QUEUE" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">대기열</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      예매 페이지 진입 전 대기 상태를 연습합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-md border bg-secondary p-4">
                  <p className="text-sm text-muted-foreground">
                    현재 대기 인원
                  </p>
                  <p className="mt-1 text-3xl font-semibold">
                    {queueCount.toLocaleString("ko-KR")}명
                  </p>
                </div>
                <div className="mt-5 h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{
                      width: `${queueProgressPercent}%`,
                    }}
                  />
                </div>
                <Button className="mt-5" disabled>
                  대기 중
                </Button>
              </section>
            ) : null}

            {currentStep === "CAPTCHA" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">보안문자 입력</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      표시된 문자를 정확히 입력해야 다음 단계로 이동합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 inline-flex rounded-md border bg-secondary px-4 py-3 font-mono text-2xl tracking-normal">
                  {captchaText.split("").join(" ")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    className="h-10 min-w-56 rounded-md border bg-background px-3 text-sm uppercase"
                    value={captchaInput}
                    onChange={(event) =>
                      setCaptchaInput(event.target.value.toUpperCase())
                    }
                    placeholder="보안문자 입력"
                  />
                  <Button onClick={handleCaptchaSubmit}>확인</Button>
                </div>
              </section>
            ) : null}

            {currentStep === "DATE_SELECT" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">날짜/회차 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      예매할 공연 회차를 선택합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  {schedules.map((schedule) => (
                    <button
                      key={schedule.id}
                      type="button"
                      className={[
                        "rounded-md border px-4 py-3 text-left transition",
                        selectedScheduleId === schedule.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/60",
                      ].join(" ")}
                      onClick={() => setSelectedScheduleId(schedule.id)}
                    >
                      <span className="font-medium">{schedule.roundName}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {formatDateTime(schedule.performanceDate)} ·{" "}
                        {schedule.startTime}
                      </span>
                    </button>
                  ))}
                </div>
                <Button className="mt-5" onClick={handleScheduleConfirm}>
                  회차 선택 완료
                </Button>
              </section>
            ) : null}

            {currentStep === "SEAT_SELECT" ? (
              <section className="rounded-md border p-5">
                <div className="flex items-center gap-3">
                  <Ticket className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold">좌석 선택</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      연습용 가상 좌석 중 하나를 선택합니다.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="grid gap-2 self-start">
                    {zones.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        className={[
                          "rounded-md border px-3 py-2 text-left text-sm transition",
                          selectedZoneId === zone.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/60",
                        ].join(" ")}
                        onClick={() => {
                          clearBookingAttemptTimer();
                          setSelectedZoneId(zone.id);
                          setSelectedSeatId(null);
                          setSelectedSeatAt(null);
                          setPendingSeatId(null);
                        }}
                      >
                        <span className="font-medium">
                          {zone.name} · {zone.grade}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          남은 후보{" "}
                          {
                            zone.virtualSeats.filter((seat) =>
                              remainingSelectableSeatIdSet.has(seat.id),
                            ).length
                          }
                          석 / 전체 {zone.virtualSeats.length}석
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-md border bg-secondary p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        선택 가능 후보 {remainingSelectableSeatIds.length}석 /{" "}
                        최초 {selectableSeatIds.length}석
                      </span>
                      <span>
                        예매 요청 처리{" "}
                        {(seatClaimPolicy.delayMs / 1000).toFixed(1)}초
                      </span>
                      {seatClaimPolicy.selectionDeadlineMs !== null ? (
                        <span>
                          선택 후{" "}
                          {(seatClaimPolicy.selectionDeadlineMs / 1000).toFixed(
                            1,
                          )}
                          초 내 예매 시도
                        </span>
                      ) : null}
                    </div>

                    {groupedSeats.length > 0 ? (
                      <div className="max-h-96 overflow-auto">
                        <div className="grid min-w-max gap-2">
                          {groupedSeats.map((row) => (
                            <div
                              key={row.rowLabel}
                              className="flex items-center gap-2"
                            >
                              <span className="w-10 shrink-0 text-xs text-muted-foreground">
                                {row.rowLabel}
                              </span>
                              <div className="flex gap-1.5">
                                {row.seats.map((seat) => {
                                  const isSelected =
                                    selectedSeatId === seat.id;
                                  const isPending =
                                    pendingSeatId === seat.id;
                                  const isExpired = expiredSeatIdSet.has(
                                    seat.id,
                                  );
                                  const isCandidate =
                                    remainingSelectableSeatIdSet.has(seat.id);
                                  const isSelectable =
                                    seat.status === "available" &&
                                    isCandidate &&
                                    !isExpired &&
                                    pendingSeatId === null;

                                  return (
                                    <button
                                      key={seat.id}
                                      type="button"
                                      className={[
                                        "h-8 w-8 shrink-0 rounded-md border bg-background text-xs font-medium transition",
                                        isSelected
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "",
                                        !isSelected && isCandidate
                                          ? "border-emerald-500 bg-emerald-50 text-emerald-900 hover:border-primary"
                                          : "",
                                        isPending
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "",
                                        !isCandidate || isExpired
                                          ? "cursor-not-allowed opacity-35"
                                          : "",
                                      ].join(" ")}
                                      title={
                                        isExpired
                                          ? "이미 선택된 좌석입니다."
                                          : isCandidate
                                            ? "선택 가능 후보 좌석"
                                            : "이번 연습에서는 선택할 수 없는 좌석"
                                      }
                                      disabled={!isSelectable}
                                      onClick={() => handleSeatClick(seat)}
                                    >
                                      {isPending ? "…" : seat.seatNumber}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        선택한 구역에 생성된 가상 좌석이 없습니다.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  className="mt-5"
                  onClick={handleSeatConfirm}
                  disabled={isCompleting || !selectedSeatId || Boolean(pendingSeatId)}
                >
                  {isCompleting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  예매 시도
                </Button>
              </section>
            ) : null}
          </div>
        ) : null}

        {phase === "result" && result ? (
          <section className="mt-6 rounded-md border p-5">
            <div className="flex items-center gap-3">
              {result.status === "success" ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <TimerReset className="h-6 w-6 text-destructive" />
              )}
              <div>
                <h2 className="text-xl font-semibold">
                  {result.status === "success" ? "예매 연습 성공" : "예매 연습 실패"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  소요 시간 {(result.elapsedMs / 1000).toFixed(1)}초
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 text-sm">
              <p>사이트 방식: {PRACTICE_TEMPLATE_LABELS[templateType]}</p>
              <p>
                회차:{" "}
                {selectedSchedule
                  ? `${selectedSchedule.roundName} · ${formatDateTime(selectedSchedule.performanceDate)}`
                  : "미선택"}
              </p>
              <p>
                좌석:{" "}
                {selectedZone && selectedSeat
                  ? `${selectedZone.name} ${selectedSeat.rowLabel} ${selectedSeat.seatNumber}번`
                  : "미선택"}
              </p>
              {result.failReason ? <p>실패 사유: {result.failReason}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleRestart}>다시 연습하기</Button>
              <Button asChild variant="outline">
                <Link href={`/concerts/${concert.id}`}>공연 상세로 돌아가기</Link>
              </Button>
            </div>
          </section>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-md border bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">{concert.title}</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <p>{concert.artist}</p>
            <p>
              {concert.region} · {concert.venueName}
            </p>
            <p>{formatPriceRange(concert.priceMin, concert.priceMax)}</p>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">연습 요약</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">사이트</span>
              <span>{PRACTICE_TEMPLATE_LABELS[templateType]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">난이도</span>
              <span>{PRACTICE_DIFFICULTY_LABELS[difficulty]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">소요 시간</span>
              <span>{formatTimer(elapsedMs)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">회차</span>
              <span>{selectedSchedule?.roundName ?? "미선택"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">좌석</span>
              <span>
                {selectedZone && selectedSeat
                  ? `${selectedZone.name} ${selectedSeat.rowLabel} ${selectedSeat.seatNumber}번`
                  : "미선택"}
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
