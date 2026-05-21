# ThreadWise Codex Build Prompt

You are my senior product engineer. Build a complete Chrome extension MVP from scratch.

## Product name

ThreadWise

## Product

ThreadWise is a local-first AI Chrome extension that watches selected Reddit communities and surfaces only high-value Reddit threads based on the user’s intent.

## Core positioning

A personal AI analyst for Reddit. Not a feed reader. Not doomscrolling. It should find only the Reddit threads worth the user’s time.

## Primary target users

- Indie hackers
- Founders
- Developers
- Researchers
- Content creators
- Product builders
- Power Reddit users

## Tech stack

Use:

- Plasmo
- React
- TypeScript
- TailwindCSS
- Manifest V3
- Dexie for IndexedDB
- Vercel AI SDK / AI SDK Core for provider abstraction where compatible

If Vercel AI SDK is not compatible with the Chrome extension service worker/runtime constraints, create a clean internal provider adapter interface instead, but keep the API shaped so it can later be swapped to AI SDK providers.

The AI layer must support a generic provider system, not only OpenAI.

## Architecture

- Chrome extension only
- Fully local-first
- No backend
- BYOK: Bring Your Own Key
- Store AI API keys locally only
- Support OpenAI-compatible APIs from v1
- Support custom base URL and model name
- Design the AI provider layer so Anthropic, Gemini, OpenRouter, Groq, Mistral, Together, Ollama/local endpoints, and any OpenAI-compatible provider can be added later

## Important platform notes

Chrome Manifest V3 uses service workers, not persistent background pages. Use `chrome.alarms` for periodic checks. Do not assume always-running background execution.

Reddit API access is rate limited. Monitor response headers where available and avoid aggressive polling.

## MVP scope

1. Chrome extension only
2. Local-first storage
3. BYOK AI API key
4. Create AI “Watchers”
5. Add subreddits to each watcher
6. Choose intent template or custom intent
7. Test watcher on latest posts before enabling
8. Periodic Reddit scanning
9. Local pre-filtering
10. Batched AI scoring
11. AI request queue and rate limiter
12. Local feedback learning
13. Browser notifications for high-value matches
14. Dashboard with results, scores, reasons, feedback buttons
15. Inline score badge on reddit.com pages where possible
16. Transparent polling/debugging UI

## Do NOT build

- Mobile app
- Desktop app
- Backend
- Account login
- Cloud sync
- Social features
- Multi-source feed
- Billing/subscription
- Embeddings
- Local ML training
- Overengineered AI pipelines

## Main UX philosophy

The product should feel:

- Calm
- Premium
- Intentional
- Trustworthy
- Signal-first

It should NOT feel like:

- Another social feed
- Addictive scrolling
- Noisy notifications

## Primary UX concept

An “Intelligence Inbox” for Reddit.

## Main pages

### 1. Popup

Small lightweight popup.

Features:

- Unread important threads
- Latest alerts
- Scan Now button
- Open Dashboard button
- Snooze notifications
- Small scan status summary
- AI queue status if active

### 2. Dashboard

Main product UI.

Left sidebar:

- Watchers
- Create Watcher button

Main tabs:

- Inbox
- Hidden Gems
- Urgent
- Saved
- History
- Scan Activity
- Settings

Thread cards show:

- Relevance score
- Urgency score
- Confidence score
- Subreddit
- Title
- Short AI summary
- “Why this matters”
- Matched signals
- Negative signals
- Detected category
- Hidden Gem badge if applicable
- Buttons:
  - Relevant
  - Not Relevant
  - Save
  - Open Reddit
  - Mute Similar

### 3. Onboarding

Show this message:

“ThreadWise watches your favorite Reddit communities and alerts you only when a thread truly matches your intent.”

Onboarding steps:

1. Add AI API key
2. Choose AI provider
3. Choose model
4. Choose watcher template
5. Add subreddits
6. Test watcher on latest posts
7. Set thresholds
8. Enable watcher

## Watcher templates

### 1. Startup Pain Finder

Goal:

Find people complaining about tools, workflows, pricing, bugs, missing features, or unsolved problems that could become startup ideas.

Suggested subreddits:

- r/SaaS
- r/startups
- r/Entrepreneur
- r/SideProject
- r/smallbusiness

### 2. Indie Hacker Signal

Goal:

Find useful discussions about building, launching, validating, monetizing, marketing, and growing small internet products.

Suggested subreddits:

- r/SideProject
- r/indiehackers
- r/SaaS
- r/startups
- r/Entrepreneur
- r/ProductManagement

