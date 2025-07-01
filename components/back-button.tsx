"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "./language-provider"

export default function BackButton() {
  const router = useRouter()
  const { t } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="flex items-center gap-2 hover:bg-[rgb(var(--apple-gray-6))] dark:hover:bg-[rgb(var(--apple-gray-5))] rounded-lg apple-focus text-[rgb(var(--apple-blue))]"
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-body font-medium">{t("article.back")}</span>
    </Button>
  )
}
