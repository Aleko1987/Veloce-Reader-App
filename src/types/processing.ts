import { z } from "zod";

export const ProcessingInfoSchema = z.object({
  provider: z.enum(["openai", "local"]),
  model: z.string(),
  method: z.enum(["llm", "heuristic", "passthrough"]),
  label: z.string(),
});

export type ProcessingInfo = z.infer<typeof ProcessingInfoSchema>;

export function formatProcessingLabel(info: ProcessingInfo): string {
  if (info.method === "passthrough") return "No processing — raw transcript only";
  if (info.method === "heuristic") return `Local dedup · ${info.model}`;
  return `${info.provider} · ${info.model}`;
}
