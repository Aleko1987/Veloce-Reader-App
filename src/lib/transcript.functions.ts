import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url(),
});

export const fetchYoutubeTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { YoutubeTranscript } = await import("youtube-transcript");
    try {
      const segments = await YoutubeTranscript.fetchTranscript(data.url);
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