### 3. Developer Opportunity Finder

Goal:

Find technical problems, tool complaints, workflow pain points, collaboration opportunities, and high-signal developer discussions.

Suggested subreddits:

- r/programming
- r/webdev
- r/softwareengineering
- r/devops
- r/selfhosted
- r/cscareerquestions

### 4. AI Trend Watcher

Goal:

Find emerging AI tools, workflows, model comparisons, automation ideas, strong opinions, and practical use cases.

Suggested subreddits:

- r/ArtificialInteligence
- r/LocalLLaMA
- r/OpenAI
- r/ChatGPT
- r/MachineLearning
- r/singularity

### 5. Content Idea Finder

Goal:

Find unanswered questions, repeated confusions, pain points, strong opinions, and trending discussions that can become articles, videos, or social content.

Suggested subreddits:

- r/explainlikeimfive
- r/NoStupidQuestions
- r/OutOfTheLoop
- r/AskReddit
- r/YouTubers
- r/NewTubers

### 6. Career Opportunity Watcher

Goal:

Find hiring signals, freelance opportunities, collaboration posts, resume pain points, and useful career discussions.

Suggested subreddits:

- r/forhire
- r/freelance
- r/remotework
- r/digitalnomad
- r/cscareerquestions

### 7. High-Quality Discussion Finder

Goal:

Find thoughtful, detailed, high-signal discussions while avoiding memes, rage bait, low-effort posts, and repetitive beginner content.

Suggested subreddits:

- r/changemyview
- r/DepthHub
- r/bestof
- r/TrueAskReddit
- r/AskReddit

## Data model

Use Dexie with tables:

- settings
- ai_providers
- watchers
- subreddit_sources
- posts
- ai_scores
- feedback
- preference_memory
- notification_history
- scan_runs
- muted_patterns
- logs
- ai_queue

### Settings fields

- id
- active_provider_id
- global_notifications_enabled
- notification_snoozed_until
- verbose_logging_enabled
- default_scan_interval_minutes
- default_ai_requests_per_minute
- default_ai_batch_size

### AI provider fields

- id
- provider_type: openai_compatible | openai | anthropic | gemini | openrouter | groq | mistral | together | ollama | custom
- display_name
- base_url
- api_key_encrypted_or_local
- model
- enabled
- requests_per_minute default 6
- max_batch_size default 5
- created_at
- updated_at

Do not expose full API keys in the UI after saving. Show only masked value.

### Watcher fields

- id
- name
- template_type
- user_prompt
- generated_prompt
- subreddits
- relevance_threshold default 75
- urgency_threshold default 40
- confidence_threshold default 60
- scan_interval_minutes default 30
- max_post_age_hours default 24
- enabled
- notifications_enabled
- created_at
- updated_at

## AI provider abstraction

Use Vercel AI SDK for provider abstraction.

Support:

- OpenAI
- Google Gemini
- Anthropic
- OpenRouter
- Groq

Architecture requirements:

- Generic provider interface
- Provider-specific adapters
- User can select provider in settings
- User can configure:
  - API key
  - model name
  - endpoint URL if supported

Default examples:

- Gemini:
  model: gemini-2.5-flash
- OpenAI:
  model: gpt-4.1-mini
- Anthropic:
  model: claude-3-5-sonnet
- Groq:
  model: llama-3.3-70b-versatile

Store provider config locally only.

Create a provider interface:

```ts
interface AiProvider {
  id: string
  name: string
  scorePosts(input: BatchScoreInput): Promise<BatchScoreResult>
  validateConfig(config: AiProviderConfig): Promise<boolean>
}
```

Implement at least:

1. OpenAI-compatible provider
2. Mock provider for development

OpenAI-compatible provider must support:

- base URL
- API key
- model
- JSON response mode if supported
- fallback parsing if JSON mode is not supported

Provider UI must allow:

- Provider type
- Base URL
- API key
- Model name
- Requests per minute
- Batch size
- Test connection button

Default provider presets:

- OpenAI-compatible
- OpenRouter-compatible
- Groq-compatible
- Gemini OpenAI-compatible endpoint if user provides URL/key
- Ollama/local OpenAI-compatible endpoint

Do not hardcode paid keys.

## AI rate-limit and batching requirements

Do NOT call AI once per Reddit post.

Implement a 2-stage scoring pipeline.

### Stage 1: Local pre-filter and local pre-score

Before calling AI:

- Remove already-seen posts
- Remove muted posts
- Remove posts older than configured max age
- Remove posts with obvious low-value patterns if applicable
- Compute `local_candidate_score`

