import { db } from "~/db/schema"
import type { FeedbackSentiment, NegativeFeedbackReason } from "~/types/domain"
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

  if (input.sentiment === "relevant") {
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

  if (input.sentiment === "not_relevant") {
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

  const patterns = Array.from(
    new Set([
      ...(score?.negative_signals ?? []),
      ...(score?.matched_signals ?? []).slice(0, 2),
      post?.subreddit ? `r/${post.subreddit}` : ""
    ])
  )
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .slice(0, 5)

  await db.mutedPatterns.bulkAdd(
    patterns.map((pattern) => ({
      id: createId("mute"),
      watcher_id: input.watcherId,
      pattern,
      source: "feedback" as const,
      enabled: true,
      created_at: now,
      updated_at: now
    }))
  )

  await logInfo("learning", "Muted similar patterns", {
    watcher_id: input.watcherId,
    post_id: input.postId,
    patterns
  })
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
