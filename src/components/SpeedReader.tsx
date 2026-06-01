import { useEffect, useMemo } from "react";
import { useReaderStore, selectWords } from "@/store/reader-store";

export function SpeedReader() {
  const { wpm, isPlaying, index, toggle, reset, setWpm, next, setText, text, setView } =
    useReaderStore();

  const words = useMemo(() => selectWords({ text }), [text]);
  const current = words[index] ?? "";
  const progress = words.length ? ((index + 1) / words.length) * 100 : 0;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = 60000 / wpm;
    const id = window.setInterval(() => next(), interval);
    return () => window.clearInterval(id);
  }, [isPlaying, wpm, next]);

  // Optical Recognition Point — highlight pivot letter
  const pivot = Math.max(0, Math.floor((current.length - 1) / 3));
  const before = current.slice(0, pivot);
  const focus = current.slice(pivot, pivot + 1);
  const after = current.slice(pivot + 1);

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl">
      <button
        onClick={() => setView("dashboard")}
        className="self-start text-xs text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-widest"
      >
        ← Dashboard
      </button>
      <div className="relative rounded-2xl border border-zinc-800 bg-zinc-950 p-12 min-h-[260px] flex items-center justify-center">
        <div className="absolute inset-x-12 top-1/2 -translate-y-12 h-px bg-zinc-800" />
        <div className="absolute inset-x-12 top-1/2 translate-y-12 h-px bg-zinc-800" />
        <div className="font-mono text-7xl md:text-[5.625rem] tracking-tight tabular-nums">
          <span className="text-zinc-500">{before}</span>
          <span className="text-amber-400">{focus}</span>
          <span className="text-zinc-100">{after}</span>
        </div>
      </div>

      <div className="h-1 w-full rounded-full bg-zinc-900 overflow-hidden">
        <div
          className="h-full bg-amber-400 transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="px-5 py-2.5 rounded-lg bg-amber-400 text-black text-sm font-semibold hover:bg-amber-300 transition"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg border border-zinc-800 text-zinc-300 text-sm hover:bg-zinc-900 transition"
        >
          Reset
        </button>
        <div className="ml-auto text-xs text-zinc-500 tabular-nums">
          {index + 1} / {words.length}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-widest text-zinc-500">
            Speed
          </label>
          <span className="text-sm font-mono text-amber-400">{wpm} WPM</span>
        </div>
        <input
          type="range"
          min={100}
          max={1200}
          step={25}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
      </div>

      <div className="space-y-3">
        <label className="text-xs uppercase tracking-widest text-zinc-500">
          Text
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:border-amber-400/50"
        />
      </div>
    </div>
  );
}
