"use client"

import { Button } from "@/components/ui/button"
import { Share2, Check } from "lucide-react"
import { useState } from "react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"

interface ShareButtonProps {
  articleId: string
  title: string
  url?: string
}

export default function ShareButton({ articleId, title, url }: ShareButtonProps) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  const shareUrl = url || `${window.location.origin}/article/${articleId}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: shareUrl,
        })
        analytics.trackArticleShare(articleId, "native")
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copying to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        analytics.trackArticleShare(articleId, "copy")
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error("Failed to copy to clipboard:", error)
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          <span className="hidden sm:inline">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t("article.share")}</span>
        </>
      )}
    </Button>
  )
}
