import Dexie, { type Table } from "dexie"

import type {
  AiProviderRecord,
  AiQueueRecord,
  AiScoreRecord,
  FeedbackRecord,
  LogEntryRecord,
  MutedPatternRecord,
  NotificationHistoryRecord,
  PreferenceMemoryRecord,
  RedditPostRecord,
  ScanRunRecord,
  SettingsRecord,
  SubredditSourceRecord,
  WatcherRecord
} from "~/types/domain"

export class ThreadWiseDatabase extends Dexie {
  settings!: Table<SettingsRecord, string>
  aiProviders!: Table<AiProviderRecord, string>
  watchers!: Table<WatcherRecord, string>
  subredditSources!: Table<SubredditSourceRecord, string>
  posts!: Table<RedditPostRecord, string>
  aiScores!: Table<AiScoreRecord, string>
  feedback!: Table<FeedbackRecord, string>
  preferenceMemory!: Table<PreferenceMemoryRecord, string>
  notificationHistory!: Table<NotificationHistoryRecord, string>
  scanRuns!: Table<ScanRunRecord, string>
  mutedPatterns!: Table<MutedPatternRecord, string>
  logs!: Table<LogEntryRecord, string>
  aiQueue!: Table<AiQueueRecord, string>

  constructor() {
    super("threadwise")

    this.version(1).stores({
      settings: "id, active_provider_id, updated_at",
      ai_providers: "id, provider_type, enabled, updated_at",
      watchers: "id, template_type, enabled, updated_at",
      subreddit_sources: "id, watcher_id, subreddit, enabled",
      posts:
        "id, reddit_id, subreddit, created_utc, fetched_at, permalink, last_seen_at",
      ai_scores:
        "id, [watcher_id+post_id], watcher_id, post_id, provider_id, notify, is_hidden_gem, created_at",
      feedback:
        "id, [watcher_id+post_id], watcher_id, post_id, sentiment, created_at",
      preference_memory:
        "id, watcher_id, type, value, weight, updated_at",
      notification_history:
        "id, [watcher_id+post_id], watcher_id, post_id, created_at, clicked_at",
      scan_runs:
        "id, watcher_id, started_at, finished_at, status, notifications_sent",
      muted_patterns: "id, watcher_id, pattern, enabled, updated_at",
      logs: "id, timestamp, level, source",
      ai_queue:
        "id, provider_id, watcher_id, scan_run_id, status, run_after, locked_at, created_at, updated_at"
    })

    this.settings = this.table("settings")
    this.aiProviders = this.table("ai_providers")
    this.watchers = this.table("watchers")
    this.subredditSources = this.table("subreddit_sources")
    this.posts = this.table("posts")
    this.aiScores = this.table("ai_scores")
    this.feedback = this.table("feedback")
    this.preferenceMemory = this.table("preference_memory")
    this.notificationHistory = this.table("notification_history")
    this.scanRuns = this.table("scan_runs")
    this.mutedPatterns = this.table("muted_patterns")
    this.logs = this.table("logs")
    this.aiQueue = this.table("ai_queue")
  }
}

export const db = new ThreadWiseDatabase()
