import { getWatcherTemplate } from "~/db/templates"
import type {
  MutedPatternRecord,
  RedditPostRecord,
  WatcherRecord
} from "~/types/domain"
import { hoursBetween } from "~/utils/time"

const PROBLEM_WORDS = [
  "problem",
  "pain",
  "frustrated",
  "hate",
  "annoying",
  "expensive",
  "missing",
  "alternative",
  "workflow",
  "manual",
  "bug",
  "broken",
  "struggling",
  "recommend"
]

const LOW_VALUE_PATTERNS = [
  /\b(upvote|karma|giveaway|meme|shitpost)\b/i,
  /\b(check out my|follow me|subscribe)\b/i,
  /\b(buy now|limited time|promo code)\b/i
]

export interface LocalScoreResult {
  score: number
  skipped: boolean
  reasons: string[]
}

export function scoreLocalCandidate(
  post: RedditPostRecord,
  watcher: WatcherRecord,
  mutedPatterns: MutedPatternRecord[]
): LocalScoreResult {
  const text = `${post.title} ${post.selftext ?? ""}`.toLowerCase()
  const reasons: string[] = []
  const ageHours = hoursBetween(post.created_utc)

  if (ageHours > watcher.max_post_age_hours) {
    return { score: 0, skipped: true, reasons: ["older than watcher limit"] }
  }

  const muted = mutedPatterns.find(
    (pattern) =>
      pattern.enabled && text.includes(pattern.pattern.trim().toLowerCase())
  )
  if (muted) {
    return { score: 0, skipped: true, reasons: [`muted: ${muted.pattern}`] }
  }

  if (LOW_VALUE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { score: 0, skipped: true, reasons: ["obvious low-value pattern"] }
  }

  const template = getWatcherTemplate(watcher.template_type)
  const positiveKeywordMatches =
    template?.positiveKeywords.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ) ?? []
  const negativeKeywordMatches =
    template?.negativeKeywords.filter((keyword) =>
      text.includes(keyword.toLowerCase())
    ) ?? []
  const problemMatches = PROBLEM_WORDS.filter((word) => text.includes(word))

  let score = 24

  if (
    watcher.subreddits.some(
      (subreddit) => subreddit.toLowerCase() === post.subreddit.toLowerCase()
    )
  ) {
    score += 12
    reasons.push("watcher subreddit")
  }

  if (ageHours <= 6) score += 12
  else if (ageHours <= 24) score += 6

  score += Math.min(14, post.score / 8)
  score += Math.min(18, post.num_comments / 3)
  score += Math.min(26, positiveKeywordMatches.length * 8)
  score += Math.min(16, problemMatches.length * 5)
  score -= Math.min(30, negativeKeywordMatches.length * 12)

  if (positiveKeywordMatches.length) {
    reasons.push(`matched: ${positiveKeywordMatches.slice(0, 3).join(", ")}`)
  }
  if (problemMatches.length) {
    reasons.push("problem/opportunity wording")
  }
  if (negativeKeywordMatches.length) {
    reasons.push(`negative: ${negativeKeywordMatches.slice(0, 3).join(", ")}`)
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    skipped: false,
    reasons
  }
}
