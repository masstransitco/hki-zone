"use client"

import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "./language-provider"

interface ShareButtonProps {
  articleId: string
}

export default function ShareButton({ articleId }: ShareButtonProps) {
  const { t } = useLanguage()

  const handleShare = async () => {
    const url = `${window.location.origin}/article/${articleId}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this article",
          url: url,
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="flex items-center gap-2 hover:bg-[rgb(var(--apple-gray-6))] dark:hover:bg-[rgb(var(--apple-gray-5))] rounded-lg apple-focus text-[rgb(var(--apple-blue))]"
    >
      <Share2 className="w-4 h-4" />
      <span className="text-body font-medium">{t("article.share")}</span>
    </Button>
  )
}
