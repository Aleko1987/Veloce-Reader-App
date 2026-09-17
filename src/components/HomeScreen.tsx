import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { processTranscript } from "@/lib/process-transcript.functions";
import { fetchYoutubeTranscript } from "@/lib/transcript.functions";
import { fetchYoutubeCaptionTextInBrowser } from "@/lib/youtube-captions-browser";
import { extractYoutubeVideoId } from "@/lib/youtube-id";
import { useReaderStore } from "@/store/reader-store";
import type { ProcessingInfo } from "@/types/processing";

export function HomeScreen() {
  const { url, setUrl, loadTranscript, setView } = useReaderStore();
  const fetchFn = useServerFn(fetchYoutubeTranscript);
  const processFn = useServerFn(processTranscript);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const ingestText = async (rawText: string) => {
    const processed = await processFn({ data: { rawText } });
    if (processed.error) setNotice(processed.error);
    loadTranscript({
      raw: processed.rawText,
      processed: processed.processedText,
      processing: processed.processing as ProcessingInfo,
    });
  };

  const handleAnalyze = async () => {
    setError(null);
    setNotice(null);
    if (!url.trim()) {
      setError("Enter a YouTube URL");
      return;
    }
    const videoId = extractYoutubeVideoId(url.trim());
    if (!videoId) {
      setError("Could not read a video ID from that URL.");
      return;
    }
    setLoading(true);
    try {
      let text = "";
      try {
        text = await fetchYoutubeCaptionTextInBrowser(videoId);
      } catch {
        const res = await fetchFn({ data: { url: url.trim() } });
        if (res.error || !res.text) {
          setShowPaste(true);
          setError(
            `${res.error ?? "No transcript available"} YouTube blocks caption downloads from the hosted server. Paste the transcript below, or run the app locally.`,
          );
          return;
        }
        text = res.text;
      }
      await ingestText(text);
    } catch (e) {
      setShowPaste(true);
      setError(e instanceof Error ? e.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  const handlePastedTranscript = async () => {
    setError(null);
    setNotice(null);
    if (!pasted.trim()) {
      setError("Paste a transcript first");
      return;
    }
    setLoading(true);
    try {
      await ingestText(pasted.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transcript");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = () => {
    const sample =
      "Welcome to Veloce Reader. Paste a YouTube URL above to analyze its transcript, or use this sample text to jump straight into rapid serial visual presentation reading at five hundred words per minute.";
    const passthrough: ProcessingInfo = {
      provider: "local",
      model: "none",
      method: "passthrough",
      label: "Sample text (no LLM)",
    };
    loadTranscript({ raw: sample, processed: sample, processing: passthrough });
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-8">
      <div className="space-y-3 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
          Read videos at <span className="text-amber-400">500 WPM</span>
        </h2>
        <p className="text-sm text-zinc-500">
          Paste a YouTube URL. We extract the transcript and feed it into the RSVP reader.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
        <label className="text-xs uppercase tracking-widest text-zinc-500">
          YouTube URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
          className="w-full rounded-lg bg-black border border-zinc-800 p-4 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
        />

        {error && (
          <div className="text-xs text-red-400 font-mono border border-red-900/50 bg-red-950/30 rounded-lg p-3">
            {error}
          </div>
        )}
        {notice && !error && (
          <div className="text-xs text-amber-300/90 font-mono border border-amber-900/40 bg-amber-950/20 rounded-lg p-3">
            {notice}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="flex-1 px-5 py-3 rounded-lg bg-amber-400 text-black text-sm font-semibold hover:bg-amber-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                Fetching & processing…
              </>
            ) : (
              "Analyze"
            )}
          </button>
          <button
            onClick={handlePaste}
            disabled={loading}
            className="px-5 py-3 rounded-lg border border-zinc-800 text-zinc-400 text-sm hover:bg-zinc-900 transition disabled:opacity-50"
          >
            Use sample
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowPaste((open) => !open)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showPaste ? "Hide paste box" : "Paste transcript instead"}
        </button>

        {showPaste && (
          <div className="space-y-3">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Paste the YouTube transcript here if automatic fetch is blocked."
              disabled={loading}
              rows={8}
              className="w-full rounded-lg bg-black border border-zinc-800 p-4 text-sm text-zinc-100 font-mono focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
            />
            <button
              onClick={handlePastedTranscript}
              disabled={loading}
              className="w-full px-5 py-3 rounded-lg border border-amber-400/40 text-amber-300 text-sm hover:bg-amber-950/40 transition disabled:opacity-50"
            >
              Load pasted transcript
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
