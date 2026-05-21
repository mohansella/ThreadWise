import { getActiveProvider, getSettings } from "~/db/bootstrap"
import { db } from "~/db/schema"
import type {
  RateLimitInfo,
  RedditPostRecord,
  ScanRunRecord,
  WatcherRecord
} from "~/types/domain"
import { createId } from "~/utils/id"
import { nowIso } from "~/utils/time"

import { enqueueAiBatches, processAiQueue } from "~/services/ai/queue/queue"
import { logError, logInfo, logWarning } from "~/services/logging/logger"
import {
  fetchSubredditListing,
  type RedditListing
} from "~/services/reddit/client"

import { scoreLocalCandidate } from "./local-score"

const LISTINGS: RedditListing[] = ["hot", "new", "rising"]
const LOCAL_SCORE_THRESHOLD = 35
const MAX_CANDIDATES_PER_SCAN = 20

export async function scanEnabledWatchers(): Promise<ScanRunRecord[]> {
  const watchers = await db.watchers.filter((watcher) => watcher.enabled).toArray()
  const runs: ScanRunRecord[] = []

  for (const watcher of watchers) {
    runs.push(await scanWatcher(watcher.id))
  }

  return runs
}

export async function scanWatcher(watcherId: string): Promise<ScanRunRecord> {
  const watcher = await db.watchers.get(watcherId)
  if (!watcher) throw new Error(`Watcher not found: ${watcherId}`)

  const run = await createScanRun(watcher)
  await logInfo("scanner", "Scan started", {
    watcher_id: watcher.id,
    scan_run_id: run.id
  })

  try {
    const result = await fetchWatcherPosts(watcher)
    const existing = await db.posts.bulkGet(result.posts.map((post) => post.id))
    const existingIds = new Set(
      existing.filter((post): post is RedditPostRecord => Boolean(post)).map((post) => post.id)
    )
    const existingScores = await db.aiScores
      .where("watcher_id")
      .equals(watcher.id)
      .toArray()
    const alreadyScoredIds = new Set(existingScores.map((score) => score.post_id))

    await upsertPosts(result.posts)

    const mutedPatterns = await db.mutedPatterns
      .where("watcher_id")
      .equals(watcher.id)
      .toArray()

    const candidates = result.posts
      .filter((post) => !alreadyScoredIds.has(post.id))
      .map((post) => ({
        post,
        local: scoreLocalCandidate(post, watcher, mutedPatterns)
      }))
      .filter((candidate) => !candidate.local.skipped)
      .filter((candidate) => candidate.local.score >= LOCAL_SCORE_THRESHOLD)
      .sort((a, b) => b.local.score - a.local.score)
      .slice(0, MAX_CANDIDATES_PER_SCAN)

    await db.posts.bulkPut(
      candidates.map(({ post, local }) => ({
        ...post,
        local_candidate_score: local.score
      }))
    )

    const provider = await getActiveProvider()
    const settings = await getSettings()
    if (!provider) {
      throw new Error("No active AI provider configured")
    }

    const batchSize = Math.min(
      provider.max_batch_size,
      settings.default_ai_batch_size
    )
    const batches = await enqueueAiBatches({
      watcherId: watcher.id,
      providerId: provider.id,
      scanRunId: run.id,
      postIds: candidates.map(({ post }) => post.id),
      batchSize
    })

    const now = nowIso()
    await db.scanRuns.update(run.id, {
      subreddits_checked: watcher.subreddits,
      posts_fetched: result.posts.length,
      new_posts: result.posts.filter((post) => !existingIds.has(post.id)).length,
      existing_posts: result.posts.filter((post) => existingIds.has(post.id))
        .length,
      skipped_posts: result.posts.length - candidates.length,
      local_candidate_posts: candidates.length,
      ai_batches_created: batches.length,
      reddit_rate_limit_info: mergeRateLimitInfo(result.rateLimitInfo),
      queue_status:
        batches.length > 0 ? `${batches.length} batches queued` : "no candidates",
      debug_notes: [
        ...run.debug_notes,
        ...candidates
          .slice(0, 8)
          .map(
            ({ post, local }) =>
              `${post.id}: local ${local.score} (${local.reasons.join("; ")})`
          )
      ]
    })

    await processAiQueue({
      maxBatches: provider.provider_type === "mock" ? batches.length : 1,
      force: provider.provider_type === "mock"
    })

    const completed = await finishScanRun(run.id, "success")
    await logInfo("scanner", "Scan completed", {
      watcher_id: watcher.id,
      scan_run_id: run.id,
      candidates: candidates.length
    })
    return completed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logError("scanner", "Scan failed", {
      watcher_id: watcher.id,
      scan_run_id: run.id,
      error: message
    })

    await db.scanRuns.update(run.id, {
      status: "failed",
      finished_at: nowIso(),
      reddit_errors: [message],
      debug_notes: [...run.debug_notes, message]
    })

    const failed = await db.scanRuns.get(run.id)
    if (!failed) throw error
    return failed
  }
}

