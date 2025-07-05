"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

type Language = "en" | "zh-CN" | "zh-TW"

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translation dictionaries
const translations = {
  en: {
    // Header
    "app.title": "Panora",
    "nav.search": "Search",

    // Navigation
    "nav.home": "Home",
    "nav.topics": "Topics",
    "nav.profile": "Profile",

    // Topics
    "topics.all": "All",
    "topics.technology": "Technology",
    "topics.finance": "Finance",
    "topics.health": "Health",
    "topics.politics": "Politics",
    "topics.science": "Science",
    "topics.sports": "Sports",
    "topics.entertainment": "Entertainment",
    "topics.business": "Business",
    "topics.world": "World",

    // Article
    "article.readMore": "Read More",
    "article.back": "Back",
    "article.share": "Share",
    "article.readOriginal": "Read original article",
    "article.aiSummary": "AI Summary",
    "article.fullArticle": "Full Article",
    "article.summary": "Summary",
    "article.keyPoints": "Key Points",
    "article.whyItMatters": "Why It Matters",

    // Search
    "search.placeholder": "Search articles...",
    "search.suggestions": "Suggested searches",
    "search.results": "results for",
    "search.noResults": "No articles found for",
    "search.searching": "Searching...",

    // Discovery
    "discovery.trending": "Trending Now",
    "discovery.recommended": "Recommended for You",
    "discovery.recent": "Recently Added",

    // Profile
    "profile.saved": "Saved",
    "profile.history": "History",
    "profile.settings": "Settings",
    "profile.savedArticles": "Saved Articles",
    "profile.readingHistory": "Reading History",
    "profile.appearance": "Appearance",
    "profile.darkMode": "Dark Mode",
    "profile.fontSize": "Font Size",
    "profile.notifications": "Notifications",
    "profile.pushNotifications": "Push Notifications",
    "profile.signOut": "Sign Out",
    "profile.language": "Language",

    // Font sizes
    "fontSize.small": "Small",
    "fontSize.medium": "Medium",
    "fontSize.large": "Large",

    // Languages
    "language.en": "English",
    "language.zh-CN": "简体中文",
    "language.zh-TW": "繁體中文",

    // Time
    "time.ago": "ago",
    "time.minute": "minute",
    "time.minutes": "minutes",
    "time.hour": "hour",
    "time.hours": "hours",
    "time.day": "day",
    "time.days": "days",

    // Loading and errors
    loading: "Loading...",
    "error.failedToLoad": "Failed to load",
    "error.articleNotFound": "Article not found",
    "error.failedToFetch": "Failed to fetch",
  },
  "zh-CN": {
    // Header
    "app.title": "秒知",
    "nav.search": "搜索",

    // Navigation
    "nav.home": "首页",
    "nav.topics": "话题",
    "nav.profile": "个人",

    // Topics
    "topics.all": "全部",
    "topics.technology": "科技",
    "topics.finance": "金融",
    "topics.health": "健康",
    "topics.politics": "政治",
    "topics.science": "科学",
    "topics.sports": "体育",
    "topics.entertainment": "娱乐",
    "topics.business": "商业",
    "topics.world": "国际",

    // Article
    "article.readMore": "阅读更多",
    "article.back": "返回",
    "article.share": "分享",
    "article.readOriginal": "阅读原文",
    "article.aiSummary": "AI 摘要",
    "article.fullArticle": "完整文章",
    "article.summary": "摘要",
    "article.keyPoints": "要点",
    "article.whyItMatters": "为什么重要",

    // Search
    "search.placeholder": "搜索文章...",
    "search.suggestions": "推荐搜索",
    "search.results": "个结果",
    "search.noResults": "未找到相关文章",
    "search.searching": "搜索中...",

    // Discovery
    "discovery.trending": "热门话题",
    "discovery.recommended": "为您推荐",
    "discovery.recent": "最新添加",

    // Profile
    "profile.saved": "收藏",
    "profile.history": "历史",
    "profile.settings": "设置",
    "profile.savedArticles": "收藏文章",
    "profile.readingHistory": "阅读历史",
    "profile.appearance": "外观",
    "profile.darkMode": "深色模式",
    "profile.fontSize": "字体大小",
    "profile.notifications": "通知",
    "profile.pushNotifications": "推送通知",
    "profile.signOut": "退出登录",
    "profile.language": "语言",

    // Font sizes
    "fontSize.small": "小",
    "fontSize.medium": "中",
    "fontSize.large": "大",

    // Languages
    "language.en": "English",
    "language.zh-CN": "简体中文",
    "language.zh-TW": "繁體中文",

    // Time
    "time.ago": "前",
    "time.minute": "分钟",
    "time.minutes": "分钟",
    "time.hour": "小时",
    "time.hours": "小时",
    "time.day": "天",
    "time.days": "天",

    // Loading and errors
    loading: "加载中...",
    "error.failedToLoad": "加载失败",
    "error.articleNotFound": "文章未找到",
    "error.failedToFetch": "获取失败",
  },
  "zh-TW": {
    // Header
    "app.title": "秒知",
    "nav.search": "搜尋",

    // Navigation
    "nav.home": "首頁",
    "nav.topics": "話題",
    "nav.profile": "個人",

    // Topics
    "topics.all": "全部",
    "topics.technology": "科技",
    "topics.finance": "金融",
    "topics.health": "健康",
    "topics.politics": "政治",
    "topics.science": "科學",
    "topics.sports": "體育",
    "topics.entertainment": "娛樂",
    "topics.business": "商業",
    "topics.world": "國際",

    // Article
    "article.readMore": "閱讀更多",
    "article.back": "返回",
    "article.share": "分享",
    "article.readOriginal": "閱讀原文",
    "article.aiSummary": "AI 摘要",
    "article.fullArticle": "完整文章",
    "article.summary": "摘要",
    "article.keyPoints": "要點",
    "article.whyItMatters": "為什麼重要",

    // Search
    "search.placeholder": "搜尋文章...",
    "search.suggestions": "推薦搜尋",
    "search.results": "個結果",
    "search.noResults": "未找到相關文章",
    "search.searching": "搜尋中...",

    // Discovery
    "discovery.trending": "熱門話題",
    "discovery.recommended": "為您推薦",
    "discovery.recent": "最新添加",

    // Profile
    "profile.saved": "收藏",
    "profile.history": "歷史",
    "profile.settings": "設定",
    "profile.savedArticles": "收藏文章",
    "profile.readingHistory": "閱讀歷史",
    "profile.appearance": "外觀",
    "profile.darkMode": "深色模式",
    "profile.fontSize": "字體大小",
    "profile.notifications": "通知",
    "profile.pushNotifications": "推送通知",
    "profile.signOut": "登出",
    "profile.language": "語言",

    // Font sizes
    "fontSize.small": "小",
    "fontSize.medium": "中",
    "fontSize.large": "大",

    // Languages
    "language.en": "English",
    "language.zh-CN": "简体中文",
    "language.zh-TW": "繁體中文",

    // Time
    "time.ago": "前",
    "time.minute": "分鐘",
    "time.minutes": "分鐘",
    "time.hour": "小時",
    "time.hours": "小時",
    "time.day": "天",
    "time.days": "天",

    // Loading and errors
    loading: "載入中...",
    "error.failedToLoad": "載入失敗",
    "error.articleNotFound": "文章未找到",
    "error.failedToFetch": "獲取失敗",
  },
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always start with English to ensure SSR consistency
  const [language, setLanguageState] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Only run on client side after hydration
    const savedLanguage = localStorage.getItem("panora-language") as Language
    if (savedLanguage && ["en", "zh-CN", "zh-TW"].includes(savedLanguage)) {
      setLanguageState(savedLanguage)
    }
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    if (typeof window !== 'undefined') {
      localStorage.setItem("panora-language", newLanguage)
    }
  }

  const t = (key: string): string => {
    // During SSR and initial hydration, always use English to prevent mismatches
    const effectiveLanguage = mounted ? language : "en"
    return translations[effectiveLanguage][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
