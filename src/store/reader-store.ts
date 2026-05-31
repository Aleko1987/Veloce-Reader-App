import { create } from "zustand";
import { z } from "zod";

export const ViewSchema = z.enum(["home", "dashboard", "reader"]);
export type View = z.infer<typeof ViewSchema>;

export const ReaderStateSchema = z.object({
  text: z.string(),
  wpm: z.number().min(100).max(1200),
  isPlaying: z.boolean(),
  index: z.number().min(0),
  view: ViewSchema,
  url: z.string(),
});

export type ReaderState = z.infer<typeof ReaderStateSchema>;

const DEFAULT_TEXT = "";

interface ReaderActions {
  setText: (text: string) => void;
  setWpm: (wpm: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  next: () => void;
  setIndex: (i: number) => void;
  setView: (v: View) => void;
  setUrl: (u: string) => void;
  loadTranscript: (text: string) => void;
}

const initial: ReaderState = {
  text: DEFAULT_TEXT,
  wpm: 500,
  isPlaying: false,
  index: 0,
  view: "home",
  url: "",
};

ReaderStateSchema.parse(initial);

export const useReaderStore = create<ReaderState & ReaderActions>((set, get) => ({
  ...initial,
  setText: (text) => set({ text, index: 0, isPlaying: false }),
  setWpm: (wpm) => set({ wpm: ReaderStateSchema.shape.wpm.parse(wpm) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  toggle: () => set({ isPlaying: !get().isPlaying }),
  reset: () => set({ index: 0, isPlaying: false }),
  next: () => {
    const { index, text } = get();
    const words = text.trim().split(/\s+/);
    if (index >= words.length - 1) {
      set({ isPlaying: false });
      return;
    }
    set({ index: index + 1 });
  },
  setIndex: (i) => set({ index: Math.max(0, i) }),
  setView: (view) => set({ view }),
  setUrl: (url) => set({ url }),
  loadTranscript: (text) =>
    set({ text, index: 0, isPlaying: false, view: "dashboard" }),
}));

export const selectWords = (s: Pick<ReaderState, "text">) =>
  s.text.trim().split(/\s+/).filter(Boolean);
