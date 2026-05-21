import type {
  AiProviderRecord,
  SettingsRecord,
  WatcherRecord,
  WatcherTemplateType
} from "~/types/domain"
import { createId } from "~/utils/id"
import { nowIso } from "~/utils/time"

import { db } from "./schema"
import { getWatcherTemplate } from "./templates"

export const DEFAULT_SETTINGS_ID = "global"
export const MOCK_PROVIDER_ID = "provider_mock"

export function createDefaultSettings(now = nowIso()): SettingsRecord {
  return {
    id: DEFAULT_SETTINGS_ID,
    active_provider_id: MOCK_PROVIDER_ID,
    global_notifications_enabled: true,
    verbose_logging_enabled: false,
    default_scan_interval_minutes: 30,
    default_ai_requests_per_minute: 6,
    default_ai_batch_size: 5,
    onboarding_completed: false,
    created_at: now,
    updated_at: now
  }
}

export function createMockProvider(now = nowIso()): AiProviderRecord {
  return {
    id: MOCK_PROVIDER_ID,
    provider_type: "mock",
    display_name: "Mock provider",
    base_url: "mock://local",
    api_key_encrypted_or_local: "",
    model: "threadwise-mock",
    enabled: true,
    requests_per_minute: 60,
    max_batch_size: 5,
    created_at: now,
    updated_at: now
  }
}

export async function initializeDatabase(): Promise<void> {
  const now = nowIso()

  await db.transaction("rw", db.settings, db.aiProviders, async () => {
    const settings = await db.settings.get(DEFAULT_SETTINGS_ID)
    if (!settings) {
      await db.settings.put(createDefaultSettings(now))
    }

    const mockProvider = await db.aiProviders.get(MOCK_PROVIDER_ID)
    if (!mockProvider) {
      await db.aiProviders.put(createMockProvider(now))
    }
  })
}

export async function getSettings(): Promise<SettingsRecord> {
  await initializeDatabase()

  const settings = await db.settings.get(DEFAULT_SETTINGS_ID)
  if (!settings) {
    const created = createDefaultSettings()
    await db.settings.put(created)
    return created
  }

  return settings
}

export async function getActiveProvider(): Promise<AiProviderRecord | undefined> {
  const settings = await getSettings()
  return db.aiProviders.get(settings.active_provider_id)
}

export function buildGeneratedPrompt(
  templateType: WatcherTemplateType,
  userPrompt: string
): string {
  const template = getWatcherTemplate(templateType)
  const baseGoal = template?.goal ?? "Find Reddit threads that match the user's intent."
  const customIntent = userPrompt.trim()

  return [
    baseGoal,
    customIntent ? `User intent: ${customIntent}` : "",
    "Prioritize specific, actionable, high-signal threads. Avoid noisy, promotional, repetitive, or low-effort posts."
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function createWatcherFromTemplate(input: {
  templateType: WatcherTemplateType
  name?: string
  userPrompt?: string
  subreddits?: string[]
  enabled?: boolean
}): Promise<WatcherRecord> {
  const now = nowIso()
  const template = getWatcherTemplate(input.templateType)
  const subreddits = normalizeSubreddits(
    input.subreddits?.length ? input.subreddits : template?.suggestedSubreddits ?? []
  )

  const watcher: WatcherRecord = {
    id: createId("watcher"),
    name: input.name?.trim() || template?.name || "Custom Watcher",
    template_type: input.templateType,
    user_prompt: input.userPrompt?.trim() ?? "",
    generated_prompt: buildGeneratedPrompt(
      input.templateType,
      input.userPrompt ?? ""
    ),
    subreddits,
    relevance_threshold: 75,
    urgency_threshold: 40,
    confidence_threshold: 60,
    scan_interval_minutes: 30,
    max_post_age_hours: 24,
    enabled: input.enabled ?? false,
    notifications_enabled: true,
    created_at: now,
    updated_at: now
  }

  await db.transaction("rw", db.watchers, db.subredditSources, async () => {
    await db.watchers.put(watcher)
    await db.subredditSources.bulkPut(
      subreddits.map((subreddit) => ({
        id: createId("subreddit"),
        watcher_id: watcher.id,
        subreddit,
        enabled: true,
        created_at: now,
        updated_at: now
      }))
    )
  })

  return watcher
}

export function normalizeSubreddit(subreddit: string): string {
  return subreddit
    .trim()
    .replace(/^https?:\/\/(www\.)?reddit\.com\/r\//i, "")
    .replace(/^\/?r\//i, "")
    .replace(/\/.*$/, "")
    .replace(/[^A-Za-z0-9_]/g, "")
}

export function normalizeSubreddits(subreddits: string[]): string[] {
  return Array.from(
    new Set(
      subreddits
        .map(normalizeSubreddit)
        .filter((subreddit) => subreddit.length > 0)
    )
  )
}
