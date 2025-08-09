const BASE = 'https://www.bastillepost.com';
const DEFAULT_CATEGORIES = ['hongkong', 'hongkong/category/politics', 'hongkong/category/economy', 'hongkong/category/local'];
const UA = 'HKIbot (+https://hki.ai)';
const SOURCE_NAME = 'BastillePost';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

async function fetchListing(category) {
  const url = category.startsWith('http') ? category : `${BASE}/${category}`;
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': UA, 
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' 
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    
    // Extract article links using regex pattern for Bastille Post
    const linkMatches = html.match(/href="(\/hongkong\/article\/\d+[^"]*)"/g) || [];
    const links = linkMatches
      .map(match => match.match(/href="([^"]*)"/)[1])
      .map(href => new URL(href, BASE).href);

    return Array.from(new Set(links)).slice(0, 25);
  } catch (e) {
    console.warn(`[${SOURCE_NAME} listing] ${category} → ${e.message}`);
    return [];
  }
}

async function fetchArticle(url) {
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': UA,
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Enhanced headline extraction with multiple strategies
    let headline = '';
    
    // Strategy 1: H1 tags
    const h1Matches = [
      html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i),
      html.match(/<h1[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i)
    ];
    
    for (const match of h1Matches) {
      if (match && match[1]) {
        headline = match[1].replace(/<[^>]*>/g, '').trim();
        if (headline && headline.length > 3) break;
      }
    }
    
    // Strategy 2: Open Graph title
    if (!headline) {
      const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
      if (ogMatch && ogMatch[1]) {
        headline = ogMatch[1].trim();
      }
    }
    
    // Strategy 3: Title tag
    if (!headline) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        headline = titleMatch[1]
          .replace(/\s*-\s*巴士的報/i, '')
          .replace(/\s*\|.*$/, '')
          .trim();
      }
    }

    // Extract published date
    // Look for Chinese date format: "2025年05月06日 20:16"
    const dateMatch = html.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})/);
    let date = '';
    if (dateMatch) {
      const [, y, mo, d, hh, mm] = dateMatch;
      date = `${y}-${mo}-${d}T${hh}:${mm}:00+08:00`;
    } else {
      // Fallback to ISO date formats or article:published_time
      const isoMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"[^>]*>/i) ||
                       html.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
      date = isoMatch ? isoMatch[1] : '';
    }

    // Extract body content
    // Look for article content containers
    const bodyPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*single-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i
    ];
    
    let body = '';
    for (const pattern of bodyPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Extract paragraph text
        const paragraphs = match[1].match(/<p[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/p>/gi) || [];
        const textParts = paragraphs
          .map(p => p.replace(/<[^>]*>/g, '').trim())
          .filter(text => text && text.length > 10);
        
        if (textParts.length > 0) {
          body = textParts.join('\n\n');
          break;
        }
      }
    }
    
    // Fallback: extract all paragraphs
    if (!body) {
      const allParagraphs = html.match(/<p[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/p>/gi) || [];
      const textParts = allParagraphs
        .map(p => p.replace(/<[^>]*>/g, '').trim())
        .filter(text => text && text.length > 10 && !text.includes('分享至'));
      body = textParts.slice(0, 20).join('\n\n'); // Limit to first 20 paragraphs
    }

    // Clean up body content
    body = body
      .replace(/分享至.*/g, '')
      .replace(/Share:?.*/gi, '')
      .replace(/大視野|點擊看圖輯/g, '')
      .trim();

    // Extract cover image
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) ||
                     html.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]*)"[^>]*>/i) ||
                     html.match(/image\.bastillepost\.com[^"']*\.(?:jpg|jpeg|png|webp)/i);
    
    let coverImg = null;
    if (imgMatch) {
      coverImg = imgMatch[1] || imgMatch[0];
      if (coverImg && !coverImg.startsWith('http')) {
        coverImg = new URL(coverImg, BASE).href;
      }
    }

    // Validation: ensure we have required fields
    if (!headline || headline.length < 3) {
      console.warn(`[${SOURCE_NAME} article] No valid headline found for ${url}`);
      return null;
    }

    if (!body || body.length < 50) {
      console.warn(`[${SOURCE_NAME} article] Insufficient content for ${url}`);
      return null;
    }

    return { 
      source: 'bastillepost', 
      url, 
      headline, 
      date, 
      body, 
      coverImg,
      sponsored: false
    };
  } catch (e) {
    console.warn(`[${SOURCE_NAME} article] ${url} → ${e.message}`);
    return null;
  }
}

// Main scraper function compatible with orchestrator
async function scrapeBastillePost() {
  const results = [];
  const categories = DEFAULT_CATEGORIES;
  
  console.log(`[${SOURCE_NAME}] Starting scrape of ${categories.length} categories`);
  
  // Fetch listings from all categories
  const allLinks = [];
  for (const cat of categories) {
    const links = await fetchListing(cat);
    allLinks.push(...links);
    await sleep(300); // Rate limiting between category requests
  }
  
  // Remove duplicates
  const uniqueLinks = Array.from(new Set(allLinks));
  console.log(`[${SOURCE_NAME}] Found ${uniqueLinks.length} unique articles`);
  
  // Process articles with rate limiting
  const concurrentLimit = 3; // Lower concurrency for Bastille Post
  for (let i = 0; i < uniqueLinks.length; i += concurrentLimit) {
    const batch = uniqueLinks.slice(i, i + concurrentLimit);
    const promises = batch.map(async (url) => {
      await sleep(250); // Rate limiting between requests
      return fetchArticle(url);
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    
    console.log(`[${SOURCE_NAME}] Processed ${Math.min(i + concurrentLimit, uniqueLinks.length)}/${uniqueLinks.length} articles`);
  }
  
  // Add article IDs if URL contains ID pattern
  const final = results.map(article => {
    const idMatch = article.url.match(/article\/(\d+)/);
    article.id = idMatch ? Number(idMatch[1]) : null;
    return article;
  });
  
  console.log(`[${SOURCE_NAME}] Completed scrape: ${final.length} articles`);
  
  return final;
}

module.exports = { scrapeBastillePost };