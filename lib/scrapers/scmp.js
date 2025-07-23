// SCMP scraper adapted for orchestrator integration
// Based on scmpScraper.mjs - using RSS feeds for article discovery

const RSS_FEEDS = [
  ["https://www.scmp.com/rss/91/feed", "hongkong"],
  ["https://www.scmp.com/rss/2/feed",  "china"],
  ["https://www.scmp.com/rss/3/feed",  "asia"],
  ["https://www.scmp.com/rss/4/feed",  "world"],
];

const UA = 'HKIbot (+https://hki.ai)';
const SOURCE_NAME = 'SCMP';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

// Utility functions
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach((p)=>u.searchParams.delete(p));
    return u.toString();
  } catch { return raw; }
}

function cleanBody(text = "") {
  return text
    .replace(/^\s*\d{2}:\d{2}\s*$/gm, "") // drop timestamp-only lines
    .replace(/^\s*SCMP\+?.*$/gim, "")     // promo lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchRSSFeed(url) {
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': UA, 
        'Accept': 'application/rss+xml, application/xml, text/xml' 
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const xmlText = await response.text();
    
    // Simple XML parsing to extract items
    const items = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];
    
    for (const itemMatch of itemMatches) {
      const titleMatch = itemMatch.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                        itemMatch.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemMatch.match(/<link>(.*?)<\/link>/);
      const descMatch = itemMatch.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || 
                       itemMatch.match(/<description>(.*?)<\/description>/);
      const pubDateMatch = itemMatch.match(/<pubDate>(.*?)<\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : '',
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : ''
        });
      }
    }
    
    return items;
  } catch (e) {
    console.warn(`[${SOURCE_NAME} RSS] ${url} → ${e.message}`);
    return [];
  }
}

async function fetchRSSListings() {
  const allItems = [];
  
  for (const [feedUrl, category] of RSS_FEEDS) {
    const items = await fetchRSSFeed(feedUrl);
    const itemsWithCategory = items.map(item => ({ ...item, category }));
    allItems.push(...itemsWithCategory);
    await sleep(200); // Rate limiting between feeds
  }
  
  // Deduplicate by URL
  const uniqueItems = [];
  const seenUrls = new Set();
  
  for (const item of allItems) {
    const normalizedUrl = normalizeUrl(item.link);
    if (!seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      uniqueItems.push({ ...item, link: normalizedUrl });
    }
  }
  
  return uniqueItems.slice(0, 50); // Limit to 50 articles
}

function extractFromLDJSON(html) {
  const scriptMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (const scriptMatch of scriptMatches) {
    try {
      const jsonText = scriptMatch.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
      const json = JSON.parse(jsonText);
      
      const article = Array.isArray(json) 
        ? json.find(item => item && (item["@type"] === "NewsArticle" || item["@type"] === "Article"))
        : (json["@type"] === "NewsArticle" || json["@type"] === "Article") ? json : null;
      
      if (article) {
        const img = Array.isArray(article.image)
          ? article.image[0]
          : article.image?.url || article.image;

        const author = Array.isArray(article.author)
          ? article.author.map((a) => a.name || a).join(", ")
          : article.author?.name || article.author;

        return {
          headline: article.headline,
          image: img,
          body: article.articleBody,
          datePublished: article.datePublished,
          dateModified: article.dateModified,
          author,
          articleSection: article.articleSection,
          keywords: Array.isArray(article.keywords) ? article.keywords.join(", ") : article.keywords,
        };
      }
    } catch (e) {
      // Continue to next script tag
    }
  }
  
  return null;
}

function extractBodyFallback(html) {
  const selectors = [
    /<article[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*article-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*basic-article__body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*data-testid="article-body"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i
  ].map(regex => html.match(regex));

  for (const match of selectors) {
    if (match && match[1] && match[1].length > 300) {
      // Extract text from paragraphs
      const paragraphs = match[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
      return paragraphs
        .map(p => p.replace(/<[^>]*>/g, '').trim())
        .filter(text => text.length > 0)
        .join('\n\n');
    }
  }
  
  // Final fallback - extract all paragraphs
  const allParagraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  return allParagraphs
    .map(p => p.replace(/<[^>]*>/g, '').trim())
    .filter(text => text.length > 20) // Filter out very short paragraphs
    .join('\n\n');
}

async function fetchArticle(rssItem) {
  try {
    const response = await fetch(rssItem.link, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    // Extract structured data first
    let extracted = extractFromLDJSON(html);
    let body = extracted?.body || "";
    
    // If body is insufficient, use fallback extraction
    if (!body || body.length < 200) {
      body = extractBodyFallback(html) || body;
    }
    
    // Extract article ID from URL
    const canonical = normalizeUrl(rssItem.link);
    const idMatch = canonical.match(/\/article\/(\d+)\//);
    const articleId = idMatch ? idMatch[1] : null;
    
    // Get headline from multiple sources
    const headline = 
      extracted?.headline ||
      rssItem.title || // Fallback to RSS title
      html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*South China Morning Post.*$/i, '').trim();

    // Get cover image
    const image = extracted?.image || 
                 html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)?.[1];

    // Get publication date
    const date = extracted?.datePublished || 
                rssItem.pubDate ||
                html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"[^>]*>/i)?.[1];

    // Validation: ensure we have required fields
    if (!headline || headline.length < 3) {
      console.warn(`[${SOURCE_NAME} article] No valid headline found for ${rssItem.link}`);
      return null;
    }

    if (!body || body.length < 100) {
      console.warn(`[${SOURCE_NAME} article] Insufficient body content for ${rssItem.link}`);
      return null;
    }

    return { 
      source: 'scmp', 
      url: canonical, 
      headline: headline.trim(), 
      date, 
      body: cleanBody(body), 
      coverImg: image || null,
      sponsored: false, // SCMP doesn't typically mark sponsored content in RSS
      id: articleId ? Number(articleId) : null
    };
  } catch (e) {
    console.warn(`[${SOURCE_NAME} article] ${rssItem.link} → ${e.message}`);
    return null;
  }
}

// Main scraper function compatible with orchestrator
export async function scrapeSCMP() {
  const results = [];
  
  console.log(`[${SOURCE_NAME}] Starting RSS-based scrape`);
  
  // Fetch listings from RSS feeds
  const rssItems = await fetchRSSListings();
  console.log(`[${SOURCE_NAME}] Found ${rssItems.length} articles from RSS feeds`);
  
  if (rssItems.length === 0) {
    console.log(`[${SOURCE_NAME}] No articles found in RSS feeds`);
    return [];
  }
  
  // Process articles with rate limiting
  const concurrentLimit = 4;
  for (let i = 0; i < rssItems.length; i += concurrentLimit) {
    const batch = rssItems.slice(i, i + concurrentLimit);
    const promises = batch.map(async (rssItem) => {
      await sleep(250); // More conservative rate limiting for SCMP
      return fetchArticle(rssItem);
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    
    console.log(`[${SOURCE_NAME}] Processed ${Math.min(i + concurrentLimit, rssItems.length)}/${rssItems.length} articles`);
  }
  
  console.log(`[${SOURCE_NAME}] Completed scrape: ${results.length} articles`);
  
  return results;
}