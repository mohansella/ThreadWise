import "./style.css"

import { Bell, Gauge, LayoutDashboard, Radar } from "lucide-react"

function Popup() {
  return (
    <main className="w-[380px] bg-graphite-950 p-4 text-zinc-100">
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
          <div className="rounded-md bg-white/[0.04] p-3">
            <Bell className="text-signal-amber" size={16} />
            <p className="mt-2 text-xl font-semibold">0</p>
            <p className="text-xs text-zinc-500">Unread</p>
          </div>
          <div className="rounded-md bg-white/[0.04] p-3">
            <Gauge className="text-signal-green" size={16} />
            <p className="mt-2 text-xl font-semibold">Idle</p>
            <p className="text-xs text-zinc-500">Scanner</p>
          </div>
          <div className="rounded-md bg-white/[0.04] p-3">
            <Radar className="text-signal-blue" size={16} />
            <p className="mt-2 text-xl font-semibold">0</p>
            <p className="text-xs text-zinc-500">Queued</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-graphite-950">
            <Radar size={16} />
            Scan Now
          </button>
          <button
            className="flex items-center justify-center rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-zinc-200"
            onClick={() => chrome.runtime.openOptionsPage()}>
            <LayoutDashboard size={16} />
          </button>
        </div>
      </section>
    </main>
  )
}

export default Popup
