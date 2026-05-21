import { getActiveProvider, getSettings } from "~/db/bootstrap"
import { db } from "~/db/schema"
import type {
  AiProviderRecord,
  AiQueueRecord,
  AiScoreRecord,
  PreferenceMemoryRecord,
  RedditPostRecord,
  WatcherRecord
} from "~/types/domain"
import { createId } from "~/utils/id"
import { addMinutes, nowIso } from "~/utils/time"

import { logError, logInfo, logWarning } from "~/services/logging/logger"

import { createAiProvider } from "../providers"
import { toScorePostInput } from "../types"

const MIN_AI_DELAY_MS = 10_000

export interface QueueSummary {
  pending: number
  running: number
  failed: number
  nextRunAt?: string
}

export async function enqueueAiBatches(input: {
  watcherId: string
  providerId: string
  scanRunId?: string
  postIds: string[]
  batchSize: number
}): Promise<AiQueueRecord[]> {
  const now = nowIso()
  const batches = chunk(input.postIds, input.batchSize).map((postIds) => ({
    id: createId("aiq"),
    provider_id: input.providerId,
    watcher_id: input.watcherId,
    scan_run_id: input.scanRunId,
    post_ids: postIds,
    status: "pending" as const,
    attempts: 0,
    max_attempts: 2,
    batch_size: postIds.length,
    run_after: now,
    created_at: now,
    updated_at: now
  }))

  if (batches.length > 0) {
    await db.aiQueue.bulkAdd(batches)
    await logInfo("ai_queue", "AI batch created", {
      watcher_id: input.watcherId,
      scan_run_id: input.scanRunId,
      batches: batches.length,
      posts: input.postIds.length
    })
  }

  return batches
}

export async function getAiQueueSummary(): Promise<QueueSummary> {
  const [pending, running, failed, next] = await Promise.all([
    db.aiQueue.where("status").anyOf("pending", "rate_limited").count(),
    db.aiQueue.where("status").equals("running").count(),
    db.aiQueue.where("status").equals("failed").count(),
    db.aiQueue
      .where("status")
      .anyOf("pending", "rate_limited")
      .sortBy("run_after")
  ])

  return {
    pending,
    running,
    failed,
    nextRunAt: next[0]?.run_after
  }
}

export async function processAiQueue(input: {
  maxBatches?: number
  force?: boolean
} = {}): Promise<number> {
  const maxBatches = input.maxBatches ?? 1
  const processed: string[] = []
  const now = new Date()

  for (let index = 0; index < maxBatches; index += 1) {
    const queueItem = await getNextQueueItem(now, input.force ?? false)
    if (!queueItem) break

    const provider = await db.aiProviders.get(queueItem.provider_id)
    const watcher = await db.watchers.get(queueItem.watcher_id)
    if (!provider || !watcher) {
      await failQueueItem(queueItem, "Missing provider or watcher")
      continue
    }

    const delayMs = await getProviderDelayMs(provider)
    if (!input.force && delayMs > 0) {
      await markRateLimited(queueItem, delayMs)
      break
    }

    await runQueueItem(queueItem, provider, watcher)
    processed.push(queueItem.id)
  }

  return processed.length
}

export async function processQueueForActiveProvider(): Promise<number> {
  const provider = await getActiveProvider()
  if (!provider) return 0

  return processAiQueue({ maxBatches: 1 })
}

async function getNextQueueItem(
  now: Date,
  force: boolean
): Promise<AiQueueRecord | undefined> {
  const candidates = await db.aiQueue
    .where("status")
    .anyOf("pending", "rate_limited")
    .sortBy("run_after")

  return candidates.find(
    (item) => force || new Date(item.run_after).getTime() <= now.getTime()
  )
}

async function runQueueItem(
  queueItem: AiQueueRecord,
  provider: AiProviderRecord,
  watcher: WatcherRecord
): Promise<void> {
  const startedAt = nowIso()

  await db.aiQueue.update(queueItem.id, {
    status: "running",
    locked_at: startedAt,
    attempts: queueItem.attempts + 1,
    updated_at: startedAt
  })

  await logInfo("ai_queue", "AI request started", {
    queue_id: queueItem.id,
    watcher_id: watcher.id,
    post_count: queueItem.post_ids.length,
    provider_id: provider.id
  })

  try {
    const posts = await loadQueuePosts(queueItem)
    const input = await buildBatchInput(watcher, provider, posts)
    const aiProvider = createAiProvider(provider)
    const result = await aiProvider.scorePosts(input)
    const completedAt = nowIso()

    await db.transaction(
      "rw",
      db.aiScores,
      db.aiQueue,
      db.scanRuns,
      async () => {
        await db.aiScores.bulkPut(
          result.results.map((score) =>
            toAiScoreRecord(score, watcher, provider, posts, completedAt)
          )
        )

        await db.aiQueue.update(queueItem.id, {
          status: "completed",
          completed_at: completedAt,
          updated_at: completedAt,
          locked_at: undefined,
          last_error: undefined
        })

        await incrementScanRun(queueItem.scan_run_id, {
          ai_requests_sent: 1,
          ai_scored_posts: result.results.length,
          threshold_matches: result.results.filter((score) =>
            meetsWatcherThresholds(score, watcher)
          ).length
        })
      }
    )

    await logInfo("ai", "AI score received", {
      queue_id: queueItem.id,
      scores: result.results.length
    })
  } catch (error) {
    await handleQueueFailure(queueItem, error)
  }
}

