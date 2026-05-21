import { initializeDatabase } from "~/db/bootstrap"
import { db } from "~/db/schema"
import { getAiQueueSummary, processAiQueue } from "~/services/ai/queue/queue"
import { handleNotificationClicked } from "~/services/notifications/notifications"
import { SCAN_SCHEDULER_POLL_MINUTES } from "~/services/scanner/schedule"
import { scanEnabledWatchers, scanWatcher } from "~/services/scanner/scanner"

initializeDatabase().catch((error) => {
  console.error("[ThreadWise] database initialization failed", error)
})

function scheduleAlarms() {
  chrome.alarms.create("threadwise:scan", {
    delayInMinutes: 1,
    periodInMinutes: SCAN_SCHEDULER_POLL_MINUTES
  })

  chrome.alarms.create("threadwise:ai-queue", {
    delayInMinutes: 1,
    periodInMinutes: 1
  })
}

chrome.runtime.onInstalled.addListener(() => {
  initializeDatabase().catch((error) => {
    console.error("[ThreadWise] install initialization failed", error)
  })

  scheduleAlarms()
})

chrome.runtime.onStartup.addListener(() => {
  initializeDatabase().catch((error) => {
    console.error("[ThreadWise] startup initialization failed", error)
  })
  scheduleAlarms()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "threadwise:scan") {
    scanEnabledWatchers()
      .then(() => processAiQueue({ maxBatches: 1 }))
      .catch((error) => {
        console.error("[ThreadWise] scan alarm failed", error)
      })
  }

  if (alarm.name === "threadwise:ai-queue") {
    processAiQueue({ maxBatches: 1 }).catch((error) => {
      console.error("[ThreadWise] AI queue processing failed", error)
    })
  }
})

chrome.notifications.onClicked.addListener((notificationId) => {
  handleNotificationClicked(notificationId).catch((error) => {
    console.error("[ThreadWise] notification click failed", error)
  })
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object" || !("type" in message)) {
    return false
  }

  handleMessage(message as ThreadWiseRuntimeMessage)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) => {
      console.error("[ThreadWise] message failed", error)
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    })

  return true
})

interface ThreadWiseRuntimeMessage {
  type: string
  watcherId?: string
  redditIds?: string[]
}

async function handleMessage(message: ThreadWiseRuntimeMessage) {
  if (message.type === "THREADWISE_SCAN_NOW") {
    if (message.watcherId) {
      const run = await scanWatcher(message.watcherId)
      return { run }
    }

    const runs = await scanEnabledWatchers({ force: true })
    return { runs }
  }

  if (message.type === "THREADWISE_QUEUE_STATUS") {
    return { queue: await getAiQueueSummary() }
  }

  if (message.type === "THREADWISE_GET_BADGES") {
    return { badges: await getBadgesForRedditIds(message.redditIds ?? []) }
  }

  throw new Error(`Unknown ThreadWise message: ${message.type}`)
}

async function getBadgesForRedditIds(redditIds: string[] = []) {
  const postIds = Array.from(new Set(redditIds.map((id) => `reddit_${id}`)))
  if (postIds.length === 0) return {}

  const scores = await db.aiScores.where("post_id").anyOf(postIds).toArray()
  const watchers = await db.watchers.bulkGet(
    Array.from(new Set(scores.map((score) => score.watcher_id)))
  )
  const watcherById = new Map(
    watchers.filter((watcher): watcher is NonNullable<typeof watcher> => Boolean(watcher)).map((watcher) => [watcher.id, watcher])
  )

  return scores.reduce<
    Record<
      string,
      {
        relevance: number
        confidence: number
        summary: string
        why: string
        watcherName: string
        matchedSignals: string[]
        isHiddenGem: boolean
      }
    >
  >((acc, score) => {
    const redditId = score.post_id.replace(/^reddit_/, "")
    const existing = acc[redditId]
    if (existing && existing.relevance >= score.relevance) return acc

    acc[redditId] = {
      relevance: score.relevance,
      confidence: score.confidence,
      summary: score.summary,
      why: score.why_this_matters,
      watcherName: watcherById.get(score.watcher_id)?.name ?? "ThreadWise",
      matchedSignals: score.matched_signals,
      isHiddenGem: score.is_hidden_gem
    }
    return acc
  }, {})
}
