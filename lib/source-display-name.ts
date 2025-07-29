// Utility functions for displaying proper source names

// Mapping from database source names to display names
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  // News sources
  "hkfp": "HKFP",
  "singtao": "SingTao",
  "hk01": "HK01", 
  "oncc": "ONCC",
  "rthk": "RTHK",
  "am730": "AM730",
  "scmp": "SCMP",
  "bloomberg": "Bloomberg",
  
  // Car sources
  "28car": "28car",
  
  // Other sources
  "ming pao": "Ming Pao",
  "oriental daily": "Oriental Daily",
  "the standard": "The Standard",
  "now news": "Now News",
  "tvb": "TVB",
  "inmedia": "InMedia",
  "coconuts hong kong": "Coconuts Hong Kong",
  "hong kong government news": "Hong Kong Government News",
  "hkej": "HKEJ",
  "bastille post": "Bastille Post",
  "metro radio": "Metro Radio",
  "commercial radio": "Commercial Radio",
  
  // AI/Enhanced sources
  "perplexity ai": "Perplexity AI"
}

/**
 * Get the proper display name for a source
 * @param source - The source name from the database
 * @returns Properly formatted display name
 */
export function getSourceDisplayName(source: string): string {
  if (!source) return ''
  
  // Remove AI Enhanced suffix if present
  const cleanSource = source.replace(' (AI Enhanced)', '').replace(/ \+ AI$/, '').trim()
  
  // Try exact match first (case insensitive)
  const exactMatch = SOURCE_DISPLAY_NAMES[cleanSource.toLowerCase()]
  if (exactMatch) {
    return exactMatch
  }
  
  // Try partial matches for common patterns
  const lowerSource = cleanSource.toLowerCase()
  
  // Check if any of our mapped sources are contained in the source name
  for (const [key, displayName] of Object.entries(SOURCE_DISPLAY_NAMES)) {
    if (lowerSource.includes(key) || key.includes(lowerSource)) {
      return displayName
    }
  }
  
  // Fallback: return the original source with proper capitalization
  return cleanSource.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

/**
 * Get display name with AI enhancement suffix if applicable
 * @param source - The source name from the database
 * @param isAiEnhanced - Whether the article is AI enhanced
 * @returns Display name with AI suffix if enhanced
 */
export function getSourceDisplayNameWithAI(source: string, isAiEnhanced: boolean = false): string {
  const displayName = getSourceDisplayName(source)
  return isAiEnhanced ? `${displayName} + AI Enhanced` : displayName
}