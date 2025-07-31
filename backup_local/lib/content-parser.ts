/**
 * Utility functions for parsing and cleaning AI enhanced article content
 */

export interface ParsedArticleContent {
  summary?: string
  keyPoints?: string[]
  whyItMatters?: string
  mainContent: string
  hasStructuredContent: boolean
}

/**
 * Parses AI enhanced article content and extracts structured sections
 */
export function parseAIEnhancedContent(content: string): ParsedArticleContent {
  if (!content) {
    return {
      mainContent: '',
      hasStructuredContent: false
    }
  }

  // Remove sources section - handle multiple formats (targeted patterns)
  let cleanedContent = content
    // Remove "## Sources" sections (Perplexity format) - at end only
    .replace(/\n\n?##\s*Sources\s*\n[\s\S]*$/i, '')
    // Remove "## SOURCES" sections (uppercase) - at end only
    .replace(/\n\n?##\s*SOURCES\s*\n[\s\S]*$/i, '')
    // Remove "**Sources:**" sections with [n] domain.com format (from user example)
    .replace(/\n\n?\*\*Sources?:\*\*\s*\n(?:\[\d+\]\s+[\w.-]+\.[\w.-]+\s*\n?)+$/i, '')
    // Remove "**Sources**" sections (without colon)
    .replace(/\n\n?\*\*Sources?\*\*\n[\s\S]*$/i, '')
    // Remove simple "Sources:" sections at the very end
    .replace(/\n+Sources?:\s*\n(?:\d+\s+[\w.-]+\.[\w.-]+\s*\n?)+$/i, '')
    // Remove numbered citations at end (1. [Title](url) format)
    .replace(/\n\n?(?:\d+\.\s+\[.*?\]\(.*?\).*\n?)+$/i, '')

  // Debug logging for development
  // Content parsing debug (removed for cleaner console)

  // Check if content has structured format (English or Chinese) - handle both ** and ## formats
  const hasStructuredSections = /(\*\*(Summary|Key Points?|Key Context|Why It Matters?|摘要|重点|重點|重要性)\*\*|##\s*(SUMMARY|KEY POINTS?|KEY CONTEXT|WHY IT MATTERS?|摘要|重点|重點|重要性))/i.test(cleanedContent)
  
  if (!hasStructuredSections) {
    return {
      mainContent: cleanedContent.trim(),
      hasStructuredContent: false
    }
  }

  let summary: string | undefined
  let keyPoints: string[] | undefined
  let whyItMatters: string | undefined
  let mainContent = ''

  // Check if this is a Perplexity-style article where structured content comes first
  const firstSectionMatch = cleanedContent.match(/^(\*\*(Summary|摘要)\*\*|##\s*(SUMMARY|摘要))/i)
  const isPerplexityFormat = firstSectionMatch !== null

  if (isPerplexityFormat) {
    // For Perplexity format, extract structured sections first, then get main content
    const structuredEndMatch = cleanedContent.match(/(\*\*(Why It Matters?|重要性)\*\*|##\s*(WHY IT MATTERS?|重要性))[\s\S]*?\n\n/i)
    if (structuredEndMatch) {
      const structuredEndIndex = structuredEndMatch.index! + structuredEndMatch[0].length
      mainContent = cleanedContent.substring(structuredEndIndex).trim()
      
      // Remove the duplicate summary that sometimes appears at the start of main content
      if (summary && mainContent.startsWith(summary)) {
        mainContent = mainContent.substring(summary.length).trim()
      }
    }
  }

  // Parse structured sections using a more reliable approach
  // First, normalize the content by converting ## headers to ** format (excluding Sources)
  let normalizedContent = cleanedContent
    .replace(/##\s*(SUMMARY|KEY POINTS?|KEY CONTEXT|WHY IT MATTERS?|摘要|重点|重點|重要性)/gi, '**$1**')

  // Split content by structured sections (English or Chinese)
  const sections = normalizedContent.split(/\*\*(Summary|Key Points?|Key Context|Why It Matters?|摘要|重点|重點|重要性)\*\*/i)
  
  // If not Perplexity format, first section is main content
  if (!isPerplexityFormat && sections[0]) {
    mainContent = sections[0].trim()
  }

  // Parse structured sections
  for (let i = 1; i < sections.length; i += 2) {
    const sectionTitle = sections[i]?.toLowerCase().trim()
    const sectionContent = sections[i + 1]?.trim()

    if (!sectionContent || !sectionTitle) continue

    // Section parsing debug (removed for cleaner console)

    switch (sectionTitle) {
      case 'summary':
      case '摘要':
        summary = sectionContent
        break
      case 'key points':
      case 'key point':
      case 'key context':
      case '重点':
      case '重點':
        // Parse bullet points or numbered lists
        keyPoints = sectionContent
          .split(/\n/)
          .map(point => point.replace(/^[-•*]\s*|^\d+\.\s*/, '').trim())
          .filter(point => point.length > 0)
        break
      case 'why it matters':
      case 'why it matter':
      case '重要性':
        whyItMatters = sectionContent
        break
    }
  }

  return {
    summary,
    keyPoints,
    whyItMatters,
    mainContent: mainContent.trim(),
    hasStructuredContent: true
  }
}

/**
 * Removes markdown formatting from text
 */
export function removeMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/__(.*?)__/g, '$1')     // Bold alternative
    .replace(/_(.*?)_/g, '$1')       // Italic alternative
    .trim()
}