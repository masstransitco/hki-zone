"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Settings, Bookmark, History, Moon, Type, Bell, Languages } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import ArticleCard from "./article-card"
import LoadingSkeleton from "./loading-skeleton"
import { useLanguage } from "./language-provider"
import type { Article } from "@/lib/types"

interface UserData {
  savedArticles: Article[]
  readingHistory: Article[]
  preferences: {
    darkMode: boolean
    fontSize: "small" | "medium" | "large"
    notifications: boolean
  }
}

async function fetchUserData(): Promise<UserData> {
  const response = await fetch("/api/user/profile")
  if (!response.ok) throw new Error("Failed to fetch user data")
  return response.json()
}

const languages = [
  { code: "en" as const, name: "English", flag: "🇺🇸" },
  { code: "zh-CN" as const, name: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW" as const, name: "繁體中文", flag: "🇹🇼" },
]

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState<"saved" | "history" | "settings">("saved")
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium")
  const [notifications, setNotifications] = useState(true)

  const { data, isLoading, error } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserData,
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <div className="p-4 text-center text-red-500">{t("error.failedToLoad")} profile</div>

  const tabs = [
    { id: "saved", labelKey: "profile.saved", icon: Bookmark },
    { id: "history", labelKey: "profile.history", icon: History },
    { id: "settings", labelKey: "profile.settings", icon: Settings },
  ] as const

  return (
    <div className="p-4">
      <div className="flex items-center justify-center mb-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">U</span>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <div className="flex bg-muted rounded-lg p-1">
          {tabs.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "saved" && (
        <div className="space-y-4">
          <h3 className="font-semibold">{t("profile.savedArticles")}</h3>
          {data?.savedArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <h3 className="font-semibold">{t("profile.readingHistory")}</h3>
          {data?.readingHistory.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">{t("profile.appearance")}</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                <span>{t("profile.darkMode")}</span>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                <span>{t("profile.fontSize")}</span>
              </div>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as "small" | "medium" | "large")}
                className="bg-background border rounded px-2 py-1 text-sm"
              >
                <option value="small">{t("fontSize.small")}</option>
                <option value="medium">{t("fontSize.medium")}</option>
                <option value="large">{t("fontSize.large")}</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4" />
                <span>{t("profile.language")}</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "zh-CN" | "zh-TW")}
                className="bg-background border rounded px-2 py-1 text-sm"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">{t("profile.notifications")}</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span>{t("profile.pushNotifications")}</span>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full bg-transparent">
              {t("profile.signOut")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