Local candidate score should use:

- Title keyword match
- Subreddit relevance
- Post age
- Score
- Comment count
- Score/comment velocity where possible
- Problem/opportunity words
- Negative/muted patterns
- Watcher template type

Only send top candidate posts to AI.

Example:

Fetched 100 posts
Remove 60 already seen
Remove 20 locally weak/muted posts
Send only 20 candidate posts to AI in small batches

### Stage 2: Batched AI scoring

Send multiple posts in one AI request.

Default batch size:

- 5 posts per request

User setting:

- 3, 5, or 10 posts per AI request

Rules:

- AI must return strict JSON array keyed by post id
- If batch response fails, retry once with smaller batch size
- If still fails, mark posts as AI failed and log error
- Do not lose all scan progress because one AI batch failed

### AI request queue

Add local AI request queue.

Default:

- Max 6 requests per minute
- Minimum delay 10 seconds between AI requests
- Per-provider configurable requests per minute
- Exponential backoff on 429/rate-limit errors
- Queue must survive service worker restarts by storing state locally
- Do not block the whole extension UI while queue runs

Dashboard should show:

“AI queue: 2 batches pending”

when applicable.

## Prompt size control

For v1, send only:

- post id
- title
- subreddit
- first 500 characters of selftext
- Reddit score
- comment count
- age
- permalink

Do not send full comments in v1.

## AI batch prompt

For each candidate batch, AI input should include:

- watcher goal
- user custom intent
- positive preference memory
- negative preference memory
- recent accepted examples
- recent rejected examples
- list of posts to score

The AI must return strict JSON only:

```json
{
  "results": [
    {
      "id": "post_id",
      "relevance": 0,
      "urgency": 0,
      "confidence": 0,
      "notify": true,
      "summary": "...",
      "why_this_matters": "...",
      "matched_signals": ["..."],
      "negative_signals": ["..."],
      "category": "opportunity | technical | trend | complaint | learning | career | discussion | noise",
      "is_hidden_gem": true
    }
  ]
}
```

Validate all AI results with TypeScript/Zod or equivalent runtime validation.

If AI output is malformed:

- Try to repair/parse JSON once
- Retry with smaller batch once
- Log parse failure
- Continue scan

## Notification rules

Notify ONLY if:

- relevance >= watcher.relevance_threshold
- urgency >= watcher.urgency_threshold
- confidence >= watcher.confidence_threshold
- not already notified
- not muted by feedback memory
- notifications are globally enabled
- watcher notifications are enabled
- snooze is not active

Notifications are a CORE feature.

Add notification controls:

- Enable/disable globally
- Enable/disable per watcher
- Snooze 1 hour
- Snooze 4 hours
- Snooze today
- Notification history page

Each notification should clearly explain WHY it triggered.

Notification content should include:

- Thread title
- Subreddit
- Relevance score
- Short reason
- Click opens Reddit thread or dashboard detail

## Hidden Gem logic

A post may be a Hidden Gem if:

- relevance >= 80
- confidence >= 70
- Reddit score is still low OR comment count is still low
- AI believes content quality or future importance is high

## Local learning

Do NOT train ML models.

Maintain lightweight local preference memory per watcher.

When user clicks Relevant:

- Strengthen matched signals
- Save positive example

When user clicks Not Relevant:

Ask optional reason:

- Too beginner
- Too promotional
- Wrong topic
- Not actionable
- Low quality
- Already known
- Too political
- Rage bait
- Other

Add this to negative preference memory.

All future AI scoring requests must include:

- watcher goal
- positive memory
- negative memory
- accepted examples
- rejected examples

## Reddit fetching

Use public Reddit JSON endpoints first where possible.

Support optional Reddit API credentials later.

Fetch:

- hot
- new
- rising where available

Avoid heavy comment fetching in v1.

Score based on:

- title
- selftext
- subreddit
- score
- comment count
- age

Reddit request strategy:

- Avoid aggressive polling
- Deduplicate across hot/new/rising
- Respect rate-limit response headers where available:
  - X-Ratelimit-Used
  - X-Ratelimit-Remaining
  - X-Ratelimit-Reset
- Store rate-limit info in scan activity
- Back off when rate limit is low or errors occur

## Background architecture

Use:

- `chrome.alarms`
- `chrome.notifications`
- service-worker-safe architecture

Persist all state to IndexedDB/chrome storage.

Never depend on long-lived in-memory state.

## Inline Reddit enhancement

When user browses reddit.com:

Show small non-intrusive badge beside posts:

