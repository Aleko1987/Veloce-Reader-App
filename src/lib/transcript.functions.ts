import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractYoutubeVideoId } from "./youtube-id";

const InputSchema = z.object({
  url: z.string().url(),
});

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

    try {
      const { fetchYoutubeCaptionText } = await import("./youtube-captions");
      const text = await fetchYoutubeCaptionText(videoId);
      return { text, error: null as string | null };
    } catch (err) {
      console.error("Transcript fetch failed:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch transcript";
      return { text: "", error: message };
    }
  });
