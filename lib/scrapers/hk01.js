// HK01 scraper - simplified to use working JSON API only
// Optimized for Next.js environment with native fetch

const HDRS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8",
}

// Category zone IDs for the v2 feed API
const CATEGORIES = [
  { id: 1, name: "港聞" },
  { id: 2, name: "社會" },
  { id: 4, name: "國際" },
  { id: 5, name: "財經" },
  { id: 6, name: "中國" },
]

// Fetch articles from a single category via JSON API
async function fetchCategoryArticles(categoryId, limit = 20) {
  try {
    const url = `https://web-data.api.hk01.com/v2/feed/category/${categoryId}?bucketId=00000&limit=${limit}`
    const response = await fetch(url, {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const items = data?.items || []

    return items
      .filter(item => item.data?.title && item.data?.canonicalUrl)
      .map(item => ({
        title: item.data.title.trim(),
        url: item.data.canonicalUrl,
        articleId: item.data.articleId,
      }))
  } catch (e) {
    console.warn(`HK01: Category ${categoryId} API fail:`, e.message)
    return []
  }
}

// Main headline scraper - fetches from multiple categories
async function scrapeHK01() {
  console.log("HK01: Fetching articles from JSON API...")

  const allArticles = []
  const seenIds = new Set()

  for (const category of CATEGORIES) {
    console.log(`HK01: Fetching ${category.name}...`)
    const articles = await fetchCategoryArticles(category.id, 15)

    // Dedupe by article ID
    for (const article of articles) {
      if (!seenIds.has(article.articleId)) {
        seenIds.add(article.articleId)
        allArticles.push(article)
      }
    }

    // Small delay between categories
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`HK01: Found ${allArticles.length} unique articles`)
  return allArticles.slice(0, 50)
}

// Extract article ID from URL
function extractArticleId(url) {
  const patterns = [
    /\/article\/(\d+)/,
    /\/[^\/]+\/(\d+)\//,
    /\/(\d+)(?:\/|$|\?)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Extract content from HK01 JSON API blocks
function extractContentFromBlocks(blocks) {
  const parts = []
  for (const block of blocks) {
    if (block.blockType === 'text' && block.htmlTokens) {
      for (const row of block.htmlTokens) {
        for (const token of row) {
          if (token.content && (token.type === 'text' || token.type === 'boldText')) {
            const text = token.content.trim()
            if (text.length > 10) parts.push(text)
          }
        }
      }
    } else if (block.blockType === 'summary' && block.summary) {
      for (const text of block.summary) {
        if (text?.length > 10) parts.push(text)
      }
    }
  }
  return parts.join('\n\n')
}

// Extract full article content
async function extractArticleContent(url) {
  const articleId = extractArticleId(url)
  if (!articleId) {
    console.warn(`HK01: Could not extract article ID from ${url}`)
    return null
  }

  try {
    const apiUrl = `https://web-data.api.hk01.com/v2/page/article/${articleId}`
    const response = await fetch(apiUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const article = data.article
    if (!article) throw new Error('No article data')

    const blocks = article.blocks || []
    const content = extractContentFromBlocks(blocks)

    // Get image
    let imageUrl = ''
    for (const block of blocks) {
      if (block.blockType === 'image' && block.image?.cdnUrl) {
        imageUrl = block.image.cdnUrl
        break
      }
    }
    if (!imageUrl && article.mainImage?.cdnUrl) {
      imageUrl = article.mainImage.cdnUrl
    }

    const authors = article.authors || []
    const author = authors.map(a => a.displayName || a.name).filter(Boolean).join(', ')

    if (content && content.length > 100) {
      return {
        source: 'hk01',
        url,
        headline: article.title || 'Untitled',
        date: article.publishTime ? new Date(article.publishTime * 1000).toISOString() : '',
        body: content,
        coverImg: imageUrl || '',
        author,
      }
    }

    return null
  } catch (e) {
    console.warn(`HK01: API failed for article ${articleId}:`, e.message)
    return null
  }
}

// Full scraper with content extraction
async function scrapeHK01WithContent() {
  const headlines = await scrapeHK01()
  const articles = []

  console.log(`HK01: Extracting content for ${headlines.length} articles...`)

  for (let i = 0; i < headlines.length; i++) {
    const headline = headlines[i]
    console.log(`HK01: [${i + 1}/${headlines.length}] ${headline.title.substring(0, 40)}...`)

    const article = await extractArticleContent(headline.url)
    if (article) {
      articles.push(article)
    }

    // Rate limit
    if (i < headlines.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`HK01: Successfully extracted ${articles.length}/${headlines.length} articles`)
  return articles
}

module.exports = { scrapeHK01, scrapeHK01WithContent }
