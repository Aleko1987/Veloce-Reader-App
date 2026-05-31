import { useMemo } from "react";
import { useReaderStore, selectWords } from "@/store/reader-store";

function computeInsights(words: string[]) {
  const freq = new Map<string, number>();
  const STOP = new Set([
    "the","a","an","and","or","but","is","are","was","were","be","been","being",
    "of","to","in","on","for","with","at","by","from","as","that","this","it",
    "you","i","we","they","he","she","them","us","our","your","my","me","so",
    "if","then","than","not","no","do","does","did","have","has","had","will",
    "would","can","could","should","just","about","like","one","up","out","get",
    "got","go","going","know","think","what","when","where","why","how",
  ]);
  for (const raw of words) {
    const w = raw.toLowerCase().replace(/[^a-z0-9'-]/g, "");
    if (!w || w.length < 4 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return {
    duplicates: sorted.filter(([, c]) => c >= 3).slice(0, 6),
    takeaways: sorted.slice(0, 4).map(([w]) => w),
  };
}

export function AnalysisDashboard() {
  const { text, setView, wpm } = useReaderStore();
  const words = useMemo(() => selectWords({ text }), [text]);
  const insights = useMemo(() => computeInsights(words), [words]);
  const minutes = Math.max(1, Math.round((words.length / wpm) * 10) / 10);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-mono">
            Analysis
          </p>
          <h2 className="text-3xl font-bold mt-1">Transcript Dashboard</h2>
        </div>
        <button
          onClick={() => setView("home")}
          className="text-xs text-zinc-500 hover:text-zinc-300 font-mono uppercase tracking-widest"
        >
          ← Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Word Count" value={words.length.toLocaleString()} />
        <StatCard label="Reading Time" value={`${minutes} min`} hint={`@ ${wpm} WPM`} />
        <StatCard label="Characters" value={text.length.toLocaleString()} />
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-sm font-mono uppercase tracking-widest">
              AI Insights
            </h3>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono uppercase">
            Preview · local model pending
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-black p-5 space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-zinc-500">
              Duplicated Concepts
            </h4>
            <div className="flex flex-wrap gap-2">
              {insights.duplicates.length === 0 ? (
                <span className="text-xs text-zinc-600">No repetitions detected.</span>
              ) : (
                insights.duplicates.map(([word, count]) => (
                  <span
                    key={word}
                    className="px-2.5 py-1 rounded-md border border-amber-400/30 bg-amber-400/5 text-amber-300 text-xs font-mono"
                  >
                    {word} <span className="text-amber-400/60">×{count}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black p-5 space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-zinc-500">
              Key Takeaways
            </h4>
            <ul className="space-y-2">
              {insights.takeaways.length === 0 ? (
                <li className="text-xs text-zinc-600">No takeaways yet.</li>
              ) : (
                insights.takeaways.map((w, i) => (
                  <li key={w} className="flex gap-3 text-sm text-zinc-300">
                    <span className="text-amber-400 font-mono">0{i + 1}</span>
                    <span>Frequent mention of <span className="text-zinc-100">{w}</span></span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-3">
        <h4 className="text-xs uppercase tracking-widest text-zinc-500">
          Transcript Preview
        </h4>
        <p className="text-sm text-zinc-400 font-mono leading-relaxed line-clamp-4">
          {text.slice(0, 400)}{text.length > 400 ? "…" : ""}
        </p>
      </div>

      <button
        onClick={() => setView("reader")}
        className="w-full px-5 py-4 rounded-xl bg-amber-400 text-black text-sm font-bold uppercase tracking-widest hover:bg-amber-300 transition"
      >
        Start Speed Reading →
      </button>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
        {label}
      </p>
      <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-600 mt-1 font-mono">{hint}</p>}
    </div>
  );
}
