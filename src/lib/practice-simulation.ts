import type { PracticeDifficulty } from "@/types/practice";

type QueuePolicy = {
  min: number;
  max: number;
  intervalMs: number;
  decrementMin: number;
  decrementMax: number;
};

type SelectableSeatPolicy = {
  minCount: number;
  maxCount: number;
  ratio: number;
};

type SeatClaimPolicy = {
  delayMs: number;
  successRate: number;
  selectionDeadlineMs: number | null;
};

export const QUEUE_POLICY: Record<PracticeDifficulty, QueuePolicy> = {
  easy: {
    min: 180,
    max: 450,
    intervalMs: 220,
    decrementMin: 30,
    decrementMax: 80,
  },
  normal: {
    min: 600,
    max: 1400,
    intervalMs: 260,
    decrementMin: 45,
    decrementMax: 120,
  },
  hard: {
    min: 1800,
    max: 4200,
    intervalMs: 300,
    decrementMin: 80,
    decrementMax: 220,
  },
};

export const SELECTABLE_SEAT_POLICY: Record<
  PracticeDifficulty,
  SelectableSeatPolicy
> = {
  easy: {
    minCount: 8,
    maxCount: 12,
    ratio: 0.18,
  },
  normal: {
    minCount: 5,
    maxCount: 8,
    ratio: 0.1,
  },
  hard: {
    minCount: 3,
    maxCount: 5,
    ratio: 0.05,
  },
};

export const SEAT_CLAIM_POLICY: Record<
  PracticeDifficulty,
  SeatClaimPolicy
> = {
  easy: {
    delayMs: 1400,
    successRate: 0.75,
    selectionDeadlineMs: null,
  },
  normal: {
    delayMs: 1000,
    successRate: 0.5,
    selectionDeadlineMs: null,
  },
  hard: {
    delayMs: 700,
    successRate: 0.25,
    selectionDeadlineMs: 900,
  },
};

function getRandomInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getInitialQueueCount(difficulty: PracticeDifficulty) {
  const policy = QUEUE_POLICY[difficulty];

  return getRandomInteger(policy.min, policy.max);
}

export function getNextQueueCount(input: {
  difficulty: PracticeDifficulty;
  currentCount: number;
}) {
  const policy = QUEUE_POLICY[input.difficulty];
  const decrement = getRandomInteger(policy.decrementMin, policy.decrementMax);

  return Math.max(0, input.currentCount - decrement);
}

export function getSelectableSeatCount(input: {
  difficulty: PracticeDifficulty;
  totalAvailableSeats: number;
}) {
  if (input.totalAvailableSeats <= 0) {
    return 0;
  }

  const policy = SELECTABLE_SEAT_POLICY[input.difficulty];
  const ratioCount = Math.round(input.totalAvailableSeats * policy.ratio);
  const count = clamp(ratioCount, policy.minCount, policy.maxCount);

  return Math.min(count, input.totalAvailableSeats);
}

export function sampleSeatIds(input: {
  seatIds: string[];
  count: number;
}) {
  const shuffledSeatIds = [...input.seatIds];

  for (let index = shuffledSeatIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentValue = shuffledSeatIds[index];
    shuffledSeatIds[index] = shuffledSeatIds[swapIndex];
    shuffledSeatIds[swapIndex] = currentValue;
  }

  return shuffledSeatIds.slice(0, input.count);
}

export function shouldClaimSeatSucceed(input: {
  difficulty: PracticeDifficulty;
  selectionElapsedMs: number;
}) {
  const policy = SEAT_CLAIM_POLICY[input.difficulty];

  if (
    policy.selectionDeadlineMs !== null &&
    input.selectionElapsedMs > policy.selectionDeadlineMs
  ) {
    return false;
  }

  return Math.random() < policy.successRate;
}
