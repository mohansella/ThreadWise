import type { AiProvider, AiProviderConfig } from "../types"

import { MockAiProvider } from "./mock"
import { OpenAiCompatibleProvider } from "./openai-compatible"

export function createAiProvider(config: AiProviderConfig): AiProvider {
  if (config.provider_type === "mock") return new MockAiProvider()

  return new OpenAiCompatibleProvider(config)
}
