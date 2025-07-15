"use client"

import { parseAIEnhancedContent, type ParsedArticleContent } from "@/lib/content-parser"
import { useLanguage } from "./language-provider"

interface AIEnhancedContentProps {
  content: string
  isBottomSheet?: boolean
  sources?: Array<{
    url: string
    title: string
    domain: string
    snippet?: string
    accessedAt: string
  }>
}

export default function AIEnhancedContent({ content, isBottomSheet = false, sources }: AIEnhancedContentProps) {
  const { t } = useLanguage()
  
  const textSizeClass = isBottomSheet 
    ? "text-base md:text-lg" 
    : "text-lg md:text-xl"

  const headingSizeClass = isBottomSheet 
    ? "text-lg font-semibold" 
    : "text-xl font-semibold"

  // Helper function to process citations and markdown formatting in text
  const processTextWithCitations = (text: string) => {
    if (!text) return text

    const parts = []
    let lastIndex = 0
    
    // Combined regex to match both **bold** text and [citations]
    const combinedRegex = /\*\*(.*?)\*\*|\[(\d+)\]/g
    let match
    
    while ((match = combinedRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      
      if (match[1] !== undefined) {
        // This is bold text - render with strong tag
        parts.push(
          <strong key={`bold-${match.index}`} className="font-semibold">
            {match[1]}
          </strong>
        )
      } else if (match[2] !== undefined && sources && sources.length > 0) {
        // This is a citation
        const citationNumber = parseInt(match[2])
        const sourceIndex = citationNumber - 1
        
        if (sourceIndex >= 0 && sourceIndex < sources.length) {
          const source = sources[sourceIndex]
          parts.push(
            <button
              key={`citation-${citationNumber}-${match.index}`}
              className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors cursor-pointer mx-0.5"
              onClick={(e) => {
                e.stopPropagation()
                if (source.url) {
                  window.open(source.url, '_blank', 'noopener,noreferrer')
                }
              }}
              title={`Source ${citationNumber}: ${source.title}`}
            >
              {citationNumber}
            </button>
          )
        } else {
          // If source not found, just show the original citation
          parts.push(match[0])
        }
      } else if (match[2] !== undefined) {
        // Citation without sources, show as plain text
        parts.push(match[0])
      }
      
      lastIndex = combinedRegex.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    
    return parts.length > 0 ? <>{parts}</> : text
  }

  // Check if content is HTML
  const isHTML = content.includes('<p>') || content.includes('<div>') || content.includes('<h')
  
  if (isHTML) {
    // Render HTML content directly
    return (
      <div 
        className={`${textSizeClass} text-foreground leading-loose font-normal prose prose-neutral dark:prose-invert max-w-none`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }
  
  const parsed = parseAIEnhancedContent(content)

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
      {/* Summary Section */}
      {parsed.summary && (
        <div className="space-y-4">
          <h3 className={`${headingSizeClass} text-foreground`}>
            {t("article.summary") || "Summary"}
          </h3>
          <div className={`${textSizeClass} text-foreground leading-loose font-normal`}>
            {processTextWithCitations(parsed.summary)}
          </div>
        </div>
      )}

      {/* Key Points Section */}
      {parsed.keyPoints && parsed.keyPoints.length > 0 && (
        <div className="space-y-4">
          <h3 className={`${headingSizeClass} text-foreground`}>
            {t("article.keyPoints") || "Key Points"}
          </h3>
          <ul className="space-y-2">
            {parsed.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></span>
                <span className={`${textSizeClass} text-foreground leading-loose font-normal flex-1`}>
                  {processTextWithCitations(point)}
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
            {processTextWithCitations(parsed.whyItMatters)}
          </div>
        </div>
      )}

      {/* Main Content - shown after structured sections */}
      {parsed.mainContent && (
        <div className={`${textSizeClass} text-foreground leading-loose whitespace-pre-wrap font-normal`}>
          {processTextWithCitations(parsed.mainContent)}
        </div>
      )}
    </div>
  )
}