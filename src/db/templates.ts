import type {
  ProviderPreset,
  WatcherTemplate,
  WatcherTemplateType
} from "~/types/domain"

export const WATCHER_TEMPLATES: WatcherTemplate[] = [
  {
    type: "startup_pain_finder",
    name: "Startup Pain Finder",
    goal: "Find people complaining about tools, workflows, pricing, bugs, missing features, or unsolved problems that could become startup ideas.",
    suggestedSubreddits: [
      "SaaS",
      "startups",
      "Entrepreneur",
      "SideProject",
      "smallbusiness"
    ],
    positiveKeywords: [
      "frustrated",
      "expensive",
      "manual",
      "workaround",
      "missing",
      "alternative",
      "problem",
      "pain"
    ],
    negativeKeywords: ["meme", "promo", "giveaway", "launching my"]
  },
  {
    type: "indie_hacker_signal",
    name: "Indie Hacker Signal",
    goal: "Find useful discussions about building, launching, validating, monetizing, marketing, and growing small internet products.",
    suggestedSubreddits: [
      "SideProject",
      "indiehackers",
      "SaaS",
      "startups",
      "Entrepreneur",
      "ProductManagement"
    ],
    positiveKeywords: [
      "launch",
      "validate",
      "mrr",
      "growth",
      "pricing",
      "users",
      "retention",
      "marketing"
    ],
    negativeKeywords: ["roast my", "upvote", "follow me"]
  },
  {
    type: "developer_opportunity_finder",
    name: "Developer Opportunity Finder",
    goal: "Find technical problems, tool complaints, workflow pain points, collaboration opportunities, and high-signal developer discussions.",
    suggestedSubreddits: [
      "programming",
      "webdev",
      "softwareengineering",
      "devops",
      "selfhosted",
      "cscareerquestions"
    ],
    positiveKeywords: [
      "bug",
      "workflow",
      "tooling",
      "deployment",
      "api",
      "debugging",
      "self-hosted",
      "automation"
    ],
    negativeKeywords: ["homework", "beginner question", "leetcode"]
  },
  {
    type: "ai_trend_watcher",
    name: "AI Trend Watcher",
    goal: "Find emerging AI tools, workflows, model comparisons, automation ideas, strong opinions, and practical use cases.",
    suggestedSubreddits: [
      "ArtificialInteligence",
      "LocalLLaMA",
      "OpenAI",
      "ChatGPT",
      "MachineLearning",
      "singularity"
    ],
    positiveKeywords: [
      "workflow",
      "agent",
      "model",
      "benchmark",
      "automation",
      "open source",
      "local",
      "comparison"
    ],
    negativeKeywords: ["singularity is near", "image dump", "jailbreak"]
  },
  {
    type: "content_idea_finder",
    name: "Content Idea Finder",
    goal: "Find unanswered questions, repeated confusions, pain points, strong opinions, and trending discussions that can become articles, videos, or social content.",
    suggestedSubreddits: [
      "explainlikeimfive",
      "NoStupidQuestions",
      "OutOfTheLoop",
      "AskReddit",
      "YouTubers",
      "NewTubers"
    ],
    positiveKeywords: [
      "why",
      "how do",
      "confused",
      "what is",
      "explain",
      "unpopular opinion",
      "trend"
    ],
    negativeKeywords: ["nsfw", "joke", "karma"]
  },
  {
    type: "career_opportunity_watcher",
    name: "Career Opportunity Watcher",
    goal: "Find hiring signals, freelance opportunities, collaboration posts, resume pain points, and useful career discussions.",
    suggestedSubreddits: [
      "forhire",
      "freelance",
      "remotework",
      "digitalnomad",
      "cscareerquestions"
    ],
    positiveKeywords: [
      "hiring",
      "contract",
      "freelance",
      "remote",
      "resume",
      "interview",
      "opportunity"
    ],
    negativeKeywords: ["salary brag", "vent", "recruiter spam"]
  },
  {
    type: "high_quality_discussion_finder",
    name: "High-Quality Discussion Finder",
    goal: "Find thoughtful, detailed, high-signal discussions while avoiding memes, rage bait, low-effort posts, and repetitive beginner content.",
    suggestedSubreddits: [
      "changemyview",
      "DepthHub",
      "bestof",
      "TrueAskReddit",
      "AskReddit"
    ],
    positiveKeywords: [
      "discussion",
      "analysis",
      "evidence",
      "deep dive",
      "thoughtful",
      "experience",
      "perspective"
    ],
    negativeKeywords: ["meme", "rage bait", "hot take", "low effort"]
  }
]

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    provider_type: "openai_compatible",
    display_name: "OpenAI-compatible",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    requests_per_minute: 6,
    max_batch_size: 5
  },
  {
    provider_type: "openrouter",
    display_name: "OpenRouter-compatible",
    base_url: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    requests_per_minute: 6,
    max_batch_size: 5
  },
  {
    provider_type: "groq",
    display_name: "Groq-compatible",
    base_url: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    requests_per_minute: 6,
    max_batch_size: 5
  },
  {
    provider_type: "gemini",
    display_name: "Gemini OpenAI-compatible",
    base_url: "",
    model: "gemini-1.5-flash",
    requests_per_minute: 6,
    max_batch_size: 5
  },
  {
    provider_type: "ollama",
    display_name: "Ollama/local OpenAI-compatible",
    base_url: "http://localhost:11434/v1",
    model: "llama3.1",
    requests_per_minute: 12,
    max_batch_size: 5
  }
]

export function getWatcherTemplate(
  templateType: WatcherTemplateType
): WatcherTemplate | undefined {
  return WATCHER_TEMPLATES.find((template) => template.type === templateType)
}
