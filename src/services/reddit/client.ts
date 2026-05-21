import type { RateLimitInfo, RedditPostRecord } from "~/types/domain"
import { nowIso } from "~/utils/time"

export type RedditListing = "hot" | "new" | "rising"

interface RedditChild {
  data?: {
    id?: string
    name?: string
    subreddit?: string
    title?: string
    author?: string
    selftext?: string
    url?: string
    permalink?: string
    score?: number
    num_comments?: number
    created_utc?: number
  }
}

interface RedditListingResponse {
  data?: {
    children?: RedditChild[]
  }
}

export interface FetchSubredditResult {
  posts: RedditPostRecord[]
  rateLimitInfo: RateLimitInfo
}

export async function fetchSubredditListing(
  subreddit: string,
  listing: RedditListing,
  limit = 25
): Promise<FetchSubredditResult> {
  const cleanSubreddit = subreddit.replace(/^r\//i, "")
  const url = new URL(
    `https://www.reddit.com/r/${encodeURIComponent(cleanSubreddit)}/${listing}.json`
  )
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("raw_json", "1")

  const response = await fetch(url.toString(), {
    credentials: "omit",
    headers: {
      Accept: "application/json"
    }
  })

  const rateLimitInfo = parseRateLimitHeaders(response.headers)

  if (!response.ok) {
    throw new Error(
      `Reddit ${listing} fetch failed for r/${cleanSubreddit}: ${response.status} ${response.statusText}`
    )
  }

  const json = (await response.json()) as RedditListingResponse
  const fetchedAt = nowIso()
  const posts =
    json.data?.children
      ?.map((child) => mapRedditChild(child, listing, fetchedAt))
      .filter((post): post is RedditPostRecord => Boolean(post)) ?? []

  return { posts, rateLimitInfo }
}

function mapRedditChild(
  child: RedditChild,
  listing: RedditListing,
  fetchedAt: string
): RedditPostRecord | undefined {
  const data = child.data
  if (!data?.id || !data.title || !data.subreddit || !data.permalink) {
    return undefined
  }

  const redditId = data.id

  return {
    id: `reddit_${redditId}`,
    reddit_id: redditId,
    subreddit: data.subreddit,
    title: data.title,
    author: data.author,
    selftext: data.selftext ?? "",
    url: data.url ?? `https://www.reddit.com${data.permalink}`,
    permalink: `https://www.reddit.com${data.permalink}`,
    score: data.score ?? 0,
    num_comments: data.num_comments ?? 0,
    created_utc: data.created_utc ?? Math.floor(Date.now() / 1000),
    fetched_at: fetchedAt,
    source_listing: listing,
    last_seen_at: fetchedAt
  }
}

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  return {
    used: parseOptionalNumber(headers.get("x-ratelimit-used")),
    remaining: parseOptionalNumber(headers.get("x-ratelimit-remaining")),
    reset_seconds: parseOptionalNumber(headers.get("x-ratelimit-reset")),
    retry_after_seconds: parseOptionalNumber(headers.get("retry-after")),
    source: "reddit"
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
