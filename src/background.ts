import { initializeDatabase } from "~/db/bootstrap"

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
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "threadwise:scan") {
    console.info("[ThreadWise] scan alarm triggered")
  }
})
