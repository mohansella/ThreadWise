import type { BatchScoreInput } from "./types"

function memoryValues(input: BatchScoreInput, type: "positive" | "negative") {
  const items = type === "positive" ? input.positiveMemory : input.negativeMemory
  return items
    .slice(0, 12)
    .map((item) => `- ${item.value} (weight ${item.weight})`)
    .join("\n")
}

function exampleValues(input: BatchScoreInput, accepted: boolean) {
  const items = accepted ? input.acceptedExamples : input.rejectedExamples
  return items
    .slice(0, 6)
    .map((item) => `- ${item.value}`)
    .join("\n")
}

export function buildBatchScorePrompt(input: BatchScoreInput): string {
  const posts = input.posts.map((post) => ({
    id: post.id,
    title: post.title,
    subreddit: post.subreddit,
    selftext: post.selftext.slice(0, 500),
    reddit_score: post.score,
    comment_count: post.num_comments,
    age_hours: Number(post.age_hours.toFixed(1)),
    permalink: post.permalink,
    local_candidate_score: Math.round(post.local_candidate_score)
  }))

  return `You are ThreadWise, a personal AI analyst for Reddit.

Score each post for the user's watcher. Return strict JSON only. Do not include markdown.

Watcher name: ${input.watcher.name}
Watcher goal:
${input.watcher.generated_prompt}

Positive preference memory:
${memoryValues(input, "positive") || "- none yet"}

Negative preference memory:
${memoryValues(input, "negative") || "- none yet"}

Recent accepted examples:
${exampleValues(input, true) || "- none yet"}

Recent rejected examples:
${exampleValues(input, false) || "- none yet"}

Rules:
- Relevance, urgency, and confidence must be integers from 0 to 100.
- notify should be true only when the post is likely worth interrupting the user for.
- is_hidden_gem should be true only for high-quality posts with high relevance and low current Reddit traction.
- Penalize memes, rage bait, promotional posts, repeated beginner questions, and vague threads.
- Explain why each high-scoring post matters in concrete terms.
- Return one result for every input post id and no other ids.

JSON shape:
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

Posts:
${JSON.stringify(posts, null, 2)}`
}
