/**
 * Helper functions for robust article enhancement
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain?: string;
  date?: string;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  retries = 5,
  baseDelay = 500 // ms
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      // Check if error is retryable (rate limit, server errors, or socket errors)
      const status = err.status || err.response?.status;
      const errorCode = err.code || err.cause?.code;
      const isRetryable = [429, 502, 503, 504].includes(status) ||
                          errorCode === 'UND_ERR_SOCKET' ||
                          errorCode === 'ECONNRESET' ||
                          errorCode === 'ETIMEDOUT' ||
                          errorCode === 'ENOTFOUND' ||
                          (err.message && err.message.includes('other side closed'));
      
      if (attempt >= retries || !isRetryable) {
        throw err;
      }
      
      // Calculate exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      const errorInfo = status || errorCode || err.message?.substring(0, 50);
      console.warn(`Retry attempt ${attempt + 1}/${retries} after ${Math.round(delay)}ms delay. Error: ${errorInfo}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

/**
 * Global deduplication of search results by URL
 */
export function dedupeGlobally(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  
  for (const result of results) {
    const normalizedUrl = normalizeUrl(result.url);
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      deduped.push(result);
    }
  }
  
  return deduped;
}

/**
 * Normalize URL for deduplication (remove trailing slashes, fragments, etc.)
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove fragment and trailing slash
    urlObj.hash = '';
    let normalized = urlObj.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Calculate minimum required sources based on content length
 */
export function getMinSourcesFor(content: string): number {
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount < 300) return 3;
  if (wordCount < 600) return 5;
  if (wordCount < 1000) return 7;
  return 10; // For very long articles
}

/**
 * Safe search with error handling and empty result fallback
 */
export async function safeSearch(
  searchFn: (query: string) => Promise<SearchResult[]>,
  query: string
): Promise<SearchResult[]> {
  try {
    const results = await withExponentialBackoff(() => searchFn(query));
    
    if (results.length === 0) {
      console.warn(`⚠️  No search results found for query: "${query}"`);
    } else {
      console.log(`✅ Found ${results.length} results for: "${query}"`);
    }
    
    return results;
  } catch (err) {
    console.error(`❌ Search failed for query "${query}":`, err);
    return []; // Graceful degradation
  }
}

/**
 * Rank search results by relevance and recency
 */
export function rankSearchResults(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    // Prioritize results with dates
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    
    // Prioritize results with longer snippets (more context)
    const snippetDiff = (b.snippet?.length || 0) - (a.snippet?.length || 0);
    if (snippetDiff !== 0) return snippetDiff;
    
    // Prioritize trusted domains
    const trustedDomains = ['gov.hk', 'scmp.com', 'rthk.hk', 'hongkongfp.com'];
    const aIsTrusted = trustedDomains.some(d => a.domain?.includes(d));
    const bIsTrusted = trustedDomains.some(d => b.domain?.includes(d));
    
    if (aIsTrusted && !bIsTrusted) return -1;
    if (!aIsTrusted && bIsTrusted) return 1;
    
    return 0;
  });
}

/**
 * Extract key phrases from content for better search queries
 */
export function extractKeyPhrases(content: string, maxPhrases = 3): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'could'
  ]);
  
  // Extract sentences and find key phrases
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  const phrases: string[] = [];
  
  for (const sentence of sentences.slice(0, 5)) { // Look at first 5 sentences
    const words = sentence
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    
    if (words.length >= 2) {
      // Create 2-3 word phrases
      for (let i = 0; i < words.length - 1; i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
    }
  }
  
  // Return most common phrases
  const phraseCounts = new Map<string, number>();
  phrases.forEach(phrase => {
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  });
  
  return Array.from(phraseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPhrases)
    .map(([phrase]) => phrase);
}

/**
 * Configuration for enhancement pipeline
 */
export interface EnhancementConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxSearchResults?: number;
  minSearchResults?: number;
  searchTimeout?: number;
  maxTokens?: number;
  temperature?: number;
}

export const defaultConfig: EnhancementConfig = {
  maxRetries: 5,
  baseDelay: 500,
  maxSearchResults: 10,
  minSearchResults: 3,
  searchTimeout: 30000,
  maxTokens: 6000,
  temperature: 0.2
};