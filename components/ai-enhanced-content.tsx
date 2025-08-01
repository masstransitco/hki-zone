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

  // Helper function to clean and process citations within text
  const processCitations = (text: string): React.ReactNode[] => {
    if (!text) return [text]

    // Clean up malformed citation patterns first
    let cleanedText = text
      // Remove patterns like [1].[1] -> [1]
      .replace(/(\[\d+\])\.(\[\d+\])/g, '$1')
      // Remove patterns like [1][5].[2] -> [1][5]
      .replace(/(\[\d+(?:\]\[\d+)*\])\.(\[\d+\])/g, '$1')
      // Clean up trailing citation fragments like ".[1]" at end of sentences
      .replace(/\.(\[\d+\])$/g, '$1')

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    
    // Regex to match citations (including multiple consecutive ones like [1][2])
    const citationRegex = /\[(\d+)\]/g
    let match
    
    while ((match = citationRegex.exec(cleanedText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(cleanedText.slice(lastIndex, match.index))
      }
      
      if (sources && sources.length > 0) {
        const citationNumber = parseInt(match[1])
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
        }
        // If source not found, skip rendering the citation entirely
      }
      // If no sources available, skip rendering the citation entirely
      
      lastIndex = citationRegex.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < cleanedText.length) {
      parts.push(cleanedText.slice(lastIndex))
    }
    
    return parts
  }

  // Helper function to process citations and markdown formatting in text
  const processTextWithCitations = (text: string) => {
    if (!text) return text

    const parts = []
    let lastIndex = 0
    
    // Regex to match **bold** text
    const boldRegex = /\*\*(.*?)\*\*/g
    let match
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index)
        parts.push(...processCitations(beforeText))
      }
      
      // Process bold text content for nested citations
      const boldContent = processCitations(match[1])
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold">
          {boldContent}
        </strong>
      )
      
      lastIndex = boldRegex.lastIndex
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex)
      parts.push(...processCitations(remainingText))
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