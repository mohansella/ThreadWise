import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  Bell,
  Bookmark,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Inbox,
  Loader2,
  Plus,
  Radar,
  Save,
  Settings,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap
} from "lucide-react"

import {
  Button,
  EmptyState,
  Field,
  Panel,
  ScorePill,
  SelectInput,
  TextArea,
  TextInput,
  Toggle
} from "~/components/ui"
import {
  DEFAULT_SETTINGS_ID,
  createWatcherFromTemplate,
  getSettings,
  initializeDatabase,
  normalizeSubreddits
} from "~/db/bootstrap"
import { db } from "~/db/schema"
import { PROVIDER_PRESETS, WATCHER_TEMPLATES } from "~/db/templates"
import { createAiProvider } from "~/services/ai/providers"
import { scanWatcher } from "~/services/scanner/scanner"
import {
  buildMutedPatternsForThread,
  muteSimilar,
  recordThreadFeedback,
  unmuteSimilar
} from "~/services/learning/feedback"
import {
  clearNotificationSnooze,
  dismissNotification,
  dismissReadNotifications,
  markNotificationRead,
  markNotificationsRead,
  snoozeNotifications,
  snoozeNotificationsToday
} from "~/services/notifications/notifications"
import {
  MIN_SCAN_INTERVAL_MINUTES,
  normalizeScanIntervalMinutes
} from "~/services/scanner/schedule"
import type {
  AiProviderRecord,
  AiQueueRecord,
  AiScoreRecord,
  FeedbackRecord,
  MutedPatternRecord,
  NegativeFeedbackReason,
  NotificationHistoryRecord,
  ProviderType,
  RedditPostRecord,
  ScanRunRecord,
  SettingsRecord,
  WatcherRecord,
  WatcherTemplateType
} from "~/types/domain"
import { createId } from "~/utils/id"
import { encodeLocalSecret, maskSecret } from "~/utils/secrets"
import { formatRelativeTime, nowIso } from "~/utils/time"

type DashboardTab =
  | "Inbox"
  | "Hidden Gems"
  | "Urgent"
  | "Saved"
  | "History"
  | "Scan Activity"
  | "Settings"

interface ThreadItem {
  score: AiScoreRecord
  post: RedditPostRecord
  watcher: WatcherRecord
  feedback: FeedbackRecord | undefined
  mutedPatterns: MutedPatternRecord[]
}

const tabs: Array<{ label: DashboardTab; icon: typeof Inbox }> = [
  { label: "Inbox", icon: Inbox },
  { label: "Hidden Gems", icon: Sparkles },
  { label: "Urgent", icon: Zap },
  { label: "Saved", icon: Bookmark },
  { label: "History", icon: History },
  { label: "Scan Activity", icon: Radar },
  { label: "Settings", icon: Settings }
]

const dashboardTabRoutes: Record<DashboardTab, string> = {
  Inbox: "inbox",
  "Hidden Gems": "hidden-gems",
  Urgent: "urgent",
  Saved: "saved",
  History: "history",
  "Scan Activity": "scan-activity",
  Settings: "settings"
}

const dashboardTabByRoute = new Map(
  Object.entries(dashboardTabRoutes).map(([tab, route]) => [
    route,
    tab as DashboardTab
  ])
)

