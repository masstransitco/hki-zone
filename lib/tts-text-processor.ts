/**
 * Text processing utilities for preparing news brief content for TTS synthesis
 */

interface ProcessingOptions {
  language: string
  includeDate?: boolean
  briefType?: 'morning' | 'afternoon' | 'evening'
  preservePauses?: boolean
}

/**
 * Process news brief content to make it suitable for TTS synthesis
 * Removes markdown formatting, replaces placeholders, and formats for natural speech
 */
export function processBriefContentForTTS(content: string, options: ProcessingOptions): string {
  let processed = content

  // 1. Replace [insert date] placeholder with actual date
  if (options.includeDate !== false) {
    const today = new Date()
    const dateString = formatDateForSpeech(today, options.language)
    processed = processed.replace(/\[insert date\]/gi, dateString)
  }

  // 2. Remove markdown headers (### Header -> Header)
  processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '$1')

  // 3. Remove horizontal rules (---, ***, ___)
  processed = processed.replace(/^[-*_]{3,}$/gm, '')

  // 4. Remove bold/italic markdown (**text** or __text__ -> text)
  processed = processed.replace(/(\*\*|__)(.*?)\1/g, '$2')
  processed = processed.replace(/(\*|_)(.*?)\1/g, '$2')

  // 5. Remove code blocks and inline code
  processed = processed.replace(/```[\s\S]*?```/g, '')
  processed = processed.replace(/`([^`]+)`/g, '$1')

  // 6. Remove links but keep the text ([text](url) -> text)
  processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 7. Remove bullet points and convert to natural flow
  processed = processed.replace(/^[\s]*[-*+]\s+/gm, '')
  processed = processed.replace(/^[\s]*\d+\.\s+/gm, '')

  // 8. Clean up extra whitespace and blank lines
  processed = processed.replace(/\n{3,}/g, '\n\n')
  processed = processed.replace(/[ \t]+/g, ' ')
  processed = processed.trim()

  // 9. Add natural pauses for better TTS flow
  // Add slight pause after headlines (lines ending with colon)
  processed = processed.replace(/:\s*\n/g, ':\n\n')
  
  // 10. Preserve intentional pauses if requested
  if (options.preservePauses) {
    // Keep ellipsis for dramatic pauses
    processed = processed.replace(/\.\.\./g, '... ')
  }

  // 11. Language-specific processing
  if (options.language === 'zh-TW') {
    // Ensure Cantonese particles are preserved
    // No additional processing needed - the content should already be in spoken Cantonese
  } else if (options.language === 'zh-CN') {
    // Simplified Chinese specific processing if needed
  }
  
  // 12. Ensure proper spacing around punctuation for TTS
  processed = processed.replace(/([.!?])([A-Z])/g, '$1 $2')
  processed = processed.replace(/([，。！？])([一-龥])/g, '$1 $2')

  return processed
}

/**
 * Format date for natural speech in different languages
 */
function formatDateForSpeech(date: Date, language: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }

  switch (language) {
    case 'en':
      // English: "Monday, August 5th, 2025"
      const formatter = new Intl.DateTimeFormat('en-US', options)
      const parts = formatter.formatToParts(date)
      const day = parts.find(p => p.type === 'day')?.value || ''
      const dayWithSuffix = addOrdinalSuffix(parseInt(day))
      
      return parts
        .map(p => p.type === 'day' ? dayWithSuffix : p.value)
        .join('')
        .replace(/,/g, ',') // Ensure proper comma placement

    case 'zh-TW':
      // Cantonese: "二零二五年八月五號 星期一"
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const dayNum = date.getDate()
      const weekday = getCantonesWeekday(date.getDay())
      
      return `${convertToCantonesNumber(year)}年${convertToCantonesNumber(month)}月${convertToCantonesNumber(dayNum)}號 ${weekday}`

    case 'zh-CN':
      // Simplified Chinese: "2025年8月5日 星期一"
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })

    default:
      return date.toLocaleDateString(language, options)
  }
}

/**
 * Add ordinal suffix to numbers (1st, 2nd, 3rd, etc.)
 */
function addOrdinalSuffix(num: number): string {
  const j = num % 10
  const k = num % 100
  
  if (j === 1 && k !== 11) {
    return num + 'st'
  }
  if (j === 2 && k !== 12) {
    return num + 'nd'
  }
  if (j === 3 && k !== 13) {
    return num + 'rd'
  }
  return num + 'th'
}

/**
 * Get Cantonese weekday name
 */
function getCantonesWeekday(dayIndex: number): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[dayIndex]
}

/**
 * Convert numbers to Cantonese spoken form
 */
function convertToCantonesNumber(num: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  
  if (num < 10) {
    return digits[num]
  }
  
  if (num < 100) {
    const tens = Math.floor(num / 10)
    const ones = num % 10
    
    if (tens === 1) {
      return ones === 0 ? '十' : `十${digits[ones]}`
    }
    
    return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`
  }
  
  // For years like 2025
  if (num >= 1000 && num <= 9999) {
    return num.toString().split('').map(d => digits[parseInt(d)]).join('')
  }
  
  return num.toString()
}

/**
 * Extract estimated reading time from processed content
 */
export function estimateReadingTime(content: string, language: string): number {
  // Average words per minute for different languages
  const wordsPerMinute = {
    'en': 150,
    'zh-TW': 200, // Cantonese tends to be spoken faster
    'zh-CN': 180
  }

  const wpm = wordsPerMinute[language] || 150
  
  // For Chinese languages, count characters instead of words
  let wordCount: number
  if (language.startsWith('zh')) {
    // Chinese: count characters (excluding punctuation and spaces)
    wordCount = content.replace(/[^\u4e00-\u9fa5]/g, '').length / 2 // Rough approximation: 2 chars = 1 "word"
  } else {
    // Other languages: count words
    wordCount = content.split(/\s+/).filter(word => word.length > 0).length
  }

  const minutes = wordCount / wpm
  return Math.round(minutes * 60) // Return in seconds
}

/**
 * Validate if content is suitable for TTS
 */
export function validateTTSContent(content: string): { 
  isValid: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // Check for remaining markdown
  if (content.includes('**') || content.includes('###') || content.includes('---')) {
    issues.push('Content still contains markdown formatting')
    suggestions.push('Run processBriefContentForTTS() to clean the content')
  }

  // Check for placeholders
  if (content.includes('[insert') || content.includes('[TODO]')) {
    issues.push('Content contains unresolved placeholders')
    suggestions.push('Ensure all placeholders are replaced with actual content')
  }

  // Check for URLs (should be spoken descriptions instead)
  if (/https?:\/\/[^\s]+/.test(content)) {
    issues.push('Content contains URLs that will be read literally')
    suggestions.push('Replace URLs with spoken descriptions')
  }

  // Check for excessive punctuation that might cause TTS issues
  if (/[!?]{3,}/.test(content) || /\.{4,}/.test(content)) {
    issues.push('Content contains excessive punctuation')
    suggestions.push('Reduce repeated punctuation marks')
  }

  // Check length
  if (content.length < 1000) {
    issues.push('Content seems too short for a comprehensive news brief')
    suggestions.push('Ensure content is substantial enough for 8-12 minutes')
  }

  if (content.length > 50000) {
    issues.push('Content might be too long for optimal TTS processing')
    suggestions.push('Consider breaking into smaller segments')
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  }
}