async function handleQueueFailure(
  queueItem: AiQueueRecord,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)

  await logError("ai", "AI request failed", {
    queue_id: queueItem.id,
    attempt: queueItem.attempts + 1,
    error: message
  })

  if (queueItem.attempts === 0 && queueItem.post_ids.length > 1) {
    const smallerBatchSize = Math.max(1, Math.ceil(queueItem.post_ids.length / 2))
    const now = nowIso()
    const retryBatches = chunk(queueItem.post_ids, smallerBatchSize).map(
      (postIds) => ({
        id: createId("aiq"),
        provider_id: queueItem.provider_id,
        watcher_id: queueItem.watcher_id,
        scan_run_id: queueItem.scan_run_id,
        post_ids: postIds,
        status: "pending" as const,
        attempts: 1,
        max_attempts: 2,
        batch_size: postIds.length,
        run_after: now,
        last_error: message,
        created_at: now,
        updated_at: now
      })
    )

    await db.transaction("rw", db.aiQueue, async () => {
      await db.aiQueue.update(queueItem.id, {
        status: "failed",
        updated_at: now,
        locked_at: undefined,
        last_error: message
      })
      await db.aiQueue.bulkAdd(retryBatches)
    })

    await logWarning("ai_queue", "Retrying failed AI batch with smaller batches", {
      queue_id: queueItem.id,
      retry_batches: retryBatches.length
    })
    return
  }

  await markPostsAiFailed(queueItem, message)
}

async function markPostsAiFailed(
  queueItem: AiQueueRecord,
  message: string
): Promise<void> {
  const now = nowIso()
  const posts = await loadQueuePosts(queueItem)
  const provider = await db.aiProviders.get(queueItem.provider_id)

  await db.transaction("rw", db.aiScores, db.aiQueue, db.scanRuns, async () => {
    if (provider) {
      await db.aiScores.bulkPut(
        posts.map((post) => ({
          id: `${queueItem.watcher_id}:${post.id}`,
          watcher_id: queueItem.watcher_id,
          post_id: post.id,
          provider_id: provider.id,
          relevance: 0,
          urgency: 0,
          confidence: 0,
          notify: false,
          summary: "AI scoring failed for this post.",
          why_this_matters: "ThreadWise could not parse or complete the AI response.",
          matched_signals: [],
          negative_signals: [message],
          category: "noise" as const,
          is_hidden_gem: false,
          local_candidate_score: post.local_candidate_score ?? 0,
          ai_failed: true,
          ai_error: message,
          created_at: now,
          updated_at: now
        }))
      )
    }

    await db.aiQueue.update(queueItem.id, {
      status: "failed",
      updated_at: now,
      locked_at: undefined,
      last_error: message
    })

    await incrementScanRun(queueItem.scan_run_id, {
      ai_requests_failed: 1,
      ai_errors: [message]
    })
  })
}

async function failQueueItem(
  queueItem: AiQueueRecord,
  message: string
): Promise<void> {
  const now = nowIso()
  await db.aiQueue.update(queueItem.id, {
    status: "failed",
    updated_at: now,
    locked_at: undefined,
    last_error: message
  })
  await logError("ai_queue", message, { queue_id: queueItem.id })
}

async function markRateLimited(
  queueItem: AiQueueRecord,
  delayMs: number
): Promise<void> {
  const now = new Date()
  const runAfter = new Date(now.getTime() + delayMs).toISOString()

  await db.aiQueue.update(queueItem.id, {
    status: "rate_limited",
    run_after: runAfter,
    updated_at: now.toISOString(),
    locked_at: undefined
  })

  await logWarning("ai_queue", "AI rate limit delay applied", {
    queue_id: queueItem.id,
    delay_ms: delayMs
  })
}