const negativeReasons: Array<{ value: NegativeFeedbackReason; label: string }> = [
  { value: "too_beginner", label: "Too beginner" },
  { value: "too_promotional", label: "Too promotional" },
  { value: "wrong_topic", label: "Wrong topic" },
  { value: "not_actionable", label: "Not actionable" },
  { value: "low_quality", label: "Low quality" },
  { value: "already_known", label: "Already known" },
  { value: "too_political", label: "Too political" },
  { value: "rage_bait", label: "Rage bait" },
  { value: "other", label: "Other" }
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>(readDashboardTabRoute)
  const [selectedWatcherId, setSelectedWatcherId] = useState<string>()
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    initializeDatabase().catch(console.error)
  }, [])

  useEffect(() => {
    function syncTabFromRoute() {
      setActiveTab(readDashboardTabRoute())
    }

    window.addEventListener("hashchange", syncTabFromRoute)
    return () => window.removeEventListener("hashchange", syncTabFromRoute)
  }, [])

  const settings = useLiveQuery(() => db.settings.get(DEFAULT_SETTINGS_ID), [])
  const providers = useLiveQuery(() => db.aiProviders.toArray(), []) ?? []
  const watchers =
    useLiveQuery(
      async () =>
        (await db.watchers.toArray()).sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        ),
      []
    ) ?? []
  const posts = useLiveQuery(() => db.posts.toArray(), []) ?? []
  const scores =
    useLiveQuery(() => db.aiScores.orderBy("created_at").reverse().toArray(), []) ??
    []
  const feedback = useLiveQuery(() => db.feedback.toArray(), []) ?? []
  const mutedPatterns = useLiveQuery(() => db.mutedPatterns.toArray(), []) ?? []
  const scanRuns =
    useLiveQuery(() => db.scanRuns.orderBy("started_at").reverse().toArray(), []) ??
    []
  const queueItems = useLiveQuery(() => db.aiQueue.toArray(), []) ?? []
  const logs =
    useLiveQuery(() => db.logs.orderBy("timestamp").reverse().limit(250).toArray(), []) ??
    []
  const notificationHistory =
    useLiveQuery(
      () => db.notificationHistory.orderBy("created_at").reverse().toArray(),
      []
    ) ?? []

  useEffect(() => {
    if (!selectedWatcherId && watchers[0]) {
      setSelectedWatcherId(watchers[0].id)
    }
  }, [selectedWatcherId, watchers])

  const activeProvider = providers.find(
    (provider) => provider.id === settings?.active_provider_id
  )
  const selectedWatcher = watchers.find(
    (watcher) => watcher.id === selectedWatcherId
  )
  const threadItems = useThreadItems({
    scores,
    posts,
    watchers,
    feedback,
    mutedPatterns,
    selectedWatcherId,
    activeTab
  })
  const lastScan = scanRuns[0]
  const queueSummary = summarizeQueue(queueItems)

  async function handleScanNow() {
    const watcher = selectedWatcher ?? watchers.find((item) => item.enabled) ?? watchers[0]
    if (!watcher) return

    setScanning(true)
    try {
      await scanWatcher(watcher.id)
      changeTab("Scan Activity")
    } finally {
      setScanning(false)
    }
  }

  function changeTab(tab: DashboardTab) {
    setActiveTab(tab)
    writeDashboardTabRoute(tab)
  }

  return (
    <main className="min-h-screen bg-graphite-950 text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 border-r border-white/10 bg-graphite-900 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-zinc-100 p-2 text-graphite-950">
              <Radar size={19} />
            </div>
            <div>
              <p className="text-sm font-semibold">ThreadWise</p>
              <p className="text-xs text-zinc-500">Local intelligence</p>
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => changeTab("Settings")}
            variant="primary">
            <Plus size={16} />
            Create Watcher
          </Button>

          <div className="mt-6">
            <p className="px-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Watchers
            </p>
            <div className="mt-3 space-y-2">
              {watchers.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/15 p-4 text-sm leading-6 text-zinc-500">
                  Add a watcher to start scanning Reddit.
                </div>
              ) : null}
              {watchers.map((watcher) => (
                <button
                  className={`w-full rounded-md border px-3 py-3 text-left text-sm transition ${
                    watcher.id === selectedWatcherId
                      ? "border-signal-blue/50 bg-signal-blue/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                  key={watcher.id}
                  onClick={() => setSelectedWatcherId(watcher.id)}
                  type="button">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100">{watcher.name}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        watcher.enabled ? "bg-signal-green" : "bg-zinc-600"
                      }`}
                    />
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">
                    {watcher.subreddits.map((subreddit) => `r/${subreddit}`).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-graphite-950/95 px-8 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Intelligence Inbox
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  High-signal Reddit threads, filtered by intent.
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  {lastScan
                    ? `Last scan: ${lastScan.posts_fetched} posts checked, ${lastScan.new_posts} new, ${lastScan.threshold_matches} matched, ${lastScan.notifications_sent} notified.`
                    : "Last scan: none yet."}
                </p>
                {queueSummary.pending > 0 ? (
                  <p className="mt-1 text-sm text-signal-amber">
                    AI queue: {queueSummary.pending} batches pending
                    {queueSummary.nextRunAt
                      ? `, next request ${formatFuture(queueSummary.nextRunAt)}`
                      : ""}
                    .
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!watchers.length || scanning}
                  onClick={handleScanNow}
                  variant="primary">
                  {scanning ? <Loader2 className="animate-spin" size={16} /> : <Radar size={16} />}
                  Scan Now
                </Button>
              </div>
            </div>
          </header>

          <nav className="flex flex-wrap gap-1 border-b border-white/10 px-8 py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    activeTab === tab.label
                      ? "bg-white/[0.08] text-zinc-100"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`}
                  key={tab.label}
                  onClick={() => changeTab(tab.label)}
                  type="button">
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="tw-scrollbar flex-1 overflow-auto px-8 py-6">
            {!settings || !activeProvider ? (
              <EmptyState
                body="ThreadWise is preparing local storage."
                title="Starting up"
              />
            ) : activeTab === "Scan Activity" ? (
              <ScanActivity runs={scanRuns} queueItems={queueItems} />
            ) : activeTab === "Settings" ? (
              <SettingsView
                activeProvider={activeProvider}
                logs={logs}
                notificationHistory={notificationHistory}
                providers={providers}
                selectedWatcher={selectedWatcher}
                settings={settings}
                watchers={watchers}
                onWatcherCreated={(watcher) => {
                  setSelectedWatcherId(watcher.id)
                  changeTab("Inbox")
                }}
              />
            ) : (
              <ThreadList
                activeTab={activeTab}
                items={threadItems}
                notificationHistory={notificationHistory}
                posts={posts}
                selectedWatcher={selectedWatcher}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function useThreadItems(input: {
  scores: AiScoreRecord[]
  posts: RedditPostRecord[]
  watchers: WatcherRecord[]
  feedback: FeedbackRecord[]
  mutedPatterns: MutedPatternRecord[]
  selectedWatcherId?: string
  activeTab: DashboardTab
}): ThreadItem[] {
  return useMemo(() => {
    const postById = new Map(input.posts.map((post) => [post.id, post]))
    const watcherById = new Map(input.watchers.map((watcher) => [watcher.id, watcher]))
    const feedbackByPost = new Map<string, FeedbackRecord>()

    for (const item of input.feedback) {
      const key = `${item.watcher_id}:${item.post_id}`
      const existing = feedbackByPost.get(key)
      if (!existing || item.created_at.localeCompare(existing.created_at) > 0) {
        feedbackByPost.set(key, item)
      }
    }

    return input.scores
      .filter(
        (score) =>
          !input.selectedWatcherId || score.watcher_id === input.selectedWatcherId
      )
      .map((score) => {
        const post = postById.get(score.post_id)
        const watcher = watcherById.get(score.watcher_id)
        if (!post || !watcher) return undefined
        const mutePatterns = buildMutedPatternsForThread(score, post)
        const mutedPatterns = input.mutedPatterns.filter(
          (pattern) =>
            pattern.watcher_id === watcher.id &&
            pattern.enabled &&
            mutePatterns.some(
              (value) =>
                value.trim().toLowerCase() ===
                pattern.pattern.trim().toLowerCase()
            )
        )

        return {
          score,
          post,
          watcher,
          feedback: feedbackByPost.get(`${score.watcher_id}:${score.post_id}`),
          mutedPatterns
        }
      })
      .filter((item): item is ThreadItem => Boolean(item))
      .filter((item) => filterThreadItem(item, input.activeTab))
  }, [input])
}

function filterThreadItem(item: ThreadItem, activeTab: DashboardTab): boolean {
  if (activeTab === "Inbox") {
    return (
      item.score.notify ||
      (item.score.relevance >= item.watcher.relevance_threshold &&
        item.score.confidence >= item.watcher.confidence_threshold)
    )
  }
  if (activeTab === "Hidden Gems") return item.score.is_hidden_gem
  if (activeTab === "Urgent") return item.score.urgency >= 70
  if (activeTab === "Saved") return item.feedback?.sentiment === "saved"
  if (activeTab === "History") return true
  return false
}

function ThreadList(props: {
  activeTab: DashboardTab
  items: ThreadItem[]
  notificationHistory: NotificationHistoryRecord[]
  posts: RedditPostRecord[]
  selectedWatcher?: WatcherRecord
}) {
  if (!props.selectedWatcher) {
    return (
      <EmptyState
        body="Create a watcher in Settings, test it on current Reddit posts, then enable periodic scans."
        title="No watcher selected"
      />
    )
  }

  const alertInbox =
    props.activeTab === "Inbox" ? (
      <NotificationInbox
        history={props.notificationHistory}
        posts={props.posts}
        watcher={props.selectedWatcher}
      />
    ) : null

  if (props.items.length === 0) {
    return (
      <div className="space-y-4">
        {alertInbox}
        <EmptyState
          body="Run a scan or lower the thresholds if you want broader coverage."
          title={`No ${props.activeTab.toLowerCase()} threads yet`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {alertInbox}
      {props.items.map((item) => (
        <ThreadCard item={item} key={item.score.id} />
      ))}
    </div>
  )
}

function NotificationInbox(props: {
  history: NotificationHistoryRecord[]
  posts: RedditPostRecord[]
  watcher: WatcherRecord
}) {
  const postById = useMemo(
    () => new Map(props.posts.map((post) => [post.id, post])),
    [props.posts]
  )
  const alerts = useMemo(() => {
    const active = props.history
      .filter((item) => item.watcher_id === props.watcher.id)
      .filter((item) => !item.dismissed_at)

    return [
      ...active.filter((item) => !item.clicked_at),
      ...active.filter((item) => item.clicked_at)
    ].slice(0, 10)
  }, [props.history, props.watcher.id])

  const unreadAlerts = alerts.filter((item) => !item.clicked_at)
  const readAlerts = alerts.filter((item) => item.clicked_at)

  async function openAlert(alert: NotificationHistoryRecord) {
    await markNotificationRead(alert.id)
    const post = postById.get(alert.post_id)
    chrome.tabs.create({
      url: post?.permalink ?? chrome.runtime.getURL("options.html#inbox")
    })
  }

  if (alerts.length === 0) return null

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Alert Inbox</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {unreadAlerts.length} unread, {readAlerts.length} read
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadAlerts.length > 0 ? (
            <Button
              onClick={() =>
                markNotificationsRead(unreadAlerts.map((alert) => alert.id))
              }>
              <CheckCircle2 size={15} />
              Mark All Read
            </Button>
          ) : null}
          {readAlerts.length > 0 ? (
            <Button
              onClick={() => dismissReadNotifications(props.watcher.id)}
              variant="danger">
              <X size={15} />
              Dismiss Read
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {alerts.map((alert) => {
          const unread = !alert.clicked_at

          return (
            <div
              className={`rounded-md border p-3 ${
                unread
                  ? "border-signal-blue/40 bg-signal-blue/10"
                  : "border-white/10 bg-white/[0.035]"
              }`}
              key={alert.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${
                        unread
                          ? "bg-signal-blue/15 text-signal-blue"
                          : "bg-white/[0.05] text-zinc-500"
                      }`}>
                      {unread ? "Unread" : "Read"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      r/{alert.subreddit} • {alert.relevance} relevance •{" "}
                      {formatRelativeTime(alert.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-zinc-100">
                    {alert.title}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">
                    {alert.reason}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openAlert(alert)}>
                    <ExternalLink size={15} />
                    Open
                  </Button>
                  {unread ? (
                    <Button onClick={() => markNotificationRead(alert.id)}>
                      <CheckCircle2 size={15} />
                      Mark Read
                    </Button>
                  ) : (
                    <Button
                      onClick={() => dismissNotification(alert.id)}
                      variant="danger">
                      <X size={15} />
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function ThreadCard({ item }: { item: ThreadItem }) {
  const [reason, setReason] =
    useState<NegativeFeedbackReason>("not_actionable")
  const [busy, setBusy] = useState<string>()
  const [notice, setNotice] = useState<{
    tone: "success" | "error"
    message: string
  }>()
  const sentiment = item.feedback?.sentiment
  const muted = item.mutedPatterns.length > 0

  async function withBusy(
    label: string,
    successMessage: string,
    action: () => Promise<void>
  ) {
    setBusy(label)
    setNotice(undefined)
    try {
      await action()
      setNotice({ tone: "success", message: successMessage })
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-zinc-400">
              r/{item.post.subreddit}
            </span>
            <span className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-zinc-400">
              {item.score.category}
            </span>
            {item.score.is_hidden_gem ? (
              <span className="rounded-md bg-signal-green/10 px-2 py-1 text-xs text-signal-green">
                Hidden Gem
              </span>
            ) : null}
            {item.score.confidence < 60 ? (
              <span className="rounded-md bg-signal-amber/10 px-2 py-1 text-xs text-signal-amber">
                Low Confidence
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-semibold leading-7">{item.post.title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{item.score.summary}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            {item.score.why_this_matters}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 sm:w-[300px]">
          <ScorePill label="Relevance" tone="green" value={item.score.relevance} />
          <ScorePill label="Urgency" tone="amber" value={item.score.urgency} />
          <ScorePill label="Confidence" value={item.score.confidence} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <SignalList label="Matched signals" values={item.score.matched_signals} />
        <SignalList label="Negative signals" values={item.score.negative_signals} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          disabled={Boolean(busy)}
          onClick={() =>
            withBusy(
              "relevant",
              "Marked as relevant",
              () =>
                recordThreadFeedback({
                  watcherId: item.watcher.id,
                  postId: item.post.id,
                  sentiment: "relevant"
                })
            )
          }
          variant={sentiment === "relevant" ? "primary" : "secondary"}>
          {busy === "relevant" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <ThumbsUp size={15} />
          )}
          {sentiment === "relevant" ? "Relevant" : "Relevant"}
        </Button>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-white/10 bg-graphite-950 px-3 py-2 text-sm text-zinc-100"
            onChange={(event) =>
              setReason(event.currentTarget.value as NegativeFeedbackReason)
            }
            value={reason}>
            {negativeReasons.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            disabled={Boolean(busy)}
            onClick={() =>
              withBusy(
                "not_relevant",
                "Marked as not relevant",
                () =>
                  recordThreadFeedback({
                    watcherId: item.watcher.id,
                    postId: item.post.id,
                    sentiment: "not_relevant",
                    reason
                  })
              )
            }
            variant={sentiment === "not_relevant" ? "danger" : "secondary"}>
            {busy === "not_relevant" ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <ThumbsDown size={15} />
            )}
            Not Relevant
          </Button>
        </div>
        <Button
          disabled={Boolean(busy)}
          onClick={() =>
            withBusy(
              "saved",
              "Saved",
              () =>
                recordThreadFeedback({
                  watcherId: item.watcher.id,
                  postId: item.post.id,
                  sentiment: "saved"
                })
            )
          }
          variant={sentiment === "saved" ? "primary" : "secondary"}>
          {busy === "saved" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <Save size={15} />
          )}
          {sentiment === "saved" ? "Saved" : "Save"}
        </Button>
        <Button onClick={() => chrome.tabs.create({ url: item.post.permalink })}>
          <ExternalLink size={15} />
          Open Reddit
        </Button>
        <Button
          disabled={Boolean(busy)}
          onClick={() =>
            withBusy(
              muted ? "unmute" : "mute",
              muted ? "Similar threads unmuted" : "Similar threads muted",
              () =>
                muted
                  ? unmuteSimilar({
                      watcherId: item.watcher.id,
                      postId: item.post.id
                    })
                  : muteSimilar({
                      watcherId: item.watcher.id,
                      postId: item.post.id
                    })
            )
          }
          variant={muted ? "primary" : "secondary"}>
          {busy === "mute" || busy === "unmute" ? (
            <Loader2 className="animate-spin" size={15} />
          ) : muted ? (
            <Eye size={15} />
          ) : (
            <EyeOff size={15} />
          )}
          {muted ? "Unmute Similar" : "Mute Similar"}
        </Button>
      </div>
      {notice ? (
        <p
          className={`mt-3 text-sm ${
            notice.tone === "success" ? "text-signal-green" : "text-signal-red"
          }`}>
          {notice.message}
        </p>
      ) : null}
    </Panel>
  )
}

function SignalList(props: { label: string; values: string[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.025] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
        {props.label}
      </p>
      {props.values.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {props.values.map((value) => (
            <span
              className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-zinc-300"
              key={value}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-600">None</p>
      )}
    </div>
  )
}

function ScanActivity(props: {
  runs: ScanRunRecord[]
  queueItems: AiQueueRecord[]
}) {
  const summary = summarizeQueue(props.queueItems)

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <ScorePill label="Pending" tone="amber" value={summary.pending} />
          <ScorePill label="Running" value={summary.running} />
          <ScorePill label="Failed" tone="red" value={summary.failed} />
          <ScorePill
            label="Completed"
            tone="green"
            value={props.queueItems.filter((item) => item.status === "completed").length}
          />
        </div>
      </Panel>

      {props.runs.length === 0 ? (
        <EmptyState
          body="Run a watcher scan to see fetched posts, skipped posts, queue activity, API errors, and notification counts."
          title="No scan runs yet"
        />
      ) : (
        props.runs.map((run) => (
          <Panel className="p-5" key={run.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {run.status} • {formatRelativeTime(run.started_at)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {run.subreddits_checked.map((subreddit) => `r/${subreddit}`).join(", ") ||
                    "No subreddits checked"}
                </p>
              </div>
              <span className="rounded-md bg-white/[0.05] px-2 py-1 text-xs text-zinc-400">
                {run.queue_status}
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
              <MiniStat label="Fetched" value={run.posts_fetched} />
              <MiniStat label="New" value={run.new_posts} />
              <MiniStat label="Existing" value={run.existing_posts} />
              <MiniStat label="Skipped" value={run.skipped_posts} />
              <MiniStat label="Candidates" value={run.local_candidate_posts} />
              <MiniStat label="Batches" value={run.ai_batches_created} />
              <MiniStat label="Scored" value={run.ai_scored_posts} />
              <MiniStat label="Notified" value={run.notifications_sent} />
            </div>
            {run.debug_notes.length || run.reddit_errors.length || run.ai_errors.length ? (
              <div className="mt-4 rounded-md bg-graphite-950 p-3 text-xs leading-5 text-zinc-500">
                {[...run.debug_notes, ...run.reddit_errors, ...run.ai_errors]
                  .slice(0, 12)
                  .map((note) => (
                    <p key={note}>{note}</p>
                  ))}
              </div>
            ) : null}
          </Panel>
        ))
      )}
    </div>
  )
}

function MiniStat(props: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.035] px-3 py-2">
      <p className="text-xs text-zinc-500">{props.label}</p>
      <p className="mt-1 font-semibold">{props.value}</p>
    </div>
  )
}

function SettingsView(props: {
  settings: SettingsRecord
  providers: AiProviderRecord[]
  activeProvider: AiProviderRecord
  watchers: WatcherRecord[]
  selectedWatcher?: WatcherRecord
  logs: Array<{ id: string; timestamp: string; level: string; source: string; message: string; metadata?: unknown }>
  notificationHistory: Array<{
    id: string
    title: string
    subreddit: string
    relevance: number
    reason: string
    created_at: string
  }>
  onWatcherCreated: (watcher: WatcherRecord) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <ProviderSettings provider={props.activeProvider} />
        <WatcherCreator onCreated={props.onWatcherCreated} />
        {props.selectedWatcher ? (
          <WatcherSettings watcher={props.selectedWatcher} />
        ) : null}
      </div>
      <div className="space-y-4">
        <OnboardingPanel
          provider={props.activeProvider}
          watchers={props.watchers}
        />
        <NotificationSettings
          history={props.notificationHistory}
          settings={props.settings}
        />
        <DebugLogs logs={props.logs} settings={props.settings} />
      </div>
    </div>
  )
}

function OnboardingPanel(props: {
  provider: AiProviderRecord
  watchers: WatcherRecord[]
}) {
  const hasProvider = isProviderConfigured(props.provider)

  return (
    <Panel className="p-5">
      <h2 className="font-semibold">Setup Status</h2>
      <div className="mt-4 space-y-2">
        <SetupStatusItem
          done={hasProvider}
          label="AI provider"
          status={hasProvider ? "Configured" : "Needs provider"}
        />
        <SetupStatusItem
          done={props.watchers.length > 0}
          label="Watcher"
          status={props.watchers.length > 0 ? "Created" : "Not created"}
        />
        <SetupStatusItem
          label="Thresholds"
          done={props.watchers.some((watcher) => watcher.relevance_threshold > 0)}
          status={
            props.watchers.some((watcher) => watcher.relevance_threshold > 0)
              ? "Set"
              : "Not set"
          }
        />
        <SetupStatusItem
          label="Enabled"
          done={props.watchers.some((watcher) => watcher.enabled)}
          status={
            props.watchers.some((watcher) => watcher.enabled)
              ? "Scanning"
              : "Paused"
          }
        />
      </div>
    </Panel>
  )
}

function SetupStatusItem(props: {
  label: string
  done: boolean
  status: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-white/[0.035] px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            props.done ? "bg-signal-green" : "bg-zinc-600"
          }`}
        />
        <span className="text-zinc-200">{props.label}</span>
      </span>
      <span
        className={`rounded-md px-2 py-1 text-xs ${
          props.done
            ? "bg-signal-green/10 text-signal-green"
            : "bg-white/[0.05] text-zinc-500"
        }`}>
        {props.status}
      </span>
    </div>
  )
}

function ProviderSettings({ provider }: { provider: AiProviderRecord }) {
  const configured = isProviderConfigured(provider)
  const [expanded, setExpanded] = useState(!configured)
  const [providerType, setProviderType] = useState<ProviderType>(provider.provider_type)
  const [displayName, setDisplayName] = useState(provider.display_name)
  const [baseUrl, setBaseUrl] = useState(provider.base_url)
  const [model, setModel] = useState(provider.model)
  const [apiKey, setApiKey] = useState("")
  const [rpm, setRpm] = useState(String(provider.requests_per_minute))
  const [batchSize, setBatchSize] = useState<"3" | "5" | "10">(
    String(provider.max_batch_size) as "3" | "5" | "10"
  )
  const [status, setStatus] = useState<string>()
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setProviderType(provider.provider_type)
    setDisplayName(provider.display_name)
    setBaseUrl(provider.base_url)
    setModel(provider.model)
    setRpm(String(provider.requests_per_minute))
    setBatchSize(String(provider.max_batch_size) as "3" | "5" | "10")
    setExpanded(!isProviderConfigured(provider))
  }, [provider])

  function applyPreset(type: ProviderType) {
    setProviderType(type)
    const preset = PROVIDER_PRESETS.find((item) => item.provider_type === type)
    if (preset) {
      setDisplayName(preset.display_name)
      setBaseUrl(preset.base_url)
      setModel(preset.model)
      setRpm(String(preset.requests_per_minute))
      setBatchSize(String(preset.max_batch_size) as "3" | "5" | "10")
    }
    if (type === "mock") {
      setDisplayName("Mock provider")
      setBaseUrl("mock://local")
      setModel("threadwise-mock")
      setRpm("60")
      setBatchSize("5")
    }
  }

  async function buildRecord(): Promise<AiProviderRecord> {
    const now = nowIso()
    const providerId =
      provider.provider_type === "mock" && providerType !== "mock"
        ? createId("provider")
        : provider.id

    return {
      id: providerType === "mock" ? "provider_mock" : providerId,
      provider_type: providerType,
      display_name: displayName.trim() || "Custom provider",
      base_url: baseUrl.trim(),
      api_key_encrypted_or_local: apiKey.trim()
        ? encodeLocalSecret(apiKey)
        : provider.api_key_encrypted_or_local,
      model: model.trim(),
      enabled: true,
      requests_per_minute: Math.max(1, Number(rpm) || 6),
      max_batch_size: Number(batchSize) as 3 | 5 | 10,
      created_at: provider.created_at ?? now,
      updated_at: now
    }
  }

  async function saveProvider() {
    const record = await buildRecord()
    await requestProviderPermission(record.base_url)
    await db.aiProviders.put(record)
    await db.settings.update(DEFAULT_SETTINGS_ID, {
      active_provider_id: record.id,
      updated_at: nowIso()
    })
    setApiKey("")
    setStatus("Provider saved")
    setExpanded(!isProviderConfigured(record))
  }

  async function testProvider() {
    setTesting(true)
    setStatus(undefined)
    try {
      const record = await buildRecord()
      await requestProviderPermission(record.base_url)
      const ok = await createAiProvider(record).validateConfig(record)
      setStatus(ok ? "Connection test passed" : "Connection test failed")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  if (!expanded) {
    return (
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">AI Provider</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {provider.display_name} • {provider.model}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Shared across all watchers • Saved key:{" "}
              {maskSecret(provider.api_key_encrypted_or_local)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button disabled={testing} onClick={testProvider}>
              {testing ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Bug size={15} />
              )}
              Test
            </Button>
            <Button onClick={() => setExpanded(true)}>
              <ChevronDown size={15} />
              Edit
            </Button>
          </div>
        </div>
        {status ? <p className="mt-3 text-sm text-zinc-400">{status}</p> : null}
      </Panel>
    )
  }

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">AI Provider</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Saved key: {maskSecret(provider.api_key_encrypted_or_local)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={testing} onClick={testProvider}>
            {testing ? <Loader2 className="animate-spin" size={15} /> : <Bug size={15} />}
            Test
          </Button>
          {configured ? (
            <Button onClick={() => setExpanded(false)}>
              <ChevronRight size={15} />
              Collapse
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Provider type">
          <SelectInput onChange={applyPreset} value={providerType}>
            <option value="mock">Mock provider</option>
            {PROVIDER_PRESETS.map((preset) => (
              <option key={preset.provider_type} value={preset.provider_type}>
                {preset.display_name}
              </option>
            ))}
            <option value="custom">Custom OpenAI-compatible</option>
          </SelectInput>
        </Field>
        <Field label="Display name">
          <TextInput onChange={setDisplayName} value={displayName} />
        </Field>
        <Field label="Base URL">
          <TextInput onChange={setBaseUrl} value={baseUrl} />
        </Field>
        <Field label="Model">
          <TextInput onChange={setModel} value={model} />
        </Field>
        <Field label="API key" hint="Full keys are masked after saving.">
          <TextInput
            onChange={setApiKey}
            placeholder="Paste a key to replace the saved value"
            type="password"
            value={apiKey}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Requests/min">
            <TextInput onChange={setRpm} type="number" value={rpm} />
          </Field>
          <Field label="Batch size">
            <SelectInput onChange={setBatchSize} value={batchSize}>
              <option value="3">3 posts</option>
              <option value="5">5 posts</option>
              <option value="10">10 posts</option>
            </SelectInput>
          </Field>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={saveProvider} variant="primary">
          <Save size={15} />
          Save Provider
        </Button>
        {status ? <p className="text-sm text-zinc-400">{status}</p> : null}
      </div>
    </Panel>
  )
}

function WatcherCreator(props: { onCreated: (watcher: WatcherRecord) => void }) {
  const [templateType, setTemplateType] =
    useState<WatcherTemplateType>("startup_pain_finder")
  const template = WATCHER_TEMPLATES.find((item) => item.type === templateType)
  const [name, setName] = useState(template?.name ?? "")
  const [subreddits, setSubreddits] = useState(
    template?.suggestedSubreddits.join(", ") ?? ""
  )
  const [intent, setIntent] = useState("")
  const [creating, setCreating] = useState(false)

  function applyTemplate(type: WatcherTemplateType) {
    setTemplateType(type)
    const next = WATCHER_TEMPLATES.find((item) => item.type === type)
    setName(next?.name ?? "Custom Watcher")
    setSubreddits(next?.suggestedSubreddits.join(", ") ?? "")
  }

  async function createWatcher(test = false) {
    setCreating(true)
    try {
      const watcher = await createWatcherFromTemplate({
        templateType,
        name,
        userPrompt: intent,
        subreddits: normalizeSubreddits(subreddits.split(/[,\n]/)),
        enabled: false
      })
      await db.settings.update(DEFAULT_SETTINGS_ID, {
        onboarding_completed: true,
        updated_at: nowIso()
      })
      props.onCreated(watcher)
      if (test) await scanWatcher(watcher.id)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Panel className="p-5">
      <h2 className="font-semibold">Create Watcher</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Template">
          <SelectInput onChange={applyTemplate} value={templateType}>
            {WATCHER_TEMPLATES.map((item) => (
              <option key={item.type} value={item.type}>
                {item.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Name">
          <TextInput onChange={setName} value={name} />
        </Field>
        <Field className="md:col-span-2" label="Subreddits">
          <TextInput
            onChange={setSubreddits}
            placeholder="SaaS, startups, Entrepreneur"
            value={subreddits}
          />
        </Field>
        <Field className="md:col-span-2" label="Custom intent">
          <TextArea
            onChange={setIntent}
            placeholder="Optional: describe the specific signal you care about."
            rows={3}
            value={intent}
          />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button disabled={creating} onClick={() => createWatcher(false)}>
          <Plus size={15} />
          Create
        </Button>
        <Button
          disabled={creating}
          onClick={() => createWatcher(true)}
          variant="primary">
          {creating ? <Loader2 className="animate-spin" size={15} /> : <Radar size={15} />}
          Create and Test
        </Button>
      </div>
    </Panel>
  )
}

function WatcherSettings({ watcher }: { watcher: WatcherRecord }) {
  async function update(patch: Partial<WatcherRecord>) {
    await db.watchers.update(watcher.id, {
      ...patch,
      updated_at: nowIso()
    })
  }

  return (
    <Panel className="p-5">
      <h2 className="font-semibold">Watcher Settings</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Toggle
          checked={watcher.enabled}
          label="Periodic scanning"
          onChange={(enabled) => update({ enabled })}
        />
        <Toggle
          checked={watcher.notifications_enabled}
          label="Watcher notifications"
          onChange={(notifications_enabled) => update({ notifications_enabled })}
        />
        <ScanIntervalField
          onChange={(scan_interval_minutes) => update({ scan_interval_minutes })}
          value={watcher.scan_interval_minutes}
        />
        <ThresholdField
          label="Relevance"
          onChange={(relevance_threshold) => update({ relevance_threshold })}
          value={watcher.relevance_threshold}
        />
        <ThresholdField
          label="Urgency"
          onChange={(urgency_threshold) => update({ urgency_threshold })}
          value={watcher.urgency_threshold}
        />
        <ThresholdField
          label="Confidence"
          onChange={(confidence_threshold) => update({ confidence_threshold })}
          value={watcher.confidence_threshold}
        />
        <ThresholdField
          label="Max age hours"
          max={168}
          onChange={(max_post_age_hours) => update({ max_post_age_hours })}
          value={watcher.max_post_age_hours}
        />
      </div>
    </Panel>
  )
}

function ScanIntervalField(props: {
  value: number
  onChange: (value: number) => void
}) {
  const normalizedValue = normalizeScanIntervalMinutes(props.value)
  const [draftValue, setDraftValue] = useState(String(normalizedValue))

  useEffect(() => {
    setDraftValue(String(normalizedValue))
  }, [normalizedValue])

  function commit(value: string) {
    const numericValue = Number(value)
    const nextValue = normalizeScanIntervalMinutes(numericValue)
    setDraftValue(String(nextValue))
    props.onChange(nextValue)
  }

  return (
    <Field
      hint={`Minimum ${MIN_SCAN_INTERVAL_MINUTES} minutes. Scan Now still runs immediately.`}
      label="Scan interval">
      <div className="flex items-center gap-2">
        <TextInput
          min={MIN_SCAN_INTERVAL_MINUTES}
          onBlur={() => commit(draftValue)}
          onChange={(value) => {
            setDraftValue(value)
            const numericValue = Number(value)
            if (numericValue >= MIN_SCAN_INTERVAL_MINUTES) {
              props.onChange(normalizeScanIntervalMinutes(numericValue))
            }
          }}
          step={1}
          type="number"
          value={draftValue}
        />
        <span className="shrink-0 text-sm text-zinc-500">minutes</span>
      </div>
    </Field>
  )
}

function ThresholdField(props: {
  label: string
  value: number
  onChange: (value: number) => void
  max?: number
}) {
  return (
    <Field label={props.label}>
      <input
        className="w-full accent-signal-blue"
        max={props.max ?? 100}
        min={0}
        onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        type="range"
        value={props.value}
      />
      <p className="mt-1 text-sm text-zinc-400">{props.value}</p>
    </Field>
  )
}

function NotificationSettings(props: {
  settings: SettingsRecord
  history: Array<{
    id: string
    title: string
    subreddit: string
    relevance: number
    reason: string
    created_at: string
  }>
}) {
  const snoozed =
    props.settings.notification_snoozed_until &&
    new Date(props.settings.notification_snoozed_until).getTime() > Date.now()

  return (
    <Panel className="p-5">
      <h2 className="font-semibold">Notifications</h2>
      <div className="mt-4 space-y-3">
        <Toggle
          checked={props.settings.global_notifications_enabled}
          label="Global notifications"
          onChange={(global_notifications_enabled) =>
            db.settings.update(DEFAULT_SETTINGS_ID, {
              global_notifications_enabled,
              updated_at: nowIso()
            })
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => snoozeNotifications(1)}>Snooze 1h</Button>
          <Button onClick={() => snoozeNotifications(4)}>Snooze 4h</Button>
          <Button onClick={snoozeNotificationsToday}>Snooze Today</Button>
          {snoozed ? (
            <Button onClick={clearNotificationSnooze} variant="primary">
              Resume
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-zinc-500">
          Snoozed until:{" "}
          {props.settings.notification_snoozed_until
            ? new Date(props.settings.notification_snoozed_until).toLocaleString()
            : "Not active"}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          Notification History
        </p>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {props.history.length === 0 ? (
            <p className="text-sm text-zinc-500">No notifications yet.</p>
          ) : (
            props.history.slice(0, 12).map((item) => (
              <div className="rounded-md bg-white/[0.035] p-3" key={item.id}>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  r/{item.subreddit} • {item.relevance} relevance •{" "}
                  {formatRelativeTime(item.created_at)}
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {item.reason}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  )
}

function DebugLogs(props: {
  settings: SettingsRecord
  logs: Array<{
    id: string
    timestamp: string
    level: string
    source: string
    message: string
    metadata?: unknown
  }>
}) {
  function exportLogs() {
    const blob = new Blob([JSON.stringify(props.logs, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `threadwise-logs-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Debug Logs</h2>
        <div className="flex gap-2">
          <Button onClick={exportLogs}>
            <ExternalLink size={15} />
            Export
          </Button>
          <Button onClick={() => db.logs.clear()} variant="danger">
            Clear
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <Toggle
          checked={props.settings.verbose_logging_enabled}
          label="Verbose logging"
          onChange={(verbose_logging_enabled) =>
            db.settings.update(DEFAULT_SETTINGS_ID, {
              verbose_logging_enabled,
              updated_at: nowIso()
            })
          }
        />
      </div>
      <div className="mt-4 max-h-[460px] space-y-2 overflow-auto pr-1">
        {props.logs.length === 0 ? (
          <p className="text-sm text-zinc-500">No logs yet.</p>
        ) : (
          props.logs.map((log) => (
            <div className="rounded-md bg-graphite-950 p-3" key={log.id}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500">
                  {formatRelativeTime(log.timestamp)}
                </span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-400">
                  {log.source}
                </span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-400">
                  {log.level}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{log.message}</p>
              {log.metadata ? (
                <pre className="mt-2 whitespace-pre-wrap rounded bg-white/[0.03] p-2 text-xs leading-5 text-zinc-500">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  )
}

async function requestProviderPermission(baseUrl: string): Promise<void> {
  if (!baseUrl || baseUrl.startsWith("mock://")) return

  try {
    const url = new URL(baseUrl)
    const origin = `${url.protocol}//${url.host}/*`
    const hasPermission = await chrome.permissions.contains({ origins: [origin] })
    if (!hasPermission) {
      await chrome.permissions.request({ origins: [origin] })
    }
  } catch {
    // Invalid URLs will be surfaced by the provider test/save flow.
  }
}

function isProviderConfigured(provider: AiProviderRecord): boolean {
  if (provider.provider_type === "mock") return false
  if (isLocalProviderUrl(provider.base_url)) return true
  return provider.api_key_encrypted_or_local.length > 0
}

function isLocalProviderUrl(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(baseUrl)
}

function readDashboardTabRoute(): DashboardTab {
  const route = window.location.hash.replace(/^#\/?/, "")
  return dashboardTabByRoute.get(route) ?? "Inbox"
}

function writeDashboardTabRoute(tab: DashboardTab): void {
  const nextHash = `#${dashboardTabRoutes[tab]}`
  if (window.location.hash === nextHash) return
  window.history.replaceState(null, "", nextHash)
}

function summarizeQueue(queueItems: AiQueueRecord[]) {
  const pendingItems = queueItems.filter((item) =>
    ["pending", "rate_limited"].includes(item.status)
  )

  return {
    pending: pendingItems.length,
    running: queueItems.filter((item) => item.status === "running").length,
    failed: queueItems.filter((item) => item.status === "failed").length,
    nextRunAt: pendingItems
      .map((item) => item.run_after)
      .sort((a, b) => a.localeCompare(b))[0]
  }
}

function formatFuture(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return "now"
  const seconds = Math.ceil(diffMs / 1000)
  if (seconds < 60) return `in ${seconds}s`
  return `in ${Math.ceil(seconds / 60)}m`
}
