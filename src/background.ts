import { initializeDatabase } from "~/db/bootstrap"
import { getAiQueueSummary, processAiQueue } from "~/services/ai/queue/queue"
import { handleNotificationClicked } from "~/services/notifications/notifications"
import { scanEnabledWatchers, scanWatcher } from "~/services/scanner/scanner"

initializeDatabase().catch((error) => {
  console.error("[ThreadWise] database initialization failed", error)
})

chrome.runtime.onInstalled.addListener(() => {
  initializeDatabase().catch((error) => {
    console.error("[ThreadWise] install initialization failed", error)
  })

  chrome.alarms.create("threadwise:scan", {
    delayInMinutes: 1,
    periodInMinutes: 15
  })

  chrome.alarms.create("threadwise:ai-queue", {
    delayInMinutes: 1,
    periodInMinutes: 1
  })
})

chrome.runtime.onStartup.addListener(() => {
  initializeDatabase().catch((error) => {
    console.error("[ThreadWise] startup initialization failed", error)
  })
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

  handleMessage(message as { type: string; watcherId?: string })
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

async function handleMessage(message: { type: string; watcherId?: string }) {
  if (message.type === "THREADWISE_SCAN_NOW") {
    if (message.watcherId) {
      const run = await scanWatcher(message.watcherId)
      return { run }
    }

    const runs = await scanEnabledWatchers()
    return { runs }
  }

  if (message.type === "THREADWISE_QUEUE_STATUS") {
    return { queue: await getAiQueueSummary() }
  }

  throw new Error(`Unknown ThreadWise message: ${message.type}`)
}
