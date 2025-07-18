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

    // Topics Feed
    "topics.aiEnhancedFeed": "AI-Enhanced Articles",
    "topics.aiEnhancedDescription": "Articles enhanced with AI analysis and additional research",
    "topics.noAiArticles": "No AI-enhanced articles available",
    "topics.noAiArticlesDescription": "AI-enhanced articles in your selected language are not available yet. Please check back later.",

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

    // Journey Time
    "journey.title": "Journey Times",
    "journey.subtitle": "Real-time traffic conditions and journey times across Hong Kong",
    "journey.roadType": "Road Type",
    "journey.expressway": "Expressway",
    "journey.trunk": "Major Road",
    "journey.local": "Local Road",
    "journey.temp": "Temporary",
    "journey.enabled": "Enabled",
    "journey.available": "Available",
    "journey.notAvailable": "Not available",
    "journey.notAvailableForRoute": "Not available for this route",
    "journey.noRoutes": "No routes available for selected road types",
    "journey.noData": "No journey time data available",
    "journey.tryDifferent": "Try enabling different road types or selecting different regions",
    "journey.lastUpdated": "Last updated:",
    "journey.dataStale": "Data may be stale",
    "journey.errorLoading": "Error loading journey time data",
    "journey.tryAgain": "Try Again",
    "journey.min": "min",
    "journey.faster": "faster",
    "journey.slower": "slower",
    "journey.route": "Route",
    "journey.updatedAt": "Updated at",
    "journey.thanUsual": "than usual",
    "regions.hk": "Hong Kong Island",
    "regions.kln": "Kowloon",
    "regions.nt": "New Territories",

    // Loading and errors
    loading: "Loading...",
    "error.failedToLoad": "Failed to load",
    "error.articleNotFound": "Article not found",
    "error.failedToFetch": "Failed to fetch",

    // Category Menu
    "categories.selectCategory": "Select Category",
    "categories.roads.label": "Roads",
    "categories.roads.description": "Traffic & journey times",
    "categories.park.label": "Park",
    "categories.park.description": "Parks & recreation",
    "categories.police.label": "Police",
    "categories.police.description": "Police stations & services",
    "categories.ae.label": "A&E",
    "categories.ae.description": "Hospital wait times",
    "categories.weather.label": "Weather",
    "categories.weather.description": "Current & forecast",
    "categories.postbox.label": "Postbox",
    "categories.postbox.description": "Postal services",
    "categories.trashbin.label": "Trashbin",
    "categories.trashbin.description": "Waste management",
    "categories.comingSoon": "Coming Soon",
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

    // Topics Feed
    "topics.aiEnhancedFeed": "AI 增强文章",
    "topics.aiEnhancedDescription": "通过 AI 分析和额外研究增强的文章",
    "topics.noAiArticles": "暂无 AI 增强文章",
    "topics.noAiArticlesDescription": "您选择的语言暂时没有 AI 增强文章。请稍后再试。",

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

    // Journey Time
    "journey.title": "行程时间",
    "journey.subtitle": "香港实时交通状况和行程时间",
    "journey.roadType": "道路类型",
    "journey.expressway": "高速公路",
    "journey.trunk": "主要道路",
    "journey.local": "本地道路",
    "journey.temp": "临时路线",
    "journey.enabled": "已启用",
    "journey.available": "可用",
    "journey.notAvailable": "不可用",
    "journey.notAvailableForRoute": "此路线不可用",
    "journey.noRoutes": "所选道路类型无可用路线",
    "journey.noData": "无行程时间数据",
    "journey.tryDifferent": "请尝试启用不同的道路类型或选择不同的地区",
    "journey.lastUpdated": "最后更新：",
    "journey.dataStale": "数据可能过时",
    "journey.errorLoading": "加载行程时间数据时出错",
    "journey.tryAgain": "重试",
    "journey.min": "分钟",
    "journey.faster": "更快",
    "journey.slower": "更慢",
    "journey.route": "路线",
    "journey.updatedAt": "更新于",
    "journey.thanUsual": "比平常",
    "regions.hk": "香港岛",
    "regions.kln": "九龙",
    "regions.nt": "新界",

    // Loading and errors
    loading: "加载中...",
    "error.failedToLoad": "加载失败",
    "error.articleNotFound": "文章未找到",
    "error.failedToFetch": "获取失败",

    // Category Menu
    "categories.selectCategory": "选择分类",
    "categories.roads.label": "道路",
    "categories.roads.description": "交通与行程时间",
    "categories.park.label": "公园",
    "categories.park.description": "公园与娱乐",
    "categories.police.label": "警察",
    "categories.police.description": "警察局与服务",
    "categories.ae.label": "急诊科",
    "categories.ae.description": "医院等候时间",
    "categories.weather.label": "天气",
    "categories.weather.description": "当前与预报",
    "categories.postbox.label": "邮箱",
    "categories.postbox.description": "邮政服务",
    "categories.trashbin.label": "垃圾桶",
    "categories.trashbin.description": "废物管理",
    "categories.comingSoon": "即将推出",
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

    // Topics Feed
    "topics.aiEnhancedFeed": "AI 增強文章",
    "topics.aiEnhancedDescription": "通過 AI 分析和額外研究增強的文章",
    "topics.noAiArticles": "暫無 AI 增強文章",
    "topics.noAiArticlesDescription": "您選擇的語言暫時沒有 AI 增強文章。請稍後再試。",

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

    // Journey Time
    "journey.title": "行程時間",
    "journey.subtitle": "香港實時交通狀況和行程時間",
    "journey.roadType": "道路類型",
    "journey.expressway": "高速公路",
    "journey.trunk": "主要道路",
    "journey.local": "本地道路",
    "journey.temp": "臨時路線",
    "journey.enabled": "已啟用",
    "journey.available": "可用",
    "journey.notAvailable": "不可用",
    "journey.notAvailableForRoute": "此路線不可用",
    "journey.noRoutes": "所選道路類型無可用路線",
    "journey.noData": "無行程時間數據",
    "journey.tryDifferent": "請嘗試啟用不同的道路類型或選擇不同的地區",
    "journey.lastUpdated": "最後更新：",
    "journey.dataStale": "數據可能過時",
    "journey.errorLoading": "載入行程時間數據時出錯",
    "journey.tryAgain": "重試",
    "journey.min": "分鐘",
    "journey.faster": "更快",
    "journey.slower": "更慢",
    "journey.route": "路線",
    "journey.updatedAt": "更新於",
    "journey.thanUsual": "比平常",
    "regions.hk": "香港島",
    "regions.kln": "九龍",
    "regions.nt": "新界",

    // Loading and errors
    loading: "載入中...",
    "error.failedToLoad": "載入失敗",
    "error.articleNotFound": "文章未找到",
    "error.failedToFetch": "獲取失敗",

    // Category Menu
    "categories.selectCategory": "選擇分類",
    "categories.roads.label": "道路",
    "categories.roads.description": "交通與行程時間",
    "categories.park.label": "公園",
    "categories.park.description": "公園與娛樂",
    "categories.police.label": "警察",
    "categories.police.description": "警察局與服務",
    "categories.ae.label": "急診科",
    "categories.ae.description": "醫院等候時間",
    "categories.weather.label": "天氣",
    "categories.weather.description": "當前與預報",
    "categories.postbox.label": "郵箱",
    "categories.postbox.description": "郵政服務",
    "categories.trashbin.label": "垃圾桶",
    "categories.trashbin.description": "廢物管理",
    "categories.comingSoon": "即將推出",
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
