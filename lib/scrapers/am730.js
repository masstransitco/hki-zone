// AM730 scraper adapted for orchestrator integration
// Based on am730Scraper.mjs

const BASE = 'https://www.am730.com.hk';
const DEFAULT_CATEGORIES = [
  '本地','國際','財經','中國','娛樂','生活','科技','地產','健康','體育'
];
const UA = 'HKIbot (+https://hki.ai)';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

async function fetchListing(cat) {
  const url = `${BASE}/${encodeURIComponent(cat)}`;
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': UA, 
        'Accept-Language': 'zh-HK,zh;q=0.9' 
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    // Extract article links using regex
    const linkMatches = html.match(/href="([^"]*\/\d+)"/g) || [];
    const links = linkMatches
      .map(match => match.match(/href="([^"]*)"/)[1])
      .filter(href => href && /\/\d+$/.test(href))
      .map(href => new URL(href, BASE).href);

    return Array.from(new Set(links)).slice(0, 25);
  } catch (e) {
    console.warn(`[AM730 listing] ${cat} → ${e.message}`);
    return [];
  }
}

function extractPublished(html) {
  // Try Open Graph meta tag
  const ogMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogMatch) return ogMatch[1];
  
  // Try JSON-LD
  const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/is);
  if (ldMatch) {
    try {
      const json = JSON.parse(ldMatch[1]);
      if (json?.datePublished) return json.datePublished;
    } catch {}
  }
  
  // Try time element
  const timeMatch = html.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i) || 
                    html.match(/<time[^>]*>([^<]*)<\/time>/i);
  if (timeMatch) return timeMatch[1];
  
  return '';
}

