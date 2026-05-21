import { db } from "~/db/schema"
import type {
  AiScoreRecord,
  FeedbackSentiment,
  NegativeFeedbackReason,
  RedditPostRecord
} from "~/types/domain"
import { createId } from "~/utils/id"
import { nowIso } from "~/utils/time"

import { logInfo } from "~/services/logging/logger"

export async function recordThreadFeedback(input: {
  watcherId: string
  postId: string
  sentiment: FeedbackSentiment
  reason?: NegativeFeedbackReason
  note?: string
}): Promise<void> {
  const now = nowIso()
  const score = await db.aiScores
    .where("[watcher_id+post_id]")
    .equals([input.watcherId, input.postId])
    .first()
  const post = await db.posts.get(input.postId)
  const existing = await db.feedback
    .where("[watcher_id+post_id]")
    .equals([input.watcherId, input.postId])
    .first()
  const changed =
    !existing ||
    existing.sentiment !== input.sentiment ||
    existing.reason !== input.reason ||
    existing.note !== input.note

  if (existing) {
    await db.feedback.update(existing.id, {
      score_id: score?.id,
      sentiment: input.sentiment,
      reason: input.reason,
      note: input.note,
      created_at: now
    })
  } else {
    await db.feedback.add({
      id: createId("feedback"),
      watcher_id: input.watcherId,
      post_id: input.postId,
      score_id: score?.id,
      sentiment: input.sentiment,
      reason: input.reason,
      note: input.note,
      created_at: now
    })
  }

  if (changed && input.sentiment === "relevant") {
    await strengthenSignals(input.watcherId, score?.matched_signals ?? [], true)
    if (post) {
      await upsertMemory(
        input.watcherId,
        "accepted_example",
        `${post.title} (r/${post.subreddit})`,
        1
      )
    }
  }

  if (changed && input.sentiment === "not_relevant") {
    const reason = input.reason ? reasonLabel(input.reason) : "not relevant"
    await upsertMemory(input.watcherId, "negative_signal", reason, 2)
    await strengthenSignals(input.watcherId, score?.matched_signals ?? [], false)
    if (post) {
      await upsertMemory(
        input.watcherId,
        "rejected_example",
        `${post.title} (reason: ${reason})`,
        1
      )
    }
  }

  await logInfo("learning", "Feedback recorded", {
    watcher_id: input.watcherId,
    post_id: input.postId,
    sentiment: input.sentiment,
    reason: input.reason
  })
}

export async function muteSimilar(input: {
  watcherId: string
  postId: string
}): Promise<void> {
  const score = await db.aiScores
    .where("[watcher_id+post_id]")
    .equals([input.watcherId, input.postId])
    .first()
  const post = await db.posts.get(input.postId)
  const now = nowIso()
  const patterns = buildMutedPatternsForThread(score, post)

  for (const pattern of patterns) {
    const existing = await findMutedPattern(input.watcherId, pattern)

    if (existing) {
      await db.mutedPatterns.update(existing.id, {
        enabled: true,
        updated_at: now
      })
    } else {
      await db.mutedPatterns.add({
        id: createId("mute"),
        watcher_id: input.watcherId,
        pattern,
        source: "feedback",
        enabled: true,
        created_at: now,
        updated_at: now
      })
    }
  }

  await logInfo("learning", "Muted similar patterns", {
    watcher_id: input.watcherId,
    post_id: input.postId,
    patterns
  })
}

export async function unmuteSimilar(input: {
  watcherId: string
  postId: string
}): Promise<void> {
  const score = await db.aiScores
    .where("[watcher_id+post_id]")
    .equals([input.watcherId, input.postId])
    .first()
  const post = await db.posts.get(input.postId)
  const now = nowIso()
  const patterns = buildMutedPatternsForThread(score, post)

  for (const pattern of patterns) {
    const existing = await findMutedPattern(input.watcherId, pattern)
    if (!existing) continue

    await db.mutedPatterns.update(existing.id, {
      enabled: false,
      updated_at: now
    })
  }

  await logInfo("learning", "Unmuted similar patterns", {
    watcher_id: input.watcherId,
    post_id: input.postId,
    patterns
  })
}

export function buildMutedPatternsForThread(
  score:
    | Pick<AiScoreRecord, "negative_signals" | "matched_signals">
    | undefined,
  post: Pick<RedditPostRecord, "subreddit"> | undefined
): string[] {
  return Array.from(
    new Set([
      ...(score?.negative_signals ?? []),
      ...(score?.matched_signals ?? []).slice(0, 2),
      post?.subreddit ? `r/${post.subreddit}` : ""
    ])
  )
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .slice(0, 5)
}

async function findMutedPattern(watcherId: string, pattern: string) {
  const normalized = pattern.trim().toLowerCase()
  return db.mutedPatterns
    .where("watcher_id")
    .equals(watcherId)
    .filter((item) => item.pattern.trim().toLowerCase() === normalized)
    .first()
}

async function strengthenSignals(
  watcherId: string,
  signals: string[],
  positive: boolean
): Promise<void> {
  for (const signal of signals.slice(0, 6)) {
    await upsertMemory(
      watcherId,
      positive ? "positive_signal" : "negative_signal",
      signal,
      positive ? 1 : 2
    )
  }
}

async function upsertMemory(
  watcherId: string,
  type:
    | "positive_signal"
    | "negative_signal"
    | "accepted_example"
    | "rejected_example",
  value: string,
  increment: number
): Promise<void> {
  const normalized = value.trim()
  if (!normalized) return

  const existing = await db.preferenceMemory
    .where("watcher_id")
    .equals(watcherId)
    .filter(
      (memory) =>
        memory.type === type &&
        memory.value.toLowerCase() === normalized.toLowerCase()
    )
    .first()

  const now = nowIso()
  if (existing) {
    await db.preferenceMemory.update(existing.id, {
      weight: existing.weight + increment,
      updated_at: now
    })
    return
  }

  await db.preferenceMemory.add({
    id: createId("memory"),
    watcher_id: watcherId,
    type,
    value: normalized,
    weight: increment,
    created_at: now,
    updated_at: now
  })
}

function reasonLabel(reason: NegativeFeedbackReason): string {
  return reason.replace(/_/g, " ")
}
