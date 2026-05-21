import "./style.css"

import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  Bell,
  Clock3,
  Gauge,
  LayoutDashboard,
  Loader2,
  Moon,
  Radar
} from "lucide-react"

import { Button } from "~/components/ui"
import { initializeDatabase } from "~/db/bootstrap"
import { db } from "~/db/schema"
import {
  snoozeNotifications,
  snoozeNotificationsToday
} from "~/services/notifications/notifications"
import { formatRelativeTime } from "~/utils/time"

function Popup() {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    initializeDatabase().catch(console.error)
  }, [])

  const notifications =
    useLiveQuery(
      () => db.notificationHistory.orderBy("created_at").reverse().limit(5).toArray(),
      []
    ) ?? []
  const scanRuns =
    useLiveQuery(() => db.scanRuns.orderBy("started_at").reverse().limit(1).toArray(), []) ??
    []
  const queueItems = useLiveQuery(() => db.aiQueue.toArray(), []) ?? []
  const watchers = useLiveQuery(() => db.watchers.toArray(), []) ?? []
  const settings = useLiveQuery(() => db.settings.get("global"), [])

  const unread = notifications.filter(
    (item) => !item.clicked_at && !item.dismissed_at
  ).length
  const pendingQueue = queueItems.filter((item) =>
    ["pending", "rate_limited"].includes(item.status)
  ).length
  const latestScan = scanRuns[0]
  const enabledWatcher = watchers.find((watcher) => watcher.enabled)
  const latestAlerts = notifications.slice(0, 3)
  const snoozed = useMemo(() => {
    if (!settings?.notification_snoozed_until) return false
    return new Date(settings.notification_snoozed_until).getTime() > Date.now()
  }, [settings?.notification_snoozed_until])

  async function scanNow() {
    setScanning(true)
    setError(undefined)
    try {
      await sendRuntimeMessage({
        type: "THREADWISE_SCAN_NOW",
        watcherId: enabledWatcher?.id
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  return (
    <main className="w-[390px] bg-graphite-950 p-4 text-zinc-100">
      <section className="rounded-lg border border-white/10 bg-graphite-900 p-4 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              ThreadWise
            </p>
            <h1 className="mt-1 text-lg font-semibold">Intelligence Inbox</h1>
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 p-2 text-signal-blue">
            <Radar size={20} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PopupStat icon={<Bell size={16} />} label="Unread" value={unread} />
          <PopupStat
            icon={<Gauge size={16} />}
            label="Scanner"
            value={scanning ? "Scanning" : latestScan?.status ?? "Idle"}
          />
          <PopupStat icon={<Radar size={16} />} label="Queued" value={pendingQueue} />
        </div>

        <div className="mt-4 rounded-md bg-white/[0.035] p-3">
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            <Clock3 size={15} />
            {latestScan
              ? `Last scan ${formatRelativeTime(latestScan.started_at)}: ${latestScan.new_posts} new, ${latestScan.threshold_matches} matched.`
              : "No scan has run yet."}
          </p>
          {pendingQueue > 0 ? (
            <p className="mt-2 text-sm text-signal-amber">
              AI queue: {pendingQueue} batches pending.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-signal-red">{error}</p> : null}
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            disabled={scanning || watchers.length === 0}
            onClick={scanNow}
            variant="primary">
            {scanning ? <Loader2 className="animate-spin" size={16} /> : <Radar size={16} />}
            Scan Now
          </Button>
          <Button onClick={() => chrome.runtime.openOptionsPage()} title="Open Dashboard">
            <LayoutDashboard size={16} />
          </Button>
        </div>

        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={() => snoozeNotifications(1)}>
            <Moon size={15} />
            1h
          </Button>
          <Button className="flex-1" onClick={() => snoozeNotifications(4)}>
            <Moon size={15} />
            4h
          </Button>
          <Button className="flex-1" onClick={snoozeNotificationsToday}>
            Today
          </Button>
        </div>
        {snoozed ? (
          <p className="mt-2 text-xs text-zinc-500">
            Snoozed until{" "}
            {settings?.notification_snoozed_until
              ? new Date(settings.notification_snoozed_until).toLocaleTimeString()
              : ""}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          {latestAlerts.length === 0 ? (
            <p className="rounded-md border border-dashed border-white/15 p-3 text-sm text-zinc-500">
              No alerts yet.
            </p>
          ) : (
            latestAlerts.map((alert) => (
              <button
                className="w-full rounded-md bg-white/[0.035] p-3 text-left hover:bg-white/[0.06]"
                key={alert.id}
                onClick={() => chrome.runtime.openOptionsPage()}
                type="button">
                <p className="line-clamp-2 text-sm font-medium">{alert.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  r/{alert.subreddit} • {alert.relevance} relevance
                </p>
              </button>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function PopupStat(props: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-md bg-white/[0.04] p-3">
      <div className="text-signal-blue">{props.icon}</div>
      <p className="mt-2 truncate text-lg font-semibold">{props.value}</p>
      <p className="text-xs text-zinc-500">{props.label}</p>
    </div>
  )
}

function sendRuntimeMessage(message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? "ThreadWise request failed"))
        return
      }
      resolve(response)
    })
  })
}

export default Popup
