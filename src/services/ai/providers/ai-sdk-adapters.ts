import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateObject, type LanguageModel } from "ai"
import { z } from "zod"

import { decodeLocalSecret } from "~/utils/secrets"

import { buildBatchScorePrompt } from "../prompts"
import type {
  AiProvider,
  AiProviderConfig,
  BatchScoreInput,
  BatchScoreResult
} from "../types"
import { batchScoreResultSchema, extractJsonObject } from "../validation"

const connectionTestSchema = z.object({
  ok: z.boolean()
})

abstract class AiSdkProviderAdapter implements AiProvider {
  id: string
  name: string

  constructor(protected readonly config: AiProviderConfig) {
    this.id = config.id
    this.name = config.display_name
  }

  async validateConfig(config: AiProviderConfig): Promise<boolean> {
    if (!config.model.trim()) return false
    if (this.requiresApiKey(config) && !decodeLocalSecret(config.api_key_encrypted_or_local)) {
      return false
    }

    const result = await generateObject({
      model: this.createModel(config),
      schema: connectionTestSchema,
      system: "Return strict JSON only.",
      prompt: 'Return {"ok": true}.',
      temperature: 0,
      maxOutputTokens: 50,
      experimental_repairText: repairJsonText
    })

    return result.object.ok === true
  }

  async scorePosts(input: BatchScoreInput): Promise<BatchScoreResult> {
    const result = await generateObject({
      model: this.createModel(input.provider),
      schema: batchScoreResultSchema,
      schemaName: "ThreadWiseBatchScoreResult",
      system:
        "You score Reddit posts for ThreadWise. Return strict JSON that matches the schema.",
      prompt: buildBatchScorePrompt(input),
      temperature: 0.2,
      maxOutputTokens: 1800,
      experimental_repairText: repairJsonText
    })

    return result.object
  }

  protected abstract createModel(config: AiProviderConfig): LanguageModel

  protected apiKey(config: AiProviderConfig): string | undefined {
    return decodeLocalSecret(config.api_key_encrypted_or_local) || undefined
  }

  protected baseUrl(config: AiProviderConfig): string | undefined {
    const baseUrl = config.base_url.trim()
    return baseUrl.length > 0 ? baseUrl : undefined
  }

  private requiresApiKey(config: AiProviderConfig): boolean {
    return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(
      config.base_url
    )
  }
}

export class OpenAiProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createOpenAI({
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config)
    })

    return provider(config.model)
  }
}

export class GeminiProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createGoogleGenerativeAI({
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config)
    })

    return provider(config.model)
  }
}

export class AnthropicProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createAnthropic({
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config)
    })

    return provider(config.model)
  }
}

export class OpenRouterProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createOpenAICompatible({
      name: "openrouter",
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config) ?? "https://openrouter.ai/api/v1",
      supportsStructuredOutputs: true
    })

    return provider(config.model)
  }
}

export class GroqProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createOpenAICompatible({
      name: "groq",
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config) ?? "https://api.groq.com/openai/v1",
      supportsStructuredOutputs: true
    })

    return provider(config.model)
  }
}

export class OpenAiCompatibleProviderAdapter extends AiSdkProviderAdapter {
  protected createModel(config: AiProviderConfig): LanguageModel {
    const provider = createOpenAICompatible({
      name: config.provider_type,
      apiKey: this.apiKey(config),
      baseURL: this.baseUrl(config) ?? "https://api.openai.com/v1",
      supportsStructuredOutputs: true
    })

    return provider(config.model)
  }
}

async function repairJsonText({ text }: { text: string }): Promise<string | null> {
  try {
    return JSON.stringify(extractJsonObject(text))
  } catch {
    return null
  }
}
