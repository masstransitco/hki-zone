// Enhanced HKFP scraper based on working version
// Requires native fetch (no external dependencies in Next.js)

const HDRS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

// Article content extraction
async function extractArticleContent(url) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  try {
    // Strategy 1: Direct article page scraping
    const response = await fetch(url, {
      headers: HDRS,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()

    // Remove non-content elements using regex
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")

    // Extract title
    const titleMatch =
      cleanHtml.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
      cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
      cleanHtml.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : "Untitled"

    // Extract author
    const authorMatch =
      cleanHtml.match(/<[^>]*class="[^"]*author[^"]*"[^>]*>([^<]+)<\/[^>]*>/i) ||
      cleanHtml.match(/<[^>]*rel="author"[^>]*>([^<]+)<\/[^>]*>/i)
    const author = authorMatch ? authorMatch[1].replace(/^By\s+/i, "").trim() : ""

    // Extract date
    const dateMatch =
      cleanHtml.match(/<time[^>]*datetime="([^"]+)"/i) ||
      cleanHtml.match(/<[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/[^>]*>/i)
    const publishDate = dateMatch ? dateMatch[1].trim() : ""

    // Extract image
    let imageUrl = ""

    // Strategy 1: Look for featured image
    const featuredImageMatch =
      cleanHtml.match(/<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]+)"/i) ||
      cleanHtml.match(/<img[^>]*class="[^"]*attachment[^"]*"[^>]*src="([^"]+)"/i)

    if (featuredImageMatch) {
      imageUrl = featuredImageMatch[1]
    }

    // Strategy 2: Look for Open Graph image
    if (!imageUrl) {
      const ogImageMatch = cleanHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
      if (ogImageMatch) {
        imageUrl = ogImageMatch[1]
      }
    }

    // Strategy 3: Look for first content image
    if (!imageUrl) {
      const contentImageMatch = cleanHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i)
      if (contentImageMatch) {
        const src = contentImageMatch[1]
        // Only use if it looks like a real article image
        if (src.includes("hongkongfp.com") || src.includes("wp-content") || src.includes("uploads")) {
          imageUrl = src
        }
      }
    }

    // Clean up image URL
    if (imageUrl) {
      if (imageUrl.startsWith("//")) {
        imageUrl = "https:" + imageUrl
      } else if (imageUrl.startsWith("/")) {
        imageUrl = "https://hongkongfp.com" + imageUrl
      }
      imageUrl = imageUrl.split("?")[0]
    }

    // Fallback image if none found
    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop"
    }

    // Extract content from entry-content or similar containers
    const contentMatch =
      cleanHtml.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      cleanHtml.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)

    let content = ""
    if (contentMatch) {
      // Extract paragraphs from content
      const paragraphMatches = contentMatch[1].match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
      if (paragraphMatches) {
        content = paragraphMatches
          .map((p) => p.replace(/<[^>]*>/g, "").trim())
          .filter((text) => text.length > 20 && !text.includes("Share this") && !text.includes("Subscribe"))
          .join("\n\n")
      }
    }

    // Fallback: extract all paragraphs
    if (!content || content.length < 100) {
      const allParagraphs = cleanHtml.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi)
      if (allParagraphs) {
        content = allParagraphs
          .map((p) => p.replace(/<[^>]*>/g, "").trim())
          .filter((text) => text.length > 20 && !text.includes("Share this") && !text.includes("Subscribe"))
          .join("\n\n")
      }
    }

    if (content && content.length > 100) {
      return {
        title,
        url,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate,
        author,
        imageUrl,
        source: "HKFP",
      }
    }
  } catch (e) {
    console.warn(`HKFP: Direct extraction failed for ${url}:`, e.message)
  }

  // Strategy 2: Jina.ai fallback
  await sleep(1500)
  return await extractArticleContentFallback(url)
}

async function extractArticleContentFallback(url) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const response = await fetch(jinaUrl, {
      headers: HDRS,
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.text()
    const lines = data.split("\n").filter((line) => line.trim())
    const title = lines.find((line) => line.startsWith("# "))?.substring(2) || "Untitled"
    const content = lines
      .filter(
        (line) =>
          !line.startsWith("#") &&
          !line.startsWith("*") &&
          !line.startsWith("**") &&
          line.length > 30 &&
          !line.includes("Share this") &&
          !line.includes("Subscribe"),
      )
      .join("\n\n")

    if (content && content.length > 100) {
      return {
        title,
        url,
        content,
        summary: content.substring(0, 200) + "...",
        publishDate: "",
        author: "",
        imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
        source: "HKFP",
      }
    }
  } catch (e) {
    console.warn(`HKFP: Jina.ai fallback failed for ${url}:`, e.message)
  }

  return null
}

// Enhanced orchestrator with content extraction
async function scrapeHKFPWithContent() {
  const headlines = await scrapeHKFP()
  const articles = []

  console.log(`HKFP: Extracting content for ${headlines.length} articles...`)

  for (let i = 0; i < headlines.length; i++) {
    const headline = headlines[i]
    console.log(`HKFP: Extracting ${i + 1}/${headlines.length}: ${headline.title.substring(0, 50)}...`)

    const article = await extractArticleContent(headline.url)
    if (article) {
      articles.push(article)
    } else {
      console.warn(`HKFP: Failed to extract content from ${headline.url}`)
      // Still include headline-only data as fallback
      articles.push({
        title: headline.title,
        url: headline.url,
        content: "",
        summary: headline.title,
        publishDate: "",
        author: "",
        imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=400&fit=crop",
        source: "HKFP",
      })
    }

    // Rate limiting
    if (i < headlines.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  return articles
}

// Original headline scraper with enhanced selectors
async function scrapeHKFP() {
  try {
    const response = await fetch("https://hongkongfp.com/", {
      headers: HDRS,
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const articles = []

    // Enhanced regex to find article links
    const articleRegex = /<article[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/article>/gi
    const titleLinkRegex =
      /<h[1-6][^>]*class="[^"]*entry-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i

    let match
    while ((match = articleRegex.exec(html)) !== null && articles.length < 10) {
      const articleContent = match[1]
      const titleLinkMatch = titleLinkRegex.exec(articleContent)

      if (titleLinkMatch) {
        const url = titleLinkMatch[1]
        const title = titleLinkMatch[2].trim()

        if (title && url && title.length > 10) {
          articles.push({
            title,
            url: url.startsWith("http") ? url : `https://hongkongfp.com${url}`,
          })
        }
      }
    }

    console.log(`HKFP: Found ${articles.length} articles`)
    return articles
  } catch (err) {
    console.error("HKFP scrape failed:", err.message)
    return []
  }
}

module.exports = { scrapeHKFP, scrapeHKFPWithContent }
