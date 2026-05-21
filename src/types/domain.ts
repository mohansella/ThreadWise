export type ProviderType =
  | "openai_compatible"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "mistral"
  | "together"
  | "ollama"
  | "custom"
  | "mock"

export type WatcherTemplateType =
  | "startup_pain_finder"
  | "indie_hacker_signal"
  | "developer_opportunity_finder"
  | "ai_trend_watcher"
  | "content_idea_finder"
  | "career_opportunity_watcher"
  | "high_quality_discussion_finder"
  | "custom"

export type AiScoreCategory =
  | "opportunity"
  | "technical"
  | "trend"
  | "complaint"
  | "learning"
  | "career"
  | "discussion"
  | "noise"

export type QueueStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "rate_limited"

export type ScanRunStatus = "success" | "partial" | "failed" | "running"

export type FeedbackSentiment = "relevant" | "not_relevant" | "saved"

export type NegativeFeedbackReason =
  | "too_beginner"
  | "too_promotional"
  | "wrong_topic"
  | "not_actionable"
  | "low_quality"
  | "already_known"
  | "too_political"
  | "rage_bait"
  | "other"

export type LogLevel = "info" | "warning" | "error"

export type LogSource =
  | "scanner"
  | "reddit"
  | "ai"
  | "ai_queue"
  | "notification"
  | "learning"
  | "ui"

export interface SettingsRecord {
  id: "global"
  active_provider_id: string
  global_notifications_enabled: boolean
  notification_snoozed_until?: string
  verbose_logging_enabled: boolean
  default_scan_interval_minutes: number
  default_ai_requests_per_minute: number
  default_ai_batch_size: 3 | 5 | 10
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface AiProviderRecord {
  id: string
  provider_type: ProviderType
  display_name: string
  base_url: string
  api_key_encrypted_or_local: string
  model: string
  enabled: boolean
  requests_per_minute: number
  max_batch_size: 3 | 5 | 10
  created_at: string
  updated_at: string
}

export interface WatcherRecord {
  id: string
  name: string
  template_type: WatcherTemplateType
  user_prompt: string
  generated_prompt: string
  subreddits: string[]
  relevance_threshold: number
  urgency_threshold: number
  confidence_threshold: number
  scan_interval_minutes: number
  max_post_age_hours: number
  enabled: boolean
  notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface SubredditSourceRecord {
  id: string
  watcher_id: string
  subreddit: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface RedditPostRecord {
  id: string
  reddit_id: string
  subreddit: string
  title: string
  author?: string
  selftext?: string
  url: string
  permalink: string
  score: number
  num_comments: number
  created_utc: number
  fetched_at: string
  source_listing: "hot" | "new" | "rising"
  local_candidate_score?: number
  last_seen_at: string
}

export interface AiScoreRecord {
  id: string
  watcher_id: string
  post_id: string
  provider_id: string
  relevance: number
  urgency: number
  confidence: number
  notify: boolean
  summary: string
  why_this_matters: string
  matched_signals: string[]
  negative_signals: string[]
  category: AiScoreCategory
  is_hidden_gem: boolean
  local_candidate_score: number
  ai_failed?: boolean
  ai_error?: string
  created_at: string
  updated_at: string
}

export interface FeedbackRecord {
  id: string
  watcher_id: string
  post_id: string
  score_id?: string
  sentiment: FeedbackSentiment
  reason?: NegativeFeedbackReason
  note?: string
  created_at: string
}

export interface PreferenceMemoryRecord {
  id: string
  watcher_id: string
  type: "positive_signal" | "negative_signal" | "accepted_example" | "rejected_example"
  value: string
  weight: number
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface NotificationHistoryRecord {
  id: string
  watcher_id: string
  post_id: string
  score_id: string
  title: string
  subreddit: string
  reason: string
  relevance: number
  created_at: string
  clicked_at?: string
  dismissed_at?: string
}

export interface ScanRunRecord {
  id: string
  watcher_id: string
  started_at: string
  finished_at?: string
  status: ScanRunStatus
  subreddits_checked: string[]
  posts_fetched: number
  new_posts: number
  existing_posts: number
  skipped_posts: number
  local_candidate_posts: number
  ai_batches_created: number
  ai_requests_sent: number
  ai_requests_failed: number
  ai_scored_posts: number
  threshold_matches: number
  notifications_sent: number
  reddit_errors: string[]
  ai_errors: string[]
  reddit_rate_limit_info?: RateLimitInfo
  ai_rate_limit_info?: RateLimitInfo
  queue_status: string
  debug_notes: string[]
}

export interface RateLimitInfo {
  used?: number
  remaining?: number
  reset_seconds?: number
  retry_after_seconds?: number
  source?: string
}

export interface MutedPatternRecord {
  id: string
  watcher_id: string
  pattern: string
  source: "manual" | "feedback"
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface LogEntryRecord {
  id: string
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
  metadata?: Record<string, unknown>
}

export interface AiQueueRecord {
  id: string
  provider_id: string
  watcher_id: string
  scan_run_id?: string
  post_ids: string[]
  status: QueueStatus
  attempts: number
  max_attempts: number
  batch_size: number
  run_after: string
  locked_at?: string
  last_error?: string
  rate_limit_info?: RateLimitInfo
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface WatcherTemplate {
  type: Exclude<WatcherTemplateType, "custom">
  name: string
  goal: string
  suggestedSubreddits: string[]
  positiveKeywords: string[]
  negativeKeywords: string[]
}

export interface ProviderPreset {
  provider_type: ProviderType
  display_name: string
  base_url: string
  model: string
  requests_per_minute: number
  max_batch_size: 3 | 5 | 10
}
