import { getSettings } from "~/db/bootstrap"
import { db } from "~/db/schema"
import type {
  AiScoreRecord,
  NotificationHistoryRecord,
  RedditPostRecord,
  WatcherRecord
} from "~/types/domain"
import { createId } from "~/utils/id"
import { nowIso } from "~/utils/time"

import { logError, logInfo, logWarning } from "~/services/logging/logger"

export async function dispatchNotificationsForScores(
  watcher: WatcherRecord,
  scores: AiScoreRecord[]
): Promise<number> {
  const settings = await getSettings()
  const snoozedUntil = settings.notification_snoozed_until
    ? new Date(settings.notification_snoozed_until).getTime()
    : 0

  if (!settings.global_notifications_enabled || snoozedUntil > Date.now()) {
    return 0
  }
  if (!watcher.notifications_enabled) return 0

  let sent = 0

  for (const score of scores) {
    if (!(await shouldNotify(watcher, score))) continue

    const post = await db.posts.get(score.post_id)
    if (!post) continue

    const history = await createNotificationHistory(watcher, score, post)

    try {
      await createChromeNotification(history, post)
      sent += 1
      await logInfo("notification", "Notification sent", {
        watcher_id: watcher.id,
        post_id: post.id,
        relevance: score.relevance
      })
    } catch (error) {
      await logError("notification", "Notification failed", {
        watcher_id: watcher.id,
        post_id: post.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return sent
}

export async function handleNotificationClicked(
  notificationId: string
): Promise<void> {
  if (!notificationId.startsWith("threadwise:")) return

  const historyId = notificationId.replace("threadwise:", "")
  const history = await db.notificationHistory.get(historyId)
  if (!history) return

  await db.notificationHistory.update(history.id, {
    clicked_at: nowIso()
  })

  const post = await db.posts.get(history.post_id)
  const url = post?.permalink ?? chrome.runtime.getURL("options.html")
  chrome.tabs.create({ url })
}

async function shouldNotify(
  watcher: WatcherRecord,
  score: AiScoreRecord
): Promise<boolean> {
  if (score.ai_failed || !score.notify) return false
  if (
    score.relevance < watcher.relevance_threshold ||
    score.urgency < watcher.urgency_threshold ||
    score.confidence < watcher.confidence_threshold
  ) {
    return false
  }

  const existing = await db.notificationHistory
    .where("[watcher_id+post_id]")
    .equals([watcher.id, score.post_id])
    .first()
  if (existing) return false

  const mutedPatterns = await db.mutedPatterns
    .where("watcher_id")
    .equals(watcher.id)
    .toArray()
  if (mutedPatterns.length === 0) return true

  const post = await db.posts.get(score.post_id)
  const text = `${post?.title ?? ""} ${score.summary} ${
    score.matched_signals.join(" ")
  }`.toLowerCase()

  return !mutedPatterns.some(
    (pattern) =>
      pattern.enabled && text.includes(pattern.pattern.trim().toLowerCase())
  )
}

async function createNotificationHistory(
  watcher: WatcherRecord,
  score: AiScoreRecord,
  post: RedditPostRecord
): Promise<NotificationHistoryRecord> {
  const now = nowIso()
  const history: NotificationHistoryRecord = {
    id: createId("notification"),
    watcher_id: watcher.id,
    post_id: post.id,
    score_id: score.id,
    title: post.title,
    subreddit: post.subreddit,
    reason: score.why_this_matters,
    relevance: score.relevance,
    created_at: now
  }

  await db.notificationHistory.add(history)
  return history
}

function createChromeNotification(
  history: NotificationHistoryRecord,
  post: RedditPostRecord
): Promise<void> {
  const manifestIcons = chrome.runtime.getManifest().icons
  const iconPath = manifestIcons?.["128"] ?? manifestIcons?.["48"] ?? ""
  const iconUrl = iconPath ? chrome.runtime.getURL(iconPath) : ""

  return new Promise((resolve, reject) => {
    chrome.notifications.create(
      `threadwise:${history.id}`,
      {
        type: "basic",
        iconUrl,
        title: truncate(post.title, 80),
        message: `r/${post.subreddit} • ${history.relevance} relevance`,
        contextMessage: truncate(history.reason, 120),
        priority: 1
      },
      () => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve()
      }
    )
  })
}

export async function snoozeNotifications(hours: number): Promise<void> {
  const until = new Date(Date.now() + hours * 3_600_000).toISOString()
  await db.settings.update("global", {
    notification_snoozed_until: until,
    updated_at: nowIso()
  })
  await logWarning("notification", "Notifications snoozed", { until })
}

export async function snoozeNotificationsToday(): Promise<void> {
  const until = new Date()
  until.setHours(23, 59, 59, 999)
  await db.settings.update("global", {
    notification_snoozed_until: until.toISOString(),
    updated_at: nowIso()
  })
  await logWarning("notification", "Notifications snoozed today", {
    until: until.toISOString()
  })
}

export async function clearNotificationSnooze(): Promise<void> {
  await db.settings.update("global", {
    notification_snoozed_until: undefined,
    updated_at: nowIso()
  })
  await logInfo("notification", "Notifications resumed")
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}
