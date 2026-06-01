import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProcessingInfoSchema, type ProcessingInfo } from "@/types/processing";

const InputSchema = z.object({
  rawText: z.string().min(1),
});

function normalizeSentence(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function heuristicProcess(rawText: string): string {
  const seen = new Set<string>();
  const sentences = rawText.split(/(?<=[.!?])\s+/);
  const unique: string[] = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const key = normalizeSentence(trimmed);
    if (key.length >= 20 && seen.has(key)) continue;
    if (key.length >= 20) seen.add(key);
    unique.push(trimmed);
  }
  return unique.join(" ").trim();
}

function resolveOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function openAiProcessingInfo(model: string): ProcessingInfo {
  return ProcessingInfoSchema.parse({
    provider: "openai",
    model,
    method: "llm",
    label: `OpenAI ${model}`,
  });
}

function heuristicProcessingInfo(): ProcessingInfo {
  return ProcessingInfoSchema.parse({
    provider: "local",
    model: "sentence-dedup-v1",
    method: "heuristic",
    label: "Local sentence deduplication",
  });
}

async function llmProcess(rawText: string, model: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const excerpt = rawText.slice(0, 24_000);
  const system = `You clean a YouTube transcript for speed reading.
Remove filler, repetition, and duplicated ideas. Keep facts and meaning.
Return only the polished transcript prose — no preamble.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: excerpt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty text.");
  return text;
}

export const processTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const rawText = data.rawText.trim();

    try {
      if (process.env.OPENAI_API_KEY) {
        const model = resolveOpenAiModel();
        const processedText = await llmProcess(rawText, model);
        return {
          rawText,
          processedText,
          processing: openAiProcessingInfo(model),
          error: null as string | null,
        };
      }

      const processedText = heuristicProcess(rawText);
      return {
        rawText,
        processedText,
        processing: heuristicProcessingInfo(),
        error:
          "OPENAI_API_KEY not set — used local deduplication instead of an LLM.",
      };
    } catch (err) {
      const processedText = heuristicProcess(rawText);
      const message = err instanceof Error ? err.message : "Processing failed";
      return {
        rawText,
        processedText,
        processing: heuristicProcessingInfo(),
        error: `${message} Fell back to local deduplication.`,
      };
    }
  });
