# ThreadWise

ThreadWise is a local-first AI Chrome extension that watches selected Reddit communities and surfaces high-value threads based on the user's intent.

It runs as a Manifest V3 extension with no backend, no login, and no cloud sync. Provider config, API keys, scan history, scores, feedback, logs, and queue state are stored locally in IndexedDB.

## Features

- Plasmo, React, TypeScript, TailwindCSS, Manifest V3
- Dexie-backed local database
- BYOK provider settings
- Vercel AI SDK provider abstraction
- Provider adapters for OpenAI, Google Gemini, Anthropic, OpenRouter, Groq, and generic OpenAI-compatible endpoints
- Mock provider for local development
- Watcher templates with custom intent prompts
- Public Reddit JSON scanning for hot, new, and rising posts
- Local pre-filtering before AI calls
- Durable AI queue with batching and rate limiting
- Browser notifications for threshold matches
- Dashboard inbox, hidden gems, urgent, saved, history, scan activity, settings, logs, and notification history
- Popup with unread alerts, scan status, queue status, scan now, dashboard launch, and notification snooze
- reddit.com inline ThreadWise score badges where local scores exist

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Plasmo will create a development extension build and keep it updated while files change.

## Build

```bash
npm run build
```

The production Chrome extension is emitted to:

```text
build/chrome-mv3-prod
```

## Load Unpacked In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `build/chrome-mv3-prod`.
5. Pin ThreadWise from Chrome's extension menu.

## Configure An AI Provider

Open the ThreadWise dashboard from the popup. In Settings, choose a provider:

- OpenAI, default model `gpt-4.1-mini`
- Google Gemini, default model `gemini-2.5-flash`
- Anthropic, default model `claude-3-5-sonnet`
- OpenRouter
- Groq, default model `llama-3.3-70b-versatile`
- Generic OpenAI-compatible
- Ollama/local OpenAI-compatible
- Mock provider

Enter the API key, model name, and endpoint URL when supported. ThreadWise requests host permission for the selected endpoint origin and stores the provider config locally only. Saved keys are masked in the UI and logs.

Use Test to validate the provider before enabling real scans.

## Create A Watcher

In Settings, create a watcher from a template:

- Startup Pain Finder
- Indie Hacker Signal
- Developer Opportunity Finder
- AI Trend Watcher
- Content Idea Finder
- Career Opportunity Watcher
- High-Quality Discussion Finder

Add subreddits such as `SaaS`, `startups`, `Entrepreneur`, `SideProject`, `programming`, `webdev`, `ArtificialInteligence`, `LocalLLaMA`, or `AskReddit`. Add a custom intent if the template is too broad.

Use Create and Test to scan the latest posts before enabling periodic scanning. Then enable Periodic scanning in Watcher Settings.

## Scan Activity

The Scan Activity tab shows:

- Last scan status
- Subreddits checked
- Posts fetched, new, existing, skipped
- Local candidate posts
- AI batches created
- AI requests sent or failed
- AI-scored posts
- Threshold matches
- Notifications sent
- Reddit/API errors
- AI errors
- Queue status and debug notes

## Notifications

Notifications are sent only when all rules pass:

- Relevance, urgency, and confidence meet watcher thresholds
- The post was not already notified
- Global notifications are enabled
- Watcher notifications are enabled
- Snooze is not active
- Feedback mute patterns do not match

The popup and Settings page support snoozing for 1 hour, 4 hours, or today.

## AI Batching And Rate Limits

ThreadWise does not call AI once per post. It first filters locally, then sends top candidates in batches. Default batch size is 5 posts. Provider requests per minute and batch size are configurable.

The AI queue is stored in IndexedDB, so pending batches survive service worker restarts. A Chrome alarm processes queue work periodically.

## Feedback Learning

Thread cards support Relevant, Not Relevant, Save, Open Reddit, and Mute Similar.

Feedback updates lightweight local preference memory per watcher. Future AI prompts include positive signals, negative signals, accepted examples, and rejected examples. No model training is performed.

## Debugging

Settings includes a local debug log viewer with:

- Verbose logging toggle
- Clear logs
- Export logs as JSON
- Masked sensitive metadata

Logs cover scanner, Reddit fetching, AI queue, AI scoring, notification, learning, and UI events.

## Permissions

ThreadWise requests:

- `storage` for local extension state
- `alarms` for MV3-safe periodic scans and queue processing
- `notifications` for high-value thread alerts
- Reddit host permissions for public Reddit JSON fetching and inline badges
- Optional endpoint host permissions for user-configured AI providers

No backend or account permissions are used.

## Verification

```bash
npm run check
```

This runs TypeScript strict checking and a Plasmo production build.