“ThreadWise 87”

Clicking badge shows:

- AI summary
- why this matters
- matched watcher
- matched signals

Only inject on Reddit pages.

Keep permissions minimal.

## Permissions

Request only:

- storage
- alarms
- notifications
- reddit.com host permissions
- optional content script permissions
- AI endpoint host permission

## Design

- Dark mode first
- Tailwind
- Clean cards
- Rounded corners
- Minimal clutter
- Premium feel
- No infinite feed

Labels:

- Important
- Hidden Gem
- Urgent
- Saved
- Low Confidence
- Muted
- Queued
- Rate Limited

## Polling transparency

Users must understand:

- when scans happened
- what was fetched
- what was skipped
- what triggered notifications
- what AI requests were made
- what is queued

Add “Scan Activity” page.

Show:

- last scan time
- next scan time
- watcher scanned
- subreddits checked
- posts fetched
- new posts
- existing posts
- skipped posts
- locally selected candidate posts
- AI batches created
- AI requests sent
- AI requests failed
- AI-scored posts
- threshold matches
- notifications sent
- Reddit/API errors
- AI errors
- rate-limit warnings
- AI queue status
- estimated tokens if available
- rate-limit delays

## Scan runs table

`scan_runs` fields:

- id
- watcher_id
- started_at
- finished_at
- status: success | partial | failed
- subreddits_checked
- posts_fetched
- new_posts
- existing_posts
- skipped_posts
- local_candidate_posts
- ai_batches_created
- ai_requests_sent
- ai_requests_failed
- ai_scored_posts
- threshold_matches
- notifications_sent
- reddit_errors
- ai_errors
- reddit_rate_limit_info
- ai_rate_limit_info
- queue_status
- debug_notes

## Debug logging

Create local debug log viewer in Settings.

Log:

- alarm triggered
- scan started
- subreddit fetch started
- subreddit fetch completed
- post skipped
- post selected by local pre-score
- post sent to AI queue
- AI batch created
- AI request started
- AI score received
- AI parse failure
- AI rate limit hit
- threshold matched
- notification sent
- notification failed
- scan completed

Log entry fields:

- timestamp
- level: info | warning | error
- source: scanner | reddit | ai | ai_queue | notification | learning | ui
- message
- metadata JSON optional

Allow:

- clear logs
- export logs as JSON
- verbose logging toggle

Never expose API keys in logs.

Mask sensitive values.

Dashboard status line:

“Last scan: 12 posts checked, 3 new, 1 matched, 1 notified.”

When AI queue exists:

“AI queue: 2 batches pending, next request in 8s.”

## Error handling

Handle:

- missing API key
- invalid API key
- unsupported provider
- Reddit rate limit
- Reddit fetch failure
- AI rate limit
- AI JSON parse failure
- notification permission denied
- IndexedDB failure
- service worker restart during queue processing

Include mock mode for development.

## Code quality

- TypeScript strict mode
- Reusable components
- Modular architecture
- Clean folder structure
- Production-ready quality
- Avoid unnecessary abstractions

## Folder structure

```text
src/
  background/
  contents/
  popup/
  dashboard/
  onboarding/
  components/
  db/
  services/
    reddit/
    ai/
      providers/
      queue/
    scanner/
    notifications/
    learning/
    logging/
  types/
  utils/
```

## README requirements

Explain:

- installation
- development
- building
- loading unpacked extension
- configuring API provider
- configuring API key
- watcher setup
- scan activity
- notification behavior
- AI batching/rate limits
- debugging
- permissions

## Completion criteria

The project is complete when:

1. Extension installs locally in Chrome
2. User can add OpenAI-compatible API key, base URL, and model
3. User can test AI provider connection
4. User can create watcher from template
5. User can add major subreddits like:
   - r/SaaS
   - r/startups
   - r/Entrepreneur
   - r/SideProject
   - r/programming
   - r/webdev
   - r/ArtificialInteligence
   - r/LocalLLaMA
   - r/AskReddit
6. User can run Scan Now
7. Posts are fetched and locally pre-filtered
8. Candidate posts are batched for AI scoring
9. AI queue and rate limiter work
10. Results appear in dashboard
11. High-value posts trigger notifications
12. User can mark posts Relevant / Not Relevant
13. Future scans use local preference memory
14. reddit.com shows ThreadWise score badge where technically possible
15. Scan Activity works
16. Debug logs work
17. README explains everything

Build the complete MVP now.

Make reasonable engineering and product decisions without asking questions.

Prefer simple reliable implementation over overengineering.
