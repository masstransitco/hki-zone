"use client"

import { Button } from "@/components/ui/button"
import { Share2, Check } from "lucide-react"
import { useState, useEffect } from "react"
import { useLanguage } from "./language-provider"
import { analytics } from "@/lib/analytics"
import type { Article } from "@/lib/types"

interface ShareButtonProps {
  articleId: string
  title?: string
  url?: string
  article?: Article
  compact?: boolean
}

export default function ShareButton({ articleId, title, url, article, compact = false }: ShareButtonProps) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [articleData, setArticleData] = useState<Article | null>(article || null)

  const shareUrl = url || `${typeof window !== 'undefined' ? window.location.origin : 'https://hki.zone'}/article/${articleId}`
  const shareTitle = title || articleData?.title || "HKI 香港資訊 Article"
  const shareDescription = articleData?.summary || articleData?.content?.substring(0, 200) || "Read the latest Hong Kong news"

  // Fetch article data if not provided
  useEffect(() => {
    if (!articleData && !article) {
      const fetchArticleData = async () => {
        try {
          const response = await fetch(`/api/articles/${articleId}`)
          if (response.ok) {
            const data = await response.json()
            setArticleData(data)
          }
        } catch (error) {
          console.error('Failed to fetch article data for sharing:', error)
        }
      }
      fetchArticleData()
    }
  }, [articleId, article, articleData])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const shareData = {
          title: shareTitle,
          text: shareDescription,
          url: shareUrl,
        }
        
        await navigator.share(shareData)
        analytics.trackArticleShare(articleId, "native")
      } catch (error) {
        // User cancelled sharing or sharing failed
        console.log('Share cancelled or failed:', error)
      }
    } else {
      // Fallback to copying to clipboard
      try {
        const shareText = `${shareTitle}\n\n${shareDescription}\n\n${shareUrl}`
        await navigator.clipboard.writeText(shareText)
        setCopied(true)
        analytics.trackArticleShare(articleId, "copy")
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        // Fallback to simple URL copy
        try {
          await navigator.clipboard.writeText(shareUrl)
          setCopied(true)
          analytics.trackArticleShare(articleId, "copy")
          setTimeout(() => setCopied(false), 2000)
        } catch (fallbackError) {
          console.error("Failed to copy to clipboard:", fallbackError)
        }
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size={compact ? "sm" : "sm"}
      onClick={handleShare}
      className={`gap-2 text-muted-foreground hover:text-foreground hover:bg-muted ${
        compact ? "h-10 w-10 p-0" : ""
      }`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Copied!</span>}
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">{t("article.share")}</span>}
        </>
      )}
    </Button>
  )
}