async function getProviderDelayMs(provider: AiProviderRecord): Promise<number> {
  const now = Date.now()
  const since = new Date(now - 60_000).toISOString()
  const recentRequests = await db.aiQueue
    .where("provider_id")
    .equals(provider.id)
    .filter(
      (item) =>
        item.status === "completed" &&
        !!item.completed_at &&
        item.completed_at >= since
    )
    .toArray()

  if (recentRequests.length >= provider.requests_per_minute) {
    const oldest = recentRequests
      .map((item) => new Date(item.completed_at ?? item.updated_at).getTime())
      .sort((a, b) => a - b)[0]

    if (oldest) return Math.max(MIN_AI_DELAY_MS, oldest + 60_000 - now)
  }

  const latestCompleted = recentRequests
    .map((item) => new Date(item.completed_at ?? item.updated_at).getTime())
    .sort((a, b) => b - a)[0]

  if (latestCompleted && now - latestCompleted < MIN_AI_DELAY_MS) {
    return MIN_AI_DELAY_MS - (now - latestCompleted)
  }

  return 0
}

async function loadQueuePosts(
  queueItem: AiQueueRecord
): Promise<RedditPostRecord[]> {
  const posts = await db.posts.bulkGet(queueItem.post_ids)
  return posts.filter((post): post is RedditPostRecord => Boolean(post))
}

async function buildBatchInput(
  watcher: WatcherRecord,
  provider: AiProviderRecord,
  posts: RedditPostRecord[]
) {
  const memory = await db.preferenceMemory
    .where("watcher_id")
    .equals(watcher.id)
    .toArray()

  return {
    watcher,
    provider,
    posts: posts.map((post) =>
      toScorePostInput(post, post.local_candidate_score ?? 0)
    ),
    positiveMemory: memory.filter((item) => item.type === "positive_signal"),
    negativeMemory: memory.filter((item) => item.type === "negative_signal"),
    acceptedExamples: memory.filter((item) => item.type === "accepted_example"),
    rejectedExamples: memory.filter((item) => item.type === "rejected_example")
  }
}

function toAiScoreRecord(
  score: {
    id: string
    relevance: number
    urgency: number
    confidence: number
    notify: boolean
    summary: string
    why_this_matters: string
    matched_signals: string[]
    negative_signals: string[]
    category: AiScoreRecord["category"]
    is_hidden_gem: boolean
  },
  watcher: WatcherRecord,
  provider: AiProviderRecord,
  posts: RedditPostRecord[],
  now: string
): AiScoreRecord {
  const post = posts.find((candidate) => candidate.id === score.id)

  return {
    id: `${watcher.id}:${score.id}`,
    watcher_id: watcher.id,
    post_id: score.id,
    provider_id: provider.id,
    relevance: score.relevance,
    urgency: score.urgency,
    confidence: score.confidence,
    notify: score.notify && meetsWatcherThresholds(score, watcher),
    summary: score.summary,
    why_this_matters: score.why_this_matters,
    matched_signals: score.matched_signals,
    negative_signals: score.negative_signals,
    category: score.category,
    is_hidden_gem:
      score.is_hidden_gem &&
      score.relevance >= 80 &&
      score.confidence >= 70 &&
      ((post?.score ?? 0) <= 25 || (post?.num_comments ?? 0) <= 12),
    local_candidate_score: post?.local_candidate_score ?? 0,
    created_at: now,
    updated_at: now
  }
}

function meetsWatcherThresholds(
  score: {
    relevance: number
    urgency: number
    confidence: number
  },
  watcher: WatcherRecord
): boolean {
  return (
    score.relevance >= watcher.relevance_threshold &&
    score.urgency >= watcher.urgency_threshold &&
    score.confidence >= watcher.confidence_threshold
  )
}

async function incrementScanRun(
  scanRunId: string | undefined,
  patch: Partial<{
    ai_requests_sent: number
    ai_requests_failed: number
    ai_scored_posts: number
    threshold_matches: number
    ai_errors: string[]
  }>
): Promise<void> {
  if (!scanRunId) return

  const run = await db.scanRuns.get(scanRunId)
  if (!run) return

  await db.scanRuns.update(scanRunId, {
    ai_requests_sent:
      run.ai_requests_sent + (patch.ai_requests_sent ?? 0),
    ai_requests_failed:
      run.ai_requests_failed + (patch.ai_requests_failed ?? 0),
    ai_scored_posts: run.ai_scored_posts + (patch.ai_scored_posts ?? 0),
    threshold_matches:
      run.threshold_matches + (patch.threshold_matches ?? 0),
    ai_errors: [...run.ai_errors, ...(patch.ai_errors ?? [])]
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  const safeSize = Math.max(1, size)

  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize))
  }

  return chunks
}
