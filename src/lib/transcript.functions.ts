import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url(),
});

/** Supports watch, youtu.be, embed, and Shorts URLs. */
function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^&]+&)*v=|youtube\.com\/watch\?v=)([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/v\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export const fetchYoutubeTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const videoId = extractYoutubeVideoId(data.url);
    if (!videoId) {
      return {
        text: "",
        error:
          "Could not read a video ID from that URL. Use a link like https://www.youtube.com/watch?v=… or https://youtu.be/…",
      };
    }

    const { YoutubeTranscript } = await import("youtube-transcript");
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      const text = segments
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/&amp;#39;/g, "'")
        .replace(/&amp;quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .trim();
      if (!text) {
        return { text: "", error: "Transcript is empty for this video." };
      }
      return { text, error: null as string | null };
    } catch (err) {
      console.error("Transcript fetch failed:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch transcript";
      return { text: "", error: message };
    }
  });