async function fetchWatcherPosts(watcher: WatcherRecord): Promise<{
  posts: RedditPostRecord[]
  rateLimitInfo: RateLimitInfo[]
}> {
  const deduped = new Map<string, RedditPostRecord>()
  const rateLimitInfo: RateLimitInfo[] = []

  for (const subreddit of watcher.subreddits) {
    for (const listing of LISTINGS) {
      try {
        await logInfo("reddit", "Subreddit fetch started", {
          watcher_id: watcher.id,
          subreddit,
          listing
        })
        const result = await fetchSubredditListing(subreddit, listing)
        result.posts.forEach((post) => {
          if (!deduped.has(post.id)) deduped.set(post.id, post)
        })
        rateLimitInfo.push(result.rateLimitInfo)

        await logInfo("reddit", "Subreddit fetch completed", {
          watcher_id: watcher.id,
          subreddit,
          listing,
          posts: result.posts.length,
          rate_limit: result.rateLimitInfo
        })

        if (
          typeof result.rateLimitInfo.remaining === "number" &&
          result.rateLimitInfo.remaining <= 2
        ) {
          await logWarning("reddit", "Reddit rate limit running low", {
            subreddit,
            listing,
            rate_limit: result.rateLimitInfo
          })
          break
        }
      } catch (error) {
        await logError("reddit", "Reddit fetch failure", {
          watcher_id: watcher.id,
          subreddit,
          listing,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  return { posts: Array.from(deduped.values()), rateLimitInfo }
}

async function createScanRun(watcher: WatcherRecord): Promise<ScanRunRecord> {
  const now = nowIso()
  const run: ScanRunRecord = {
    id: createId("scan"),
    watcher_id: watcher.id,
    started_at: now,
    status: "running",
    subreddits_checked: [],
    posts_fetched: 0,
    new_posts: 0,
    existing_posts: 0,
    skipped_posts: 0,
    local_candidate_posts: 0,
    ai_batches_created: 0,
    ai_requests_sent: 0,
    ai_requests_failed: 0,
    ai_scored_posts: 0,
    threshold_matches: 0,
    notifications_sent: 0,
    reddit_errors: [],
    ai_errors: [],
    queue_status: "starting",
    debug_notes: []
  }

  await db.scanRuns.add(run)
  return run
}

async function finishScanRun(
  scanRunId: string,
  status: "success" | "partial" | "failed"
): Promise<ScanRunRecord> {
  await db.scanRuns.update(scanRunId, {
    status,
    finished_at: nowIso()
  })

  const run = await db.scanRuns.get(scanRunId)
  if (!run) throw new Error(`Scan run not found after finish: ${scanRunId}`)
  return run
}

async function upsertPosts(posts: RedditPostRecord[]): Promise<void> {
  if (posts.length === 0) return

  const existing = await db.posts.bulkGet(posts.map((post) => post.id))
  const existingById = new Map(
    existing
      .filter((post): post is RedditPostRecord => Boolean(post))
      .map((post) => [post.id, post])
  )

  await db.posts.bulkPut(
    posts.map((post) => ({
      ...existingById.get(post.id),
      ...post,
      local_candidate_score: existingById.get(post.id)?.local_candidate_score
    }))
  )
}

function mergeRateLimitInfo(items: RateLimitInfo[]): RateLimitInfo | undefined {
  if (items.length === 0) return undefined

  return {
    used: maxDefined(items.map((item) => item.used)),
    remaining: minDefined(items.map((item) => item.remaining)),
    reset_seconds: maxDefined(items.map((item) => item.reset_seconds)),
    retry_after_seconds: maxDefined(
      items.map((item) => item.retry_after_seconds)
    ),
    source: "reddit"
  }
}

function maxDefined(values: Array<number | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => value !== undefined)
  return numbers.length ? Math.max(...numbers) : undefined
}

function minDefined(values: Array<number | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => value !== undefined)
  return numbers.length ? Math.min(...numbers) : undefined
}
