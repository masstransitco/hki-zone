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

  // Remove sources section - handle multiple formats
  let cleanedContent = content
    // Remove "## Sources" sections (Perplexity format)
    .replace(/\n\n?## Sources\n\n[\s\S]*$/i, '')
    // Remove "Sources:" sections  
    .replace(/\n\n?Sources?:\s*\n[\s\S]*$/i, '')
    // Remove "**Sources**" sections
    .replace(/\n\n?\*\*Sources?\*\*\n[\s\S]*$/i, '')
    // Remove numbered citations at end (1. [Title](url) format)
    .replace(/\n\n?(?:\d+\.\s+\[.*?\]\(.*?\).*\n?)+$/i, '')
    // Remove citation lists that start with numbers
    .replace(/\n\n?(?:\d+\.\s+.*\n?){2,}$/i, '')

  // Debug logging for development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🔍 Parsing content:', { 
      length: cleanedContent.length,
      preview: cleanedContent.substring(0, 200) + '...'
    })
  }

  // Check if content has structured format (English or Chinese)
  const hasStructuredSections = /\*\*(Summary|Key Points?|Key Context|Why It Matters?|摘要|重点|重點|重要性)\*\*/i.test(cleanedContent)
  
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
  const firstSectionMatch = cleanedContent.match(/^\*\*(Summary|摘要)\*\*/i)
  const isPerplexityFormat = firstSectionMatch !== null

  if (isPerplexityFormat) {
    // For Perplexity format, extract structured sections first, then get main content
    const structuredEndMatch = cleanedContent.match(/\*\*(Why It Matters?|重要性)\*\*[\s\S]*?\n\n/i)
    if (structuredEndMatch) {
      const structuredEndIndex = structuredEndMatch.index! + structuredEndMatch[0].length
      mainContent = cleanedContent.substring(structuredEndIndex).trim()
      
      // Remove the duplicate summary that sometimes appears at the start of main content
      if (summary && mainContent.startsWith(summary)) {
        mainContent = mainContent.substring(summary.length).trim()
      }
    }
  }

  // Split content by structured sections (English or Chinese)
  const sections = cleanedContent.split(/\*\*(Summary|Key Points?|Key Context|Why It Matters?|摘要|重点|重點|重要性)\*\*/i)
  
  // If not Perplexity format, first section is main content
  if (!isPerplexityFormat && sections[0]) {
    mainContent = sections[0].trim()
  }

  // Parse structured sections
  for (let i = 1; i < sections.length; i += 2) {
    const sectionTitle = sections[i]?.toLowerCase().trim()
    const sectionContent = sections[i + 1]?.trim()

    if (!sectionContent) continue

    // Debug logging
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('📑 Section found:', { title: sectionTitle, contentLength: sectionContent.length })
    }

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