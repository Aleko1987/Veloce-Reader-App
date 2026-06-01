import { forwardRef, useMemo, useRef, useState } from "react";
import { formatProcessingLabel, type ProcessingInfo } from "@/types/processing";
import { selectWords } from "@/store/reader-store";

type Props = {
  raw: string;
  processed: string;
  processing: ProcessingInfo | null;
};

function wordCount(text: string): number {
  return selectWords({ text }).length;
}

export function TranscriptComparison({ raw, processed, processing }: Props) {
  const [syncScroll, setSyncScroll] = useState(true);
  const rawRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef<HTMLDivElement>(null);

  const rawWords = useMemo(() => wordCount(raw), [raw]);
  const processedWords = useMemo(() => wordCount(processed), [processed]);
  const reduction =
    rawWords > 0 ? Math.round((1 - processedWords / rawWords) * 100) : 0;

  const onScroll = (source: "raw" | "processed") => {
    if (!syncScroll) return;
    const from = source === "raw" ? rawRef.current : processedRef.current;
    const to = source === "raw" ? processedRef.current : rawRef.current;
    if (!from || !to) return;
    const ratio = from.scrollTop / Math.max(1, from.scrollHeight - from.clientHeight);
    to.scrollTop = ratio * Math.max(1, to.scrollHeight - to.clientHeight);
  };

  const methodBadge =
    processing?.method === "llm"
      ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
      : processing?.method === "heuristic"
        ? "bg-sky-950/40 border-sky-800/50 text-sky-300"
        : "bg-zinc-900 border-zinc-700 text-zinc-400";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-300">
            Raw vs processed
          </h3>
          <p className="text-xs text-zinc-500 max-w-xl">
            Side-by-side view of the fetched transcript and what you will read after
            processing. Enable sync scroll to compare the same section in both columns.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-500 font-mono shrink-0">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(e) => setSyncScroll(e.target.checked)}
            className="accent-amber-400"
          />
          Sync scroll
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`px-3 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wider ${methodBadge}`}
        >
          {processing ? formatProcessingLabel(processing) : "Unclassified"}
        </span>
        {processing && (
          <span className="text-[10px] text-zinc-600 font-mono">
            provider={processing.provider} · method={processing.method} · model=
            {processing.model}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Raw words" value={rawWords.toLocaleString()} />
        <MiniStat label="Processed words" value={processedWords.toLocaleString()} />
        <MiniStat
          label="Reduction"
          value={rawWords > 0 ? `${reduction}%` : "—"}
          highlight={reduction > 0}
        />
        <MiniStat
          label="Processor"
          value={processing?.method ?? "—"}
          hint={processing?.model}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TranscriptPanel
          ref={rawRef}
          title="Raw transcript"
          subtitle="As fetched from YouTube"
          text={raw}
          tone="zinc"
          onScroll={() => onScroll("raw")}
        />
        <TranscriptPanel
          ref={processedRef}
          title="Processed transcript"
          subtitle="Used for RSVP reading"
          text={processed}
          tone="amber"
          onScroll={() => onScroll("processed")}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">
        {label}
      </p>
      <p
        className={`text-lg font-bold tabular-nums mt-0.5 ${
          highlight ? "text-amber-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-zinc-600 font-mono truncate mt-0.5">{hint}</p>
      )}
    </div>
  );
}

const TranscriptPanel = forwardRef<
  HTMLDivElement,
  {
    title: string;
    subtitle: string;
    text: string;
    tone: "zinc" | "amber";
    onScroll: () => void;
  }
>(function TranscriptPanel({ title, subtitle, text, tone, onScroll }, ref) {
  const border =
    tone === "amber" ? "border-amber-400/30" : "border-zinc-800";
  const header =
    tone === "amber" ? "text-amber-400/90" : "text-zinc-500";

  return (
    <div className={`rounded-xl border ${border} bg-black flex flex-col min-h-[280px]`}>
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <h4 className={`text-xs uppercase tracking-widest font-mono ${header}`}>
          {title}
        </h4>
        <p className="text-[10px] text-zinc-600 mt-0.5">{subtitle}</p>
      </div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4 text-sm text-zinc-300 font-mono leading-relaxed max-h-[360px]"
      >
        {text || (
          <span className="text-zinc-600">No transcript loaded.</span>
        )}
      </div>
    </div>
  );
});
