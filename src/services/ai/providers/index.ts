import type { AiProvider, AiProviderConfig } from "../types"

import {
  AnthropicProviderAdapter,
  GeminiProviderAdapter,
  GroqProviderAdapter,
  OpenAiCompatibleProviderAdapter,
  OpenAiProviderAdapter,
  OpenRouterProviderAdapter
} from "./ai-sdk-adapters"
import { MockAiProvider } from "./mock"

export function createAiProvider(config: AiProviderConfig): AiProvider {
  if (config.provider_type === "mock") return new MockAiProvider()
  if (config.provider_type === "openai") return new OpenAiProviderAdapter(config)
  if (config.provider_type === "gemini") return new GeminiProviderAdapter(config)
  if (config.provider_type === "anthropic") {
    return new AnthropicProviderAdapter(config)
  }
  if (config.provider_type === "openrouter") {
    return new OpenRouterProviderAdapter(config)
  }
  if (config.provider_type === "groq") return new GroqProviderAdapter(config)

  return new OpenAiCompatibleProviderAdapter(config)
}
