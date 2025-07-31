import { track } from "@vercel/analytics"

export const analytics = {
  // Generic track method for direct usage
  track: (event: string, properties?: Record<string, any>) => {
    track(event, properties)
  },

  // Article interactions
  trackArticleView: (articleId: string, source: string, topic?: string) => {
    track("article_view", {
      article_id: articleId,
      source,
      topic: topic || "unknown",
    })
  },

  trackArticleShare: (articleId: string, method: "copy" | "native") => {
    track("article_share", {
      article_id: articleId,
      method,
    })
  },

  // Search behavior
  trackSearch: (query: string, resultCount: number) => {
    track("search", {
      query,
      result_count: resultCount,
    })
  },

  // Topic selection
  trackTopicSelect: (topic: string) => {
    track("topic_select", {
      topic,
    })
  },

  // User preferences
  trackLanguageChange: (from: string, to: string) => {
    track("language_change", {
      from_language: from,
      to_language: to,
    })
  },

  trackThemeChange: (theme: string) => {
    track("theme_change", {
      theme,
    })
  },

  // Admin actions
  trackManualScrape: () => {
    track("manual_scrape")
  },

  trackDatabaseSetup: () => {
    track("database_setup")
  },

  // Session tracking
  trackPageView: (page: string) => {
    track("page_view", {
      page,
    })
  },

  trackSessionDuration: (duration: number) => {
    track("session_duration", {
      duration_seconds: duration,
    })
  },
}
