chrome.runtime.onInstalled.addListener(() => {
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
