import * as OpenCC from 'opencc-js'

// Initialize converters
const converterTradToSimp = OpenCC.Converter({ from: 'hk', to: 'cn' })
const converterSimpToTrad = OpenCC.Converter({ from: 'cn', to: 'hk' })

export interface ChineseText {
  title: string
  body: string
  link?: string
}

/**
 * Convert Traditional Chinese (Hong Kong variant) to Simplified Chinese
 */
export function convertTraditionalToSimplified(text: string): string {
  return converterTradToSimp(text)
}

/**
 * Convert Simplified Chinese to Traditional Chinese (Hong Kong variant)
 */
export function convertSimplifiedToTraditional(text: string): string {
  return converterSimpToTrad(text)
}

/**
 * Convert a full content object from Traditional to Simplified Chinese
 */
export function convertContentToSimplified(content: ChineseText): ChineseText {
  return {
    title: convertTraditionalToSimplified(content.title),
    body: convertTraditionalToSimplified(content.body),
    link: content.link // URLs don't need conversion
  }
}

/**
 * Convert a full content object from Simplified to Traditional Chinese
 */
export function convertContentToTraditional(content: ChineseText): ChineseText {
  return {
    title: convertSimplifiedToTraditional(content.title),
    body: convertSimplifiedToTraditional(content.body),
    link: content.link // URLs don't need conversion
  }
}

/**
 * Get content in the requested Chinese variant, with automatic conversion if needed
 */
export function getChineseContent(
  content: any,
  requestedLanguage: 'zh-CN' | 'zh-TW'
): ChineseText | null {
  // If requested language is available, return it directly
  if (content[requestedLanguage]) {
    return content[requestedLanguage]
  }
  
  // If requesting Simplified but only Traditional is available, convert it
  if (requestedLanguage === 'zh-CN' && content['zh-TW']) {
    return convertContentToSimplified(content['zh-TW'])
  }
  
  // If requesting Traditional but only Simplified is available, convert it
  if (requestedLanguage === 'zh-TW' && content['zh-CN']) {
    return convertContentToTraditional(content['zh-CN'])
  }
  
  // No Chinese content available
  return null
}