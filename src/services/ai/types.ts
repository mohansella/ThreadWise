import type {
  AiProviderRecord,
  AiScoreCategory,
  PreferenceMemoryRecord,
  RedditPostRecord,
  WatcherRecord
} from "~/types/domain"

export interface AiProviderConfig extends AiProviderRecord {}

export interface ScorePostInput {
  id: string
  title: string
  subreddit: string
  selftext: string
  score: number
  num_comments: number
  age_hours: number
  permalink: string
  local_candidate_score: number
}

export interface BatchScoreInput {
  watcher: WatcherRecord
  provider: AiProviderRecord
  posts: ScorePostInput[]
  positiveMemory: PreferenceMemoryRecord[]
  negativeMemory: PreferenceMemoryRecord[]
  acceptedExamples: PreferenceMemoryRecord[]
  rejectedExamples: PreferenceMemoryRecord[]
}

export interface BatchScoreItem {
  id: string
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
}

export interface BatchScoreResult {
  results: BatchScoreItem[]
}

export interface AiProvider {
  id: string
  name: string
  scorePosts(input: BatchScoreInput): Promise<BatchScoreResult>
  validateConfig(config: AiProviderConfig): Promise<boolean>
}

export function toScorePostInput(
  post: RedditPostRecord,
  localCandidateScore: number
): ScorePostInput {
  return {
    id: post.id,
    title: post.title,
    subreddit: post.subreddit,
    selftext: (post.selftext ?? "").slice(0, 500),
    score: post.score,
    num_comments: post.num_comments,
    age_hours: Math.max(
      0,
      (Date.now() - post.created_utc * 1000) / 3_600_000
    ),
    permalink: post.permalink,
    local_candidate_score: localCandidateScore
  }
}
