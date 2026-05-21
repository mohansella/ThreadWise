import type { AiScoreCategory } from "~/types/domain"

import type {
  AiProvider,
  AiProviderConfig,
  BatchScoreInput,
  BatchScoreResult
} from "../types"

import { getWatcherTemplate } from "~/db/templates"

export class MockAiProvider implements AiProvider {
  id = "mock"
  name = "Mock provider"

  async validateConfig(_config: AiProviderConfig): Promise<boolean> {
    return true
  }

  async scorePosts(input: BatchScoreInput): Promise<BatchScoreResult> {
    const template = getWatcherTemplate(input.watcher.template_type)
    const positiveKeywords = template?.positiveKeywords ?? []
    const negativeKeywords = template?.negativeKeywords ?? []

    return {
      results: input.posts.map((post) => {
        const haystack = `${post.title} ${post.selftext}`.toLowerCase()
        const matched = positiveKeywords.filter((keyword) =>
          haystack.includes(keyword.toLowerCase())
        )
        const negative = negativeKeywords.filter((keyword) =>
          haystack.includes(keyword.toLowerCase())
        )

        const discussionBoost = Math.min(18, post.num_comments / 4)
        const tractionBoost = Math.min(10, post.score / 12)
        const local = post.local_candidate_score * 0.55
        const relevance = clamp(local + matched.length * 9 - negative.length * 14)
        const urgency = clamp(
          28 + discussionBoost + (post.age_hours <= 6 ? 18 : 4) + matched.length * 4
        )
        const confidence = clamp(
          52 + matched.length * 8 + tractionBoost - negative.length * 12
        )
        const isHiddenGem =
          relevance >= 80 &&
          confidence >= 70 &&
          (post.score <= 25 || post.num_comments <= 12)

        return {
          id: post.id,
          relevance,
          urgency,
          confidence,
          notify:
            relevance >= input.watcher.relevance_threshold &&
            urgency >= input.watcher.urgency_threshold &&
            confidence >= input.watcher.confidence_threshold,
          summary: summarize(post.title),
          why_this_matters:
            matched.length > 0
              ? `Matched ${matched.slice(0, 3).join(", ")} for ${input.watcher.name}.`
              : `Local signals suggest this may fit ${input.watcher.name}.`,
          matched_signals:
            matched.length > 0
              ? matched.slice(0, 5)
              : ["local score", "recent discussion"],
          negative_signals: negative.slice(0, 5),
          category: inferCategory(haystack),
          is_hidden_gem: isHiddenGem
        }
      })
    }
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function summarize(title: string): string {
  return title.length > 130 ? `${title.slice(0, 127)}...` : title
}

function inferCategory(text: string): AiScoreCategory {
  if (/(hiring|resume|interview|freelance|job)/.test(text)) return "career"
  if (/(bug|api|deploy|code|server|database)/.test(text)) return "technical"
  if (/(ai|model|agent|llm|automation)/.test(text)) return "trend"
  if (/(problem|pain|frustrated|complain|expensive)/.test(text)) {
    return "complaint"
  }
  if (/(how|learn|explain|guide)/.test(text)) return "learning"
  if (/(idea|startup|opportunity|validate)/.test(text)) return "opportunity"
  return "discussion"
}