function extractBody(html) {
  // Remove scripts, styles, and other non-content elements
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments

  // Strategy 1: Try to find article content containers first
  let content = '';
  const containerPatterns = [
    /<div[^>]*class="[^"]*article__body[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*itemprop="articleBody"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class="[^"]*article_content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*article_detail[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi
  ];

  for (const pattern of containerPatterns) {
    const matches = [...cleanHtml.matchAll(pattern)];
    if (matches.length > 0) {
      content = matches.map(match => match[1]).join('\n');
      break;
    }
  }

  // Strategy 2: If no containers found, extract from entire body but be more selective
  if (!content) {
    content = cleanHtml;
  }

  // Extract meaningful text content
  const texts = [];
  
  // Extract from paragraphs, headings, list items, and divs
  const textElements = content.match(/<(p|h[1-6]|li|div)[^>]*>([^<]*(?:<(?!\/\1)[^>]*>[^<]*)*)<\/\1>/gi) || [];
  
  for (const element of textElements) {
    const text = element
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
    
    // Filter out unwanted content
    if (text && 
        text.length > 10 && // Minimum length
        !text.match(/^(返回|分享：|ADVERTISEMENT|熱門搜尋|支持AM730|Facebook|Instagram|Youtube|搜尋|登出|我的收藏|積分及獎賞|活動列表|帳戶概覽|相關新聞|更多新聞|訂閱|通知|廣告)$/i) &&
        !text.includes('熱門搜尋:') &&
        !text.includes('window._taboola') &&
        !text.includes('_taboola.push') &&
        !text.includes('element reset style') &&
        !text.includes('css specificities') &&
        !text.match(/^\d{4}-\d{2}-\d{2}/) && // Date patterns
        !text.match(/^https?:\/\//) && // URLs
        text.split('').some(char => /[\u4e00-\u9fff]/.test(char))) { // Must contain Chinese characters
      texts.push(text);
    }
  }
  
  // Remove duplicates and join
  const uniqueTexts = [...new Set(texts)];
  return uniqueTexts.join('\n\n').trim();
}

function isSponsored(headline, fullText) {
  return /資料由客戶提供/.test(headline) || /資料由客戶提供/.test(fullText);
}

async function fetchArticle(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();

    // Enhanced headline extraction with multiple strategies
    let headline = '';
    
    // Strategy 1: H1 tags
    const h1Matches = [
      html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i),
      html.match(/<h1[^>]*class="[^"]*headline[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/h1>/i),
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
      const ogMatches = [
        html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i),
        html.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]*)"[^>]*>/i)
      ];
      
      for (const match of ogMatches) {
        if (match && match[1]) {
          headline = match[1].trim();
          if (headline && headline.length > 3) break;
        }
      }
    }
    
    // Strategy 3: Title tag
    if (!headline) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        headline = titleMatch[1]
          .replace(/\s*-\s*AM730/i, '')
          .replace(/\s*\|\s*AM730/i, '')
          .trim();
      }
    }
    
    // Strategy 4: Article title class variations
    if (!headline) {
      const classTitleMatches = [
        html.match(/<[^>]*class="[^"]*article-title[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/[^>]*>/i),
        html.match(/<[^>]*class="[^"]*post-title[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/[^>]*>/i),
        html.match(/<[^>]*class="[^"]*news-title[^"]*"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/[^>]*>/i)
      ];
      
      for (const match of classTitleMatches) {
        if (match && match[1]) {
          headline = match[1].replace(/<[^>]*>/g, '').trim();
          if (headline && headline.length > 3) break;
        }
      }
    }

    const date = extractPublished(html);
    const body = extractBody(html);

    // Extract cover image with multiple strategies
    let coverImg = null;
    
    // Strategy 1: Article content figure image
    const articleImgMatch = html.match(/<div[^>]*class="[^"]*article_content[^"]*"[^>]*>[\s\S]*?<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/i);
    if (articleImgMatch) {
      coverImg = articleImgMatch[1];
    }
    
    // Strategy 2: Any figure image in article content
    if (!coverImg) {
      const figureImgMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/i);
      if (figureImgMatch) {
        coverImg = figureImgMatch[1];
      }
    }
    
    // Strategy 3: First image in article content div
    if (!coverImg) {
      const contentImgMatch = html.match(/<div[^>]*class="[^"]*article_content[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>/i);
      if (contentImgMatch) {
        coverImg = contentImgMatch[1];
      }
    }
    
    // Strategy 4: Any img with article-related classes
    if (!coverImg) {
      const classImgMatches = [
        html.match(/<img[^>]*class="[^"]*article[^"]*"[^>]*src="([^"]*)"[^>]*>/i),
        html.match(/<img[^>]*class="[^"]*content[^"]*"[^>]*src="([^"]*)"[^>]*>/i),
        html.match(/<img[^>]*class="[^"]*featured[^"]*"[^>]*src="([^"]*)"[^>]*>/i)
      ];
      
      for (const match of classImgMatches) {
        if (match && match[1]) {
          coverImg = match[1];
          break;
        }
      }
    }
    
    // Strategy 5: Open Graph image (fallback, but filter out logos)
    if (!coverImg) {
      const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
      if (ogImageMatch && ogImageMatch[1]) {
        const ogImg = ogImageMatch[1];
        // Only use og:image if it's not likely to be a logo
        const isLikelyLogo = ogImg.includes('logo') || 
                            ogImg.includes('icon') || 
                            ogImg.includes('default') ||
                            ogImg.includes('favicon') ||
                            ogImg.match(/am730.*logo/i) ||
                            ogImg.match(/logo.*am730/i);
        if (!isLikelyLogo) {
          coverImg = ogImg;
        }
      }
    }

    const sponsored = isSponsored(headline, body);

    // Validation: ensure we have required fields
    if (!headline || headline.length < 3) {
      console.warn(`[AM730 article] No valid headline found for ${url}`);
      return null;
    }

    return { 
      source: 'am730', 
      url, 
      headline, 
      date, 
      body, 
      coverImg, 
      sponsored 
    };
  } catch (e) {
    console.warn(`[AM730 article] ${url} → ${e.message}`);
    return null;
  }
}

// Main scraper function compatible with orchestrator
export async function scrapeAM730() {
  const results = [];
  const categories = DEFAULT_CATEGORIES;
  
  console.log(`[AM730] Starting scrape of ${categories.length} categories`);
  
  // Fetch listings from all categories
  const allLinks = [];
  for (const cat of categories) {
    const links = await fetchListing(cat);
    allLinks.push(...links);
    await sleep(200); // Small delay between category requests
  }
  
  // Remove duplicates
  const uniqueLinks = Array.from(new Set(allLinks));
  console.log(`[AM730] Found ${uniqueLinks.length} unique articles`);
  
  // Process articles with rate limiting
  const concurrentLimit = 4;
  for (let i = 0; i < uniqueLinks.length; i += concurrentLimit) {
    const batch = uniqueLinks.slice(i, i + concurrentLimit);
    const promises = batch.map(async (url) => {
      await sleep(180); // Rate limiting
      return fetchArticle(url);
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    
    console.log(`[AM730] Processed ${Math.min(i + concurrentLimit, uniqueLinks.length)}/${uniqueLinks.length} articles`);
  }
  
  // Add article IDs
  const final = results.map(article => {
    const idMatch = article.url.match(/(\d+)$/);
    article.id = idMatch ? Number(idMatch[1]) : null;
    return article;
  });
  
  console.log(`[AM730] Completed scrape: ${final.length} articles (${final.filter(a => a.sponsored).length} sponsored)`);
  
  return final;
}