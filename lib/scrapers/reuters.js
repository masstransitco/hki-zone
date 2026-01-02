/**
 * Reuters News Scraper
 *
 * Uses Reuters wireapi for article discovery and content extraction.
 * Focus: Asia Pacific news with Hong Kong relevance
 */

const HDRS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

// Reuters sections to scrape directly
const REUTERS_SECTIONS = [
  'https://www.reuters.com/world/asia-pacific/',
  'https://www.reuters.com/world/china/',
  'https://www.reuters.com/markets/asia/',
]

/**
 * Extract article URLs directly from Reuters section pages
 */
async function fromSectionPages() {
  const articles = []
  const seenUrls = new Set()

  for (const sectionUrl of REUTERS_SECTIONS) {
    try {
      console.log(`Reuters: Fetching ${sectionUrl}`)

      const response = await fetch(sectionUrl, {
        headers: HDRS,
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        console.warn(`Reuters: Section ${sectionUrl} returned ${response.status}`)
        continue
      }

      const html = await response.text()

      // Reuters embeds article data in __PRELOADED_STATE__ or similar
      // Try to find article links in the HTML

      // Pattern 1: Look for article URLs in href attributes
      const articlePattern = /href="(\/(?:world|markets|business|technology)\/[^"]+\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/)"/gi
      let match
      while ((match = articlePattern.exec(html)) !== null) {
        const path = match[1]
        const url = `https://www.reuters.com${path}`

        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          articles.push({
            title: '', // Will extract from article page
            url,
            description: '',
            pubDate: '',
            imageUrl: '',
          })
        }
      }

      // Pattern 2: Look for canonical article paths
      const canonicalPattern = /href="(\/[^"]+\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/gi
      while ((match = canonicalPattern.exec(html)) !== null) {
        const path = match[1]
        if (path.includes('/world/') || path.includes('/markets/') || path.includes('/business/')) {
          const url = `https://www.reuters.com${path}`

          if (!seenUrls.has(url)) {
            seenUrls.add(url)
            articles.push({
              title: '',
              url,
              description: '',
              pubDate: '',
              imageUrl: '',
            })
          }
        }
      }

      // Small delay between sections
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.warn(`Reuters: Failed to fetch section ${sectionUrl}:`, error.message)
    }
  }

  console.log(`Reuters: Found ${articles.length} article URLs from section pages`)
  return articles
}

/**
 * Fallback: Scrape from HTML page
 */
async function fromHTML() {
  const articles = []

  try {
    const response = await fetch('https://www.reuters.com/world/asia-pacific/', {
      headers: {
        ...HDRS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    // Extract JSON data from page (Reuters embeds article data in script tags)
    const jsonMatch = html.match(/<script[^>]*type="application\/json"[^>]*id="fusion-metadata"[^>]*>([\s\S]*?)<\/script>/i) ||
                      html.match(/<script[^>]*>window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i)

    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1])
        // Parse the embedded data structure (varies by page)
        const items = extractArticlesFromFusionData(data)
        articles.push(...items)
      } catch (e) {
        console.warn('Reuters: Failed to parse embedded JSON')
      }
    }

    // Fallback: extract from HTML structure
    if (articles.length === 0) {
      const articleLinks = html.match(/<a[^>]*href="(\/world\/[^"]*\/)"[^>]*>/gi) || []
      const seen = new Set()

      for (const link of articleLinks) {
        const hrefMatch = link.match(/href="([^"]+)"/)
        if (!hrefMatch) continue

        const path = hrefMatch[1]
        if (seen.has(path)) continue
        seen.add(path)

        // Filter to actual article paths (not section pages)
        if (path.split('/').length > 3 && !path.endsWith('/')) {
          articles.push({
            title: '',
            url: `https://www.reuters.com${path}`,
            description: '',
            pubDate: '',
            imageUrl: '',
          })
        }
      }
    }

  } catch (error) {
    console.error('Reuters HTML fetch failed:', error.message)
  }

  return articles.slice(0, 15)
}

/**
 * Extract articles from Reuters Fusion data
 */
function extractArticlesFromFusionData(data) {
  const articles = []

  // Try different data paths
  const possiblePaths = [
    data?.content?.result?.articles,
    data?.globalContent?.result?.articles,
    Object.values(data || {}).find(v => Array.isArray(v?.result?.articles))?.result?.articles,
  ]

  for (const items of possiblePaths) {
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.canonical_url || item.url) {
          articles.push({
            title: item.title || item.headline || '',
            url: item.canonical_url ? `https://www.reuters.com${item.canonical_url}` : item.url,
            description: item.description || '',
            pubDate: item.published_time || item.date || '',
            imageUrl: item.thumbnail?.url || item.image?.url || '',
          })
        }
      }
      break
    }
  }

  return articles
}

