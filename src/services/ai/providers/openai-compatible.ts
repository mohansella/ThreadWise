import { decodeLocalSecret } from "~/utils/secrets"

import { buildBatchScorePrompt } from "../prompts"
import type {
  AiProvider,
  AiProviderConfig,
  BatchScoreInput,
  BatchScoreResult
} from "../types"
import { extractJsonObject, validateBatchScoreResult } from "../validation"

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface ChatPayload {
  messages: Array<{ role: "system" | "user"; content: string }>
  max_tokens: number
  temperature: number
  response_format?: { type: "json_object" }
}

export class OpenAiCompatibleProvider implements AiProvider {
  id: string
  name: string

  constructor(private readonly config: AiProviderConfig) {
    this.id = config.id
    this.name = config.display_name
  }

  async validateConfig(config: AiProviderConfig): Promise<boolean> {
    if (!config.base_url.trim()) return false
    if (!decodeLocalSecret(config.api_key_encrypted_or_local) && !isLocalBaseUrl(config.base_url)) {
      return false
    }

    const response = await this.chat(config, {
      messages: [
        {
          role: "system",
          content: "Return strict JSON only."
        },
        {
          role: "user",
          content: "Return {\"ok\":true}."
        }
      ],
      max_tokens: 20,
      temperature: 0,
      response_format: { type: "json_object" }
    })

    return response.ok
  }

  async scorePosts(input: BatchScoreInput): Promise<BatchScoreResult> {
    const prompt = buildBatchScorePrompt(input)
    const payload: ChatPayload = {
      messages: [
        {
          role: "system",
          content:
            "You score Reddit posts for ThreadWise. You must return strict JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1600,
      temperature: 0.2,
      response_format: { type: "json_object" }
    }

    let response = await this.chat(this.config, payload)
    if (!response.ok && response.status === 400) {
      response = await this.chat(this.config, {
        ...payload,
        response_format: undefined
      })
    }

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after")
      const retrySuffix = retryAfter ? ` retry_after=${retryAfter}s` : ""
      throw new Error(
        `AI request failed with ${response.status} ${response.statusText}.${retrySuffix}`
      )
    }

    const json = (await response.json()) as ChatCompletionResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error("AI response did not include message content")

    const parsed = extractJsonObject(content)
    const validated = validateBatchScoreResult(parsed)
    const requestedIds = new Set(input.posts.map((post) => post.id))
    const filtered = validated.results.filter((result) =>
      requestedIds.has(result.id)
    )

    if (filtered.length !== input.posts.length) {
      throw new Error("AI response did not include every requested post id")
    }

    return { results: filtered }
  }

  private async chat(
    config: AiProviderConfig,
    payload: ChatPayload
  ): Promise<Response> {
    const apiKey = decodeLocalSecret(config.api_key_encrypted_or_local)
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    return fetch(`${normalizeBaseUrl(config.base_url)}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        ...payload
      })
    })
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "")
}

function isLocalBaseUrl(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(baseUrl)
}
