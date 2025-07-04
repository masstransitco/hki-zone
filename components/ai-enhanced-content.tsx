"use client"

import { parseAIEnhancedContent, type ParsedArticleContent } from "@/lib/content-parser"
import { useLanguage } from "./language-provider"

interface AIEnhancedContentProps {
  content: string
  isBottomSheet?: boolean
}

export default function AIEnhancedContent({ content, isBottomSheet = false }: AIEnhancedContentProps) {
  const { t } = useLanguage()
  const parsed = parseAIEnhancedContent(content)

  const textSizeClass = isBottomSheet 
    ? "text-base md:text-lg" 
    : "text-lg md:text-xl"

  const headingSizeClass = isBottomSheet 
    ? "text-lg font-semibold" 
    : "text-xl font-semibold"

  if (!parsed.hasStructuredContent) {
    // Render regular content for non-AI enhanced articles
    return (
      <div className={`${textSizeClass} text-foreground leading-loose whitespace-pre-wrap font-normal`}>
        {content}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Main Content */}
      {parsed.mainContent && (
        <div className={`${textSizeClass} text-foreground leading-loose whitespace-pre-wrap font-normal`}>
          {parsed.mainContent}
        </div>
      )}

      {/* Summary Section */}
      {parsed.summary && (
        <div className="space-y-4">
          <h3 className={`${headingSizeClass} text-foreground`}>
            {t("article.summary") || "Summary"}
          </h3>
          <div className={`${textSizeClass} text-foreground leading-loose font-normal`}>
            {parsed.summary}
          </div>
        </div>
      )}

      {/* Key Points Section */}
      {parsed.keyPoints && parsed.keyPoints.length > 0 && (
        <div className="space-y-4">
          <h3 className={`${headingSizeClass} text-foreground`}>
            {t("article.keyPoints") || "Key Points"}
          </h3>
          <ul className="space-y-3">
            {parsed.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary mt-0.5">
                  {index + 1}
                </span>
                <span className={`${textSizeClass} text-foreground leading-loose font-normal flex-1`}>
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Why It Matters Section */}
      {parsed.whyItMatters && (
        <div className="space-y-4">
          <h3 className={`${headingSizeClass} text-foreground`}>
            {t("article.whyItMatters") || "Why It Matters"}
          </h3>
          <div className={`${textSizeClass} text-foreground leading-loose font-normal`}>
            {parsed.whyItMatters}
          </div>
        </div>
      )}
    </div>
  )
}