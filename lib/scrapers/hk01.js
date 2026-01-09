// Enhanced HK01 scraper based on working version
// Optimized for Next.js environment with native fetch

const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
}

// Use v2 feed API for better coverage - same as external RSS feed
const API_URL = "https://web-data.api.hk01.com/v2/feed/category/0?bucketId=00000&limit=50"

// Enhanced HTML scraping with category drill-down
async function fromHtml() {
  try {
    const articles = []

    // Key categories to scrape for actual articles - expanded for better coverage
    const categories = [
      { name: "港聞", url: "/zone/1" },
      { name: "政情", url: "/channel/310" },
      { name: "國際", url: "/zone/4" },
      { name: "社會新聞", url: "/zone/2" },
      { name: "財經", url: "/zone/5" },
      { name: "中國", url: "/zone/6" },
    ]

    for (const category of categories) {
      try {
        console.log(`HK01: Fetching articles from ${category.name}...`)
        const response = await fetch(`https://www.hk01.com${category.url}`, {
          headers: HDRS,
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          console.warn(`HK01: ${category.name} returned ${response.status}`)
          continue
        }

        const html = await response.text()
        const categoryArticles = []

        // Strategy 1: Look for article links in the content
        const articleLinkRegex = /<a[^>]*href="([^"]*\/article\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
        let match

        while ((match = articleLinkRegex.exec(html)) !== null && categoryArticles.length < 8) {
          const url = match[1]
          const title = match[2].trim()

          if (title && url && title.length > 15 && !title.includes("更多")) {
            categoryArticles.push({
              title: `[${category.name}] ${title}`,
              url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
            })
          }
        }

        // Strategy 2: Look for links with specific news patterns
        if (categoryArticles.length < 5) {
          const newsLinkRegex = /<a[^>]*href="([^"]*\/(?:港聞|政情|國際|社會新聞|財經|中國)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi

          while ((match = newsLinkRegex.exec(html)) !== null && categoryArticles.length < 8) {
            const url = match[1]
            const title = match[2].trim()

            if (title && url && title.length > 10) {
              categoryArticles.push({
                title: `[${category.name}] ${title}`,
                url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
              })
            }
          }
        }

        articles.push(...categoryArticles)

        // Rate limiting between requests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (categoryError) {
        console.warn(`HK01: Failed to fetch ${category.name}:`, categoryError.message)
      }
    }

    // If we got articles from categories, return them (increased limit for better coverage)
    if (articles.length > 0) {
      return articles.slice(0, 30)
    }

    // Fallback: Try the /latest page for any content
    console.log("HK01: Trying fallback /latest page...")
    const response = await fetch("https://www.hk01.com/latest", {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const fallbackArticles = []

    const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null && fallbackArticles.length < 30) {
      const url = match[1]
      const title = match[2].trim()

      // Filter out promotional and non-news URLs
      const isValidNewsUrl = url.includes('/article/') || 
                            url.includes('/政情/') || 
                            url.includes('/港聞/') || 
                            url.includes('/國際/') ||
                            url.includes('/zone/')

      const isPromotionalUrl = url.includes('clk.omgt3.com') ||
                              url.includes('affiliate.klook.com') ||
                              url.includes('trip.com') ||
                              url.includes('promo') ||
                              url.includes('offer')

      if (title && url && title.length > 10 && 
          !title.includes("登入") && !title.includes("更多") &&
          isValidNewsUrl && !isPromotionalUrl) {
        fallbackArticles.push({
          title,
          url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
        })
      }
    }

    return fallbackArticles
  } catch (e) {
    console.warn("HK01 HTML scraping fail:", e.message)
    return []
  }
}

