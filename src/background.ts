import { initializeDatabase } from "~/db/bootstrap"
import { processAiQueue } from "~/services/ai/queue/queue"

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
    console.info("[ThreadWise] scan alarm triggered")
  }

  if (alarm.name === "threadwise:ai-queue") {
    processAiQueue({ maxBatches: 1 }).catch((error) => {
      console.error("[ThreadWise] AI queue processing failed", error)
    })
  }
})
