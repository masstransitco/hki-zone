// Mapping from article source names to favicon filenames
// Based on manifest.json and common source name variations

export interface SourceFaviconMapping {
  [sourceName: string]: string
}

// Primary mapping from source names to favicon files
export const SOURCE_FAVICON_MAP: SourceFaviconMapping = {
  // Exact matches from manifest
  "HK01": "hk01.png",
  "HKFP": "hkfp.ico", 
  "RTHK": "rthk.png",
  "SingTao": "singtao.png",
  "Ming Pao": "mingpao.jpg",
  "Oriental Daily": "oriental.png",
  "The Standard": "standard.png",
  "SCMP": "scmp.png",
  "Now News": "nownews.png",
  "TVB": "tvb.png",
  "InMedia": "inmedia.ico",
  "Coconuts Hong Kong": "coconutshk.ico",
  "Hong Kong Government News": "newsgov.png",
  "HKEJ": "hkej.png",
  "Bastille Post": "bastille.png",
  "Metro Radio": "metroradio.png",
  "Commercial Radio": "crhk.ico",
  "AM730": "am730.ico",

  // Common variations and aliases
  "hk01": "hk01.png",
  "Hong Kong 01": "hk01.png",
  "HK 01": "hk01.png",
  
  "hkfp": "hkfp.ico",
  "Hong Kong Free Press": "hkfp.ico",
  
  "rthk": "rthk.png",
  "Radio Television Hong Kong": "rthk.png",
  
  "singtao": "singtao.png",
  "Sing Tao Daily": "singtao.png",
  "Sing Tao": "singtao.png",
  
  "mingpao": "mingpao.jpg",
  "Ming Pao Daily": "mingpao.jpg",
  
  "oriental": "oriental.png",
  "Oriental Daily News": "oriental.png",
  
  "on.cc": "oncc.png",
  "On.cc": "oncc.png", 
  "ON.CC": "oncc.png",
  "ONCC": "oncc.png",
  
  "standard": "standard.png",
  "The Standard HK": "standard.png",
  
  "scmp": "scmp.png",
  "South China Morning Post": "scmp.png",
  
  "nownews": "nownews.png",
  "Now TV": "nownews.png",
  "Now": "nownews.png",
  
  "tvb": "tvb.png",
  "TVB News": "tvb.png",
  "Television Broadcasts Limited": "tvb.png",
  
  "inmedia": "inmedia.ico",
  "InMedia HK": "inmedia.ico",
  
  "coconuts": "coconutshk.ico",
  "Coconuts": "coconutshk.ico",
  
  "newsgov": "newsgov.png",
  "Gov News": "newsgov.png",
  "Government News": "newsgov.png",
  
  "hkej": "hkej.png",
  "Hong Kong Economic Journal": "hkej.png",
  "Economic Journal": "hkej.png",
  
  "bastille": "bastille.png",
  "Bastille": "bastille.png",
  
  "metro": "metroradio.png",
  "metroradio": "metroradio.png",
  "Metro Broadcast": "metroradio.png",
  
  "crhk": "crhk.ico",
  "881903": "crhk.ico",
  "Commercial Radio Hong Kong": "crhk.ico",
  
  "am730": "am730.ico",
  "AM730": "am730.ico"
}

// Normalize source name for lookup
export function normalizeSourceName(source: string): string {
  return source
    .replace(' (AI Enhanced)', '') // Remove AI Enhanced suffix
    .replace(/ \+ AI$/, '') // Remove + AI suffix
    .trim()
}

// Get favicon filename for a source
export function getFaviconForSource(source: string): string | null {
  const normalizedSource = normalizeSourceName(source)
  
  // Try exact match first
  if (SOURCE_FAVICON_MAP[normalizedSource]) {
    return SOURCE_FAVICON_MAP[normalizedSource]
  }
  
  // Try case-insensitive match
  const lowerSource = normalizedSource.toLowerCase()
  for (const [key, value] of Object.entries(SOURCE_FAVICON_MAP)) {
    if (key.toLowerCase() === lowerSource) {
      return value
    }
  }
  
  // Try partial matches for common patterns
  const partialMatches: { [pattern: string]: string } = {
    "hk01": "hk01.png",
    "hkfp": "hkfp.ico",
    "rthk": "rthk.png", 
    "singtao": "singtao.png",
    "mingpao": "mingpao.jpg",
    "oriental": "oriental.png",
    "oncc": "oncc.png",
    "standard": "standard.png",
    "scmp": "scmp.png",
    "now": "nownews.png",
    "tvb": "tvb.png",
    "inmedia": "inmedia.ico",
    "coconuts": "coconutshk.ico",
    "gov": "newsgov.png",
    "hkej": "hkej.png",
    "bastille": "bastille.png",
    "metro": "metroradio.png",
    "881903": "crhk.ico",
    "am730": "am730.ico"
  }
  
  for (const [pattern, favicon] of Object.entries(partialMatches)) {
    if (lowerSource.includes(pattern)) {
      return favicon
    }
  }
  
  return null
}

// Get favicon URL for a source
export function getFaviconUrl(source: string): string | null {
  const filename = getFaviconForSource(source)
  return filename ? `/favicons-output/${filename}` : null
}

// Check if a source has a favicon available
export function hasFavicon(source: string): boolean {
  return getFaviconForSource(source) !== null
}