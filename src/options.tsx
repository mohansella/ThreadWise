import "./style.css"

import {
  Bell,
  Bookmark,
  Clock3,
  Inbox,
  Plus,
  Radar,
  Settings,
  Sparkles
} from "lucide-react"

const tabs = [
  { label: "Inbox", icon: Inbox },
  { label: "Hidden Gems", icon: Sparkles },
  { label: "Urgent", icon: Bell },
  { label: "Saved", icon: Bookmark },
  { label: "History", icon: Clock3 },
  { label: "Scan Activity", icon: Radar },
  { label: "Settings", icon: Settings }
]

function OptionsPage() {
  return (
    <main className="min-h-screen bg-graphite-950 text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-white/10 bg-graphite-900 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-zinc-100 p-2 text-graphite-950">
              <Radar size={19} />
            </div>
            <div>
              <p className="text-sm font-semibold">ThreadWise</p>
              <p className="text-xs text-zinc-500">Local intelligence</p>
            </div>
          </div>

          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-graphite-950">
            <Plus size={16} />
            Create Watcher
          </button>

          <div className="mt-6">
            <p className="px-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Watchers
            </p>
            <div className="mt-3 rounded-md border border-dashed border-white/15 p-4 text-sm text-zinc-500">
              Add your first watcher to start scanning Reddit.
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/10 bg-graphite-950/95 px-8 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Intelligence Inbox
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              High-signal Reddit threads, filtered by intent.
            </h1>
          </header>

          <nav className="flex gap-1 border-b border-white/10 px-8 py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  key={tab.label}>
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="tw-scrollbar flex-1 overflow-auto px-8 py-6">
            <section className="rounded-lg border border-white/10 bg-graphite-900 p-6">
              <p className="text-sm text-zinc-400">
                ThreadWise watches your favorite Reddit communities and alerts
                you only when a thread truly matches your intent.
              </p>
              <div className="mt-5 grid max-w-4xl grid-cols-3 gap-3">
                {["Provider", "Watcher", "First scan"].map((step) => (
                  <div className="rounded-md bg-white/[0.04] p-4" key={step}>
                    <p className="text-sm font-medium">{step}</p>
                    <p className="mt-1 text-xs text-zinc-500">Not configured</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

export default OptionsPage
