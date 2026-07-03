import { create } from "zustand";

import type { PracticeStep, TicketTemplateType } from "@/types/practice";

type PracticeState = {
  step: PracticeStep;
  templateType: TicketTemplateType;
  selectedZoneId?: string;
  selectedSeatId?: string;
  remainingMs: number;
  setStep: (step: PracticeStep) => void;
  setTemplateType: (templateType: TicketTemplateType) => void;
  selectSeat: (selectedZoneId: string, selectedSeatId: string) => void;
  setRemainingMs: (remainingMs: number) => void;
  reset: () => void;
};

const initialState = {
  step: "WAITING_QUEUE" as PracticeStep,
  templateType: "basic" as TicketTemplateType,
  selectedZoneId: undefined,
  selectedSeatId: undefined,
  remainingMs: 60_000,
};

export const usePracticeStore = create<PracticeState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setTemplateType: (templateType) => set({ templateType }),
  selectSeat: (selectedZoneId, selectedSeatId) =>
    set({ selectedZoneId, selectedSeatId }),
  setRemainingMs: (remainingMs) => set({ remainingMs }),
  reset: () => set(initialState),
}));
