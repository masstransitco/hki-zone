"use client"

import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"

export function TestLanguageRedux() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Language Test Component</h3>
      <p>Current language: <strong>{language}</strong></p>
      <p>Test translation: {t("app.title")}</p>
      <div className="flex gap-2">
        <Button onClick={() => setLanguage("en")} variant={language === "en" ? "default" : "outline"}>
          English
        </Button>
        <Button onClick={() => setLanguage("zh-CN")} variant={language === "zh-CN" ? "default" : "outline"}>
          简体中文
        </Button>
        <Button onClick={() => setLanguage("zh-TW")} variant={language === "zh-TW" ? "default" : "outline"}>
          繁體中文
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>Navigation: {t("nav.home")} | {t("nav.topics")} | {t("nav.bookmarks")}</p>
      </div>
    </div>
  )
}