// Native JSON API (cloudflare-free) - v2 feed API for better coverage
async function fromApi() {
  try {
    const response = await fetch(API_URL, {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    // v2 feed format: data.items[] or data.data[]
    const items = data?.items || data?.data || []

    return items
      .slice(0, 30)
      .map((item) => {
        const title = item.title?.trim()
        // v2 feed provides canonicalUrl or publishUrl
        const url = item.canonicalUrl || item.publishUrl || item.url || item.link
        return title && url
          ? {
              title,
              url: url.startsWith("http") ? url : `https://www.hk01.com${url}`,
            }
          : null
      })
      .filter(Boolean)
  } catch (e) {
    console.warn("HK01 API fail:", e.message)
    return []
  }
}

// Sitemap fallback
async function fromSitemap() {
  try {
    const response = await fetch("https://www.hk01.com/sitemap.xml", {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.text()
    const articles = []

    // Extract URLs from sitemap
    const urlRegex = /<loc>([^<]+)<\/loc>/gi
    let match

    while ((match = urlRegex.exec(data)) !== null && articles.length < 30) {
      const loc = match[1]
      if (loc.includes("/政情/") || loc.includes("/港聞/") || loc.includes("/article/")) {
        // Extract title from URL slug
        const parts = loc.split("/")
        const titleSlug = parts[parts.length - 1]
        if (titleSlug && titleSlug.length > 5) {
          const title = decodeURIComponent(titleSlug).replace(/-/g, " ")
          articles.push({ title, url: loc })
        }
      }
    }

    return articles
  } catch (e) {
    console.warn("HK01 sitemap fail:", e.message)
    return []
  }
}

// Extract article ID from URL
function extractArticleId(url) {
  // HK01 URLs: https://www.hk01.com/政情/60308565/... or https://www.hk01.com/article/1072958
  const patterns = [
    /\/article\/(\d+)/,           // /article/1072958
    /\/[^\/]+\/(\d+)\//,          // /政情/60308565/...
    /\/(\d+)(?:\/|$|\?)/,         // /1072958 or /1072958/ or /1072958?
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Extract content from HK01 JSON API blocks
function extractContentFromBlocks(blocks) {
  const contentParts = []

  for (const block of blocks) {
    if (block.blockType === 'text' && block.htmlTokens) {
      for (const tokenRow of block.htmlTokens) {
        for (const token of tokenRow) {
          if (token.content && (token.type === 'text' || token.type === 'boldText')) {
            const text = token.content.trim()
            if (text.length > 10) {
              contentParts.push(text)
            }
          }
        }
      }
    } else if (block.blockType === 'summary' && block.summary) {
      // Summary is an array of strings
      for (const summaryText of block.summary) {
        if (summaryText && summaryText.length > 10) {
          contentParts.push(summaryText)
        }
      }
    }
  }

  return contentParts.join('\n\n')
}

// Article Content Extraction using HK01 JSON API
async function extractArticleContent(url) {
  const articleId = extractArticleId(url)

  if (!articleId) {
    console.warn(`HK01: Could not extract article ID from ${url}`)
    return null
  }

  console.log(`HK01: Using JSON API for article ${articleId}`)

  try {
    const apiUrl = `https://web-data.api.hk01.com/v2/page/article/${articleId}`
    const response = await fetch(apiUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const article = data.article

    if (!article) throw new Error('No article data in response')

    const title = article.title || 'Untitled'
    const publishDate = article.publishTime
      ? new Date(article.publishTime * 1000).toISOString()
      : ''

    // Extract content from blocks
    const blocks = article.blocks || []
    const content = extractContentFromBlocks(blocks)

    // Get image URL
    let imageUrl = ''
    // Look for first image block
    for (const block of blocks) {
      if (block.blockType === 'image' && block.image?.cdnUrl) {
        imageUrl = block.image.cdnUrl
        break
      }
    }

    // Fallback to article main image
    if (!imageUrl && article.mainImage?.cdnUrl) {
      imageUrl = article.mainImage.cdnUrl
    }

    // Default fallback image
    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop'
    }

    // Get author
    const authors = article.authors || []
    const author = authors.map(a => a.displayName || a.name).filter(Boolean).join(', ')

    if (content && content.length > 100) {
      return {
        source: 'hk01',
        url,
        headline: title,
        date: publishDate,
        body: content,
        coverImg: imageUrl,
        author,
      }
    }

    console.warn(`HK01: Content too short for article ${articleId}`)
    return null
  } catch (e) {
    console.warn(`HK01: JSON API failed for ${url}:`, e.message)
    return null
  }
}

// Enhanced orchestrator with content extraction
async function scrapeHK01WithContent() {
  const headlines = await scrapeHK01()
  const articles = []

  console.log(`HK01: Extracting content for ${headlines.length} articles...`)

  for (let i = 0; i < headlines.length; i++) {
    const headline = headlines[i]
    console.log(`HK01: Extracting ${i + 1}/${headlines.length}: ${headline.title.substring(0, 50)}...`)

    const article = await extractArticleContent(headline.url)
    if (article) {
      articles.push(article)
    } else {
      console.warn(`HK01: Failed to extract content from ${headline.url}`)
      // Still include headline-only data as fallback
      articles.push({
        source: 'hk01',
        url: headline.url,
        headline: headline.title,
        date: '',
        body: '',
        coverImg: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop',
        author: '',
      })
    }

    // Rate limiting - reduced for faster processing
    if (i < headlines.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return articles
}

// Main orchestrator (headlines only)
async function scrapeHK01() {
  console.log("HK01: Trying direct HTML scraping...")
  let articles = await fromHtml()
  if (articles.length) {
    console.log(`HK01: HTML scraping success - ${articles.length} articles`)
    return articles
  }

  console.log("HK01: Trying JSON API...")
  articles = await fromApi()
  if (articles.length) {
    console.log(`HK01: API success - ${articles.length} articles`)
    return articles
  }

  console.log("HK01: Trying sitemap fallback...")
  articles = await fromSitemap()
  console.log(`HK01: Final result - ${articles.length} articles`)
  return articles
}

module.exports = { scrapeHK01, scrapeHK01WithContent }