/**
 * Extract full article content from Reuters article page
 */
async function extractArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        ...HDRS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''

    // Try to extract from JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    let content = ''
    let author = 'Reuters'
    let imageUrl = ''

    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<\/?script[^>]*>/gi, '')
          const ld = JSON.parse(jsonStr)

          if (ld['@type'] === 'NewsArticle' || ld['@type'] === 'Article') {
            content = ld.articleBody || ''
            author = ld.author?.name || ld.author?.[0]?.name || 'Reuters'
            imageUrl = ld.image?.url || ld.thumbnailUrl || ''
            break
          }
        } catch (e) {
          // Continue to next JSON-LD block
        }
      }
    }

    // Fallback: Extract from HTML
    if (!content) {
      const cleanHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')

      const paragraphs = []

      // Look for article body paragraphs
      const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
      const searchArea = articleMatch ? articleMatch[1] : cleanHtml

      const pMatches = searchArea.match(/<p[^>]*data-testid="paragraph-\d+"[^>]*>([\s\S]*?)<\/p>/gi) ||
                       searchArea.match(/<p[^>]*class="[^"]*paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi) ||
                       []

      for (const p of pMatches) {
        const text = p.replace(/<[^>]*>/g, '').trim()
        if (text.length > 30 && !isJunkContent(text)) {
          paragraphs.push(text)
        }
      }

      // General paragraph fallback
      if (paragraphs.length < 3) {
        const allP = searchArea.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
        for (const p of allP) {
          const text = p.replace(/<[^>]*>/g, '').trim()
          if (text.length > 50 && !isJunkContent(text) && !paragraphs.includes(text)) {
            paragraphs.push(text)
          }
        }
      }

      content = paragraphs.join('\n\n')
    }

    // Get OG image if not found
    if (!imageUrl) {
      const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      imageUrl = ogMatch ? ogMatch[1] : ''
    }

    return {
      title,
      content: cleanContent(content),
      author,
      imageUrl,
    }
  } catch (error) {
    console.error(`Reuters: Failed to extract content from ${url}:`, error.message)
    return null
  }
}

/**
 * Filter out junk content
 */
function isJunkContent(text) {
  const junkPatterns = [
    /^Share$/i,
    /^Read more$/i,
    /^Related/i,
    /^Subscribe/i,
    /^Sign up/i,
    /^Our Standards/i,
    /^Reporting by/i,
    /^Editing by/i,
    /^Writing by/i,
    /^Compiled by/i,
    /^\(\s*Reporting/i,
    /^Register for free/i,
    /^Get the latest/i,
    /^Advertisement/i,
    /^TextSmall/i,
    /^Text(Small|Medium|Large)/i,
    /^ShareX?Facebook/i,
    /^Linkedin/i,
    /^Email/i,
    /^Link$/i,
    /^Printed/i,
  ]

  for (const pattern of junkPatterns) {
    if (pattern.test(text)) return true
  }

  // Filter out bylines at end
  if (text.match(/\(Reporting by [^)]+\)$/)) return true

  // Filter out share button text
  if (text.match(/^(TextSmall|TextMedium|TextLarge|Share|X|Facebook|Linkedin|Email|Link)\s/)) return true

  return false
}

/**
 * Clean extracted content
 */
function cleanContent(text) {
  return text
    .replace(/TextSmall\s*TextMedium\s*TextLarge\s*/gi, '')
    .replace(/ShareX?FacebookLinkedinEmailLink/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Main scraper function
 */
async function scrapeReutersWithContent() {
  // Try section pages first
  let headlines = await fromSectionPages()

  if (headlines.length === 0) {
    console.log('Reuters: Section pages failed, trying HTML fallback...')
    headlines = await fromHTML()
  }

  const articles = []

  for (const headline of headlines.slice(0, 15)) {
    const url = headline.url

    console.log(`Reuters: Extracting content from ${url}`)

    const extracted = await extractArticleContent(url)

    if (extracted && extracted.content && extracted.content.length > 100) {
      articles.push({
        source: 'reuters',
        url: url,
        headline: extracted.title || headline.title,
        date: headline.pubDate || new Date().toISOString(),
        body: extracted.content,
        coverImg: extracted.imageUrl || headline.imageUrl || '',
        author: extracted.author,
      })
    } else if (extracted && extracted.title) {
      // Include article with title even if content extraction partial
      articles.push({
        source: 'reuters',
        url: url,
        headline: extracted.title,
        date: headline.pubDate || new Date().toISOString(),
        body: extracted.content || '',
        coverImg: extracted.imageUrl || '',
        author: 'Reuters',
      })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`Reuters: Successfully scraped ${articles.length} articles`)
  return articles
}

module.exports = {
  fromSectionPages,
  fromHTML,
  extractArticleContent,
  scrapeReutersWithContent,
}
