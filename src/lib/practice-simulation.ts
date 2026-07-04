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

type SeatSellOutPolicy = {
  intervalMs: number;
  minRemoveCount: number;
  maxRemoveCount: number;
};

export const QUEUE_POLICY: Record<PracticeDifficulty, QueuePolicy> = {
  easy: {
    min: 300,
    max: 800,
    intervalMs: 240,
    decrementMin: 25,
    decrementMax: 65,
  },
  normal: {
    min: 900,
    max: 2200,
    intervalMs: 300,
    decrementMin: 35,
    decrementMax: 85,
  },
  hard: {
    min: 2600,
    max: 6200,
    intervalMs: 340,
    decrementMin: 50,
    decrementMax: 115,
  },
};

export const SELECTABLE_SEAT_POLICY: Record<
  PracticeDifficulty,
  SelectableSeatPolicy
> = {
  easy: {
    minCount: 6,
    maxCount: 10,
    ratio: 0.12,
  },
  normal: {
    minCount: 4,
    maxCount: 6,
    ratio: 0.06,
  },
  hard: {
    minCount: 2,
    maxCount: 4,
    ratio: 0.025,
  },
};

export const SEAT_CLAIM_POLICY: Record<
  PracticeDifficulty,
  SeatClaimPolicy
> = {
  easy: {
    delayMs: 1500,
    successRate: 0.6,
    selectionDeadlineMs: null,
  },
  normal: {
    delayMs: 1200,
    successRate: 0.35,
    selectionDeadlineMs: 1000,
  },
  hard: {
    delayMs: 900,
    successRate: 0.12,
    selectionDeadlineMs: 650,
  },
};

export const SEAT_SELL_OUT_POLICY: Record<
  PracticeDifficulty,
  SeatSellOutPolicy
> = {
  easy: {
    intervalMs: 1800,
    minRemoveCount: 1,
    maxRemoveCount: 2,
  },
  normal: {
    intervalMs: 1100,
    minRemoveCount: 1,
    maxRemoveCount: 3,
  },
  hard: {
    intervalMs: 900,
    minRemoveCount: 1,
    maxRemoveCount: 2,
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

export function getNextSoldOutSeatIds(input: {
  difficulty: PracticeDifficulty;
  remainingSeatIds: string[];
}) {
  const policy = SEAT_SELL_OUT_POLICY[input.difficulty];
  const removeCount = Math.min(
    getRandomInteger(policy.minRemoveCount, policy.maxRemoveCount),
    input.remainingSeatIds.length,
  );

  return sampleSeatIds({
    seatIds: input.remainingSeatIds,
    count: removeCount,
  });
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
