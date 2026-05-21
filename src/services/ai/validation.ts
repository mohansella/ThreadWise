import { z } from "zod"

export const batchScoreItemSchema = z.object({
  id: z.string().min(1),
  relevance: z.number().min(0).max(100),
  urgency: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  notify: z.boolean(),
  summary: z.string().min(1).max(700),
  why_this_matters: z.string().min(1).max(900),
  matched_signals: z.array(z.string()).default([]),
  negative_signals: z.array(z.string()).default([]),
  category: z.enum([
    "opportunity",
    "technical",
    "trend",
    "complaint",
    "learning",
    "career",
    "discussion",
    "noise"
  ]),
  is_hidden_gem: z.boolean()
})

export const batchScoreResultSchema = z.object({
  results: z.array(batchScoreItemSchema)
})

export function validateBatchScoreResult(value: unknown) {
  return batchScoreResultSchema.parse(value)
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim())
    }

    const firstBrace = trimmed.indexOf("{")
    const lastBrace = trimmed.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
    }

    throw new Error("AI response did not contain parseable JSON")
  }
}
