import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.reddit.com/*",
    "https://old.reddit.com/*",
    "https://*.reddit.com/*"
  ],
  run_at: "document_idle"
}

interface BadgePayload {
  relevance: number
  confidence: number
  summary: string
  why: string
  watcherName: string
  matchedSignals: string[]
  isHiddenGem: boolean
}

const BADGE_ATTR = "data-threadwise-badge"
let scanTimer: number | undefined

injectStyles()
scheduleScan()

const observer = new MutationObserver(() => scheduleScan())
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
})

function scheduleScan() {
  if (scanTimer) window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(scanPage, 350)
}

async function scanPage() {
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="/comments/"]')
  )
  const redditIds = Array.from(
    new Set(
      anchors
        .map((anchor) => extractRedditId(anchor.href))
        .filter((id): id is string => Boolean(id))
    )
  ).slice(0, 80)

  if (redditIds.length === 0) return

  const badges = await requestBadges(redditIds)
  for (const anchor of anchors) {
    const redditId = extractRedditId(anchor.href)
    if (!redditId || !badges[redditId]) continue
    attachBadge(anchor, redditId, badges[redditId])
  }
}

function attachBadge(
  anchor: HTMLAnchorElement,
  redditId: string,
  badge: BadgePayload
) {
  const container =
    anchor.closest("article, shreddit-post, [data-testid='post-container']") ??
    anchor.parentElement
  if (!container) return
  if (container.querySelector(`[${BADGE_ATTR}="${redditId}"]`)) return
  if ((anchor.textContent?.trim().length ?? 0) < 8) return

  const wrapper = document.createElement("span")
  wrapper.className = "threadwise-badge-wrap"
  wrapper.setAttribute(BADGE_ATTR, redditId)

  const button = document.createElement("button")
  button.className = "threadwise-badge"
  button.type = "button"
  button.textContent = `ThreadWise ${badge.relevance}`
  button.title = `${badge.watcherName}: ${badge.summary}`

  const popover = document.createElement("span")
  popover.className = "threadwise-popover"
  popover.innerHTML = `
    <strong>${escapeHtml(badge.watcherName)}</strong>
    <span>${escapeHtml(badge.summary)}</span>
    <em>${escapeHtml(badge.why)}</em>
    ${
      badge.matchedSignals.length
        ? `<small>${badge.matchedSignals
            .slice(0, 4)
            .map(escapeHtml)
            .join(" • ")}</small>`
        : ""
    }
  `

  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    wrapper.classList.toggle("threadwise-open")
  })

  wrapper.append(button, popover)
  anchor.insertAdjacentElement("afterend", wrapper)
}

function requestBadges(
  redditIds: string[]
): Promise<Record<string, BadgePayload>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "THREADWISE_GET_BADGES", redditIds },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          resolve({})
          return
        }

        resolve(response.badges ?? {})
      }
    )
  })
}

function extractRedditId(href: string): string | undefined {
  const match = href.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)
  return match?.[1]
}

function injectStyles() {
  if (document.getElementById("threadwise-badge-style")) return

  const style = document.createElement("style")
  style.id = "threadwise-badge-style"
  style.textContent = `
    .threadwise-badge-wrap {
      display: inline-flex;
      position: relative;
      margin-left: 8px;
      vertical-align: middle;
      z-index: 3;
    }

    .threadwise-badge {
      border: 1px solid rgba(141, 200, 255, 0.45);
      border-radius: 6px;
      background: rgba(9, 10, 12, 0.88);
      color: #8dc8ff;
      cursor: pointer;
      font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 4px 7px;
    }

    .threadwise-popover {
      display: none;
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      width: min(320px, 80vw);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      background: #111318;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.32);
      color: #f6f7f9;
      padding: 12px;
      white-space: normal;
    }

    .threadwise-open .threadwise-popover {
      display: grid;
      gap: 7px;
    }

    .threadwise-popover strong {
      font: 700 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .threadwise-popover span,
    .threadwise-popover em {
      color: #c8ced8;
      font: 400 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-style: normal;
    }

    .threadwise-popover small {
      color: #7bd88f;
      font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
  `
  document.documentElement.append(style)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      case "'":
        return "&#039;"
      default:
        return char
    }
  })
}
