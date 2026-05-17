import { create } from "zustand";

export interface PlayerState {
  /** Currently-locked station id; null = nothing locked, player NOT mounted. */
  currentStationId: string | null;
  /** Locked + playing vs locked + paused. */
  isPlaying: boolean;
  /** Synthetic progress 0..1 used by waveform + scrubber until real WebAudio lands. */
  progress: number;

  /** Right-panel selection (legacy radio-station flow). */
  selectedStationId: string | null;
  /** V3 right-panel selection (marketplace pack flow). null = panel NOT mounted. */
  selectedPackId: string | null;

  play: (stationId: string) => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  setProgress: (p: number) => void;

  select: (stationId: string) => void;
  closePanel: () => void;

  selectPack: (packId: string) => void;
  closePackPanel: () => void;
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  currentStationId: null,
  isPlaying: false,
  progress: 0,
  selectedStationId: null,
  selectedPackId: null,

  play: (stationId) =>
    set((s) =>
      s.currentStationId === stationId
        ? { isPlaying: true }
        : { currentStationId: stationId, isPlaying: true, progress: 0 },
    ),
  pause: () => set({ isPlaying: false }),
  toggle: () => set({ isPlaying: !get().isPlaying }),
  stop: () => set({ currentStationId: null, isPlaying: false, progress: 0 }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(1, p)) }),

  select: (stationId) =>
    set({ selectedStationId: stationId, selectedPackId: null }),
  closePanel: () => set({ selectedStationId: null }),

  selectPack: (packId) =>
    set({ selectedPackId: packId, selectedStationId: null }),
  closePackPanel: () => set({ selectedPackId: null }),
}));
