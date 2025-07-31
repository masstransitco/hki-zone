# New Scraper Integration Guide

This guide documents the complete workflow for integrating a new scraper into the orchestration system, based on the AM730 scraper integration.

## Overview

The scraper system consists of multiple layers:
- **Individual Scrapers**: Extract articles from news sources
- **Orchestrator**: Coordinates scraping, handles progress tracking, saves to database
- **Admin Panel**: Manual controls and real-time progress monitoring
- **Cron Jobs**: Automated scheduling
- **Database Integration**: Article storage with de-duplication

## Prerequisites

- News source identified with consistent URL patterns
- Understanding of the source's HTML structure
- Rate limiting considerations
- Source categorization (news vs. cars vs. other)

## Integration Workflow

### Step 1: Create the Individual Scraper

**File**: `/lib/scrapers/{source-name}.js`

```javascript
// Template structure for new scraper
const BASE = 'https://example-news-site.com';
const DEFAULT_CATEGORIES = ['local', 'international', 'business'];
const UA = 'HKIbot (+https://hki.ai)';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

async function fetchListing(category) {
  const url = `${BASE}/${encodeURIComponent(category)}`;
  try {
    const response = await fetch(url, {
      headers: { 
        'User-Agent': UA, 
        'Accept-Language': 'en-US,en;q=0.9' 
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    
    // Extract article links using regex
    const linkMatches = html.match(/href="([^"]*\/article\/\d+)"/g) || [];
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
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Enhanced headline extraction with multiple strategies
    let headline = '';
    
    // Strategy 1: H1 tags with title classes
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
          .replace(/\s*-\s*SiteName/i, '')
          .trim();
      }
    }

    // Extract published date
    const dateMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"[^>]*>/i) ||
                      html.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
    const date = dateMatch ? dateMatch[1] : '';

    // Extract body content
    const bodyMatch = html.match(/<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const body = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    // Extract cover image
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    const coverImg = imgMatch ? imgMatch[1] : null;

    // Validation: ensure we have required fields
    if (!headline || headline.length < 3) {
      console.warn(`[${SOURCE_NAME} article] No valid headline found for ${url}`);
      return null;
    }

    return { 
      source: '{source-name}', 
      url, 
      headline, 
      date, 
      body, 
      coverImg,
      sponsored: false // Implement sponsored detection logic if needed
    };
  } catch (e) {
    console.warn(`[${SOURCE_NAME} article] ${url} → ${e.message}`);
    return null;
  }
}

// Main scraper function compatible with orchestrator
export async function scrape{SourceName}() {
  const results = [];
  const categories = DEFAULT_CATEGORIES;
  
  console.log(`[${SOURCE_NAME}] Starting scrape of ${categories.length} categories`);
  
  // Fetch listings from all categories
  const allLinks = [];
  for (const cat of categories) {
    const links = await fetchListing(cat);
    allLinks.push(...links);
    await sleep(200); // Rate limiting between category requests
  }
  
  // Remove duplicates
  const uniqueLinks = Array.from(new Set(allLinks));
  console.log(`[${SOURCE_NAME}] Found ${uniqueLinks.length} unique articles`);
  
  // Process articles with rate limiting
  const concurrentLimit = 4;
  for (let i = 0; i < uniqueLinks.length; i += concurrentLimit) {
    const batch = uniqueLinks.slice(i, i + concurrentLimit);
    const promises = batch.map(async (url) => {
      await sleep(180); // Rate limiting between requests
      return fetchArticle(url);
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    
    console.log(`[${SOURCE_NAME}] Processed ${Math.min(i + concurrentLimit, uniqueLinks.length)}/${uniqueLinks.length} articles`);
  }
  
  // Add article IDs if URL contains ID pattern
  const final = results.map(article => {
    const idMatch = article.url.match(/(\d+)$/);
    article.id = idMatch ? Number(idMatch[1]) : null;
    return article;
  });
  
  console.log(`[${SOURCE_NAME}] Completed scrape: ${final.length} articles`);
  
  return final;
}
```

### Step 2: Update Orchestrator

**File**: `/lib/scraper-orchestrator.ts`

1. **Add Import**:
```typescript
const { scrape{SourceName} } = require("./scrapers/{source-name}")
```

2. **Add to OUTLET_SCRAPERS**:
```typescript
const OUTLET_SCRAPERS = {
  // ... existing scrapers
  '{source-key}': scrape{SourceName},
}
```

3. **Add to OUTLET_NAMES**:
```typescript
const OUTLET_NAMES = {
  // ... existing names
  '{source-key}': "{Display Name}",
}
```

4. **Add to NEWS_OUTLET_SCRAPERS** (if it's a news source):
```typescript
const NEWS_OUTLET_SCRAPERS = {
  // ... existing scrapers
  '{source-key}': scrape{SourceName},
}
```

5. **Update Category Mapping**:
```typescript
function getCategoryFromSource(source: string): string {
  switch (source.toLowerCase()) {
    // ... existing cases
    case "{source-name}":
      return "Local" // or appropriate category
    default:
      return "General"
  }
}
```

6. **Update Source Counting**:
```typescript
sources: {
  // ... existing sources
  {DISPLAY_NAME}: allArticles.filter((a) => a.source === "{source-name}").length,
},
```

### Step 3: Update Admin Panel Components

**File**: `/components/admin-panel.tsx`

Add to `OUTLET_NAMES`:
```typescript
const OUTLET_NAMES = {
  // ... existing outlets
  '{source-key}': "{Display Name}",
}
```

**File**: `/hooks/use-scrape-progress.ts`

Add to outlets:
```typescript
outlets: {
  // ... existing outlets
  '{source-key}': { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
},
```

**File**: `/app/api/scrape/progress/route.ts`

Add to outlets:
```typescript
outlets: {
  // ... existing outlets
  '{source-key}': { status: 'idle', progress: 0, articlesFound: 0, message: 'Ready' },
},
```

**File**: `/app/api/scrape/[outlet]/route.ts`

Add to `OUTLET_NAMES`:
```typescript
const OUTLET_NAMES = {
  // ... existing outlets
  '{source-key}': "{Display Name}",
}
```

### Step 4: Update Database Integration

**File**: `/lib/supabase.ts`

Add to balanced articles sources (if news source):
```typescript
const sources = ['HK01', 'on.cc', 'SingTao', 'RTHK', 'HKFP', 'ONCC', 'am730', '{source-name}']
```

### Step 5: Update News Feed (Optional)

The news feed will automatically include articles from the new source once they're saved to the database with the correct source field.

## Key Integration Patterns

### 1. **Error Handling & Validation**
- Always validate required fields (headline, URL) before returning articles
- Use try-catch blocks for network requests
- Return `null` for failed articles instead of throwing errors
- Log warnings for debugging without breaking the process

### 2. **Rate Limiting**
- Add delays between category requests: `await sleep(200)`
- Add delays between article requests: `await sleep(180)` 
- Use concurrent batching: `const concurrentLimit = 4`
- Respect the target site's robots.txt and rate limits

### 3. **De-duplication**
- In-session: Use `Array.from(new Set(allLinks))` for unique URLs
- Database-level: Handled automatically by `saveArticle()` function
- URL normalization: Ensure consistent URL format

### 4. **Content Extraction Strategies**
- **Multiple Fallbacks**: Try different selectors/patterns
- **HTML vs Regex**: Prefer regex for simple patterns, HTML parsing for complex
- **Content Validation**: Check minimum length requirements
- **Encoding**: Handle different character encodings

### 5. **Progress Tracking**
- Log start/progress/completion messages
- Use consistent naming: `[SOURCE_NAME]` prefix
- Include metrics: articles found, processed, saved
- Handle empty results gracefully

## Testing Your Integration

### 1. **Manual Testing**
```bash
# Test individual scraper
curl -X POST http://localhost:3000/api/scrape/{source-key}

# Check admin panel
http://localhost:3000/admin
```

### 2. **Validation Checklist**
- [ ] Scraper returns articles with valid headlines
- [ ] URLs are correctly formatted and unique
- [ ] Date extraction works for the source's format
- [ ] Body content is clean (no HTML tags/navigation)
- [ ] Images are properly extracted
- [ ] Rate limiting respects source's requirements
- [ ] Admin panel shows the new outlet
- [ ] Manual scraping works from admin interface
- [ ] Articles save to database without errors
- [ ] De-duplication prevents saving same article twice
- [ ] Articles appear in news feed

### 3. **Common Issues & Solutions**

**Issue**: Articles saving with null titles
**Solution**: Improve headline extraction strategies, add validation

**Issue**: Rate limiting causes timeouts/blocks
**Solution**: Increase sleep delays, reduce concurrent requests

**Issue**: Content extraction returns HTML
**Solution**: Add HTML tag removal: `.replace(/<[^>]*>/g, '')`

**Issue**: Duplicate articles being saved
**Solution**: Check URL normalization and database URL matching

**Issue**: Admin panel doesn't show new outlet
**Solution**: Verify all outlet name mappings are consistent

## File Checklist

When integrating a new scraper, update these files:

- [ ] `/lib/scrapers/{source-name}.js` - New scraper
- [ ] `/lib/scraper-orchestrator.ts` - Orchestrator integration  
- [ ] `/components/admin-panel.tsx` - Admin panel names
- [ ] `/hooks/use-scrape-progress.ts` - Progress tracking
- [ ] `/app/api/scrape/progress/route.ts` - Server-side progress
- [ ] `/app/api/scrape/[outlet]/route.ts` - API route mapping
- [ ] `/lib/supabase.ts` - Database integration (if news source)

## Advanced Features

### State Persistence (Optional)
For sources that require state persistence between scrapes:

```javascript
// Add state management similar to original AM730 scraper
const STATE_FILE = `.${source-name}_state.json`;

async function loadState(reset = false) {
  if (reset) return { lastSeenId: 0, seen: {} };
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastSeenId: 0, seen: {} };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}
```

### Custom Cron Schedule
Add custom scheduling in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-{source}",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Source-Specific Processing
For sources requiring special handling (like car listings):

```typescript
// In orchestrator, add special case handling
if (outletKey === '{special-source}') {
  // Custom save logic
  const { article: saved, error } = await saveSpecialArticle(article)
} else {
  // Standard save logic
  const saved = await saveArticle(article)
}
```

## Conclusion

This integration pattern ensures:
- **Consistency**: All scrapers follow the same structure
- **Reliability**: Multiple fallbacks and error handling
- **Scalability**: Easy to add new sources
- **Maintainability**: Clear separation of concerns
- **Monitoring**: Real-time progress tracking
- **De-duplication**: Prevents duplicate articles

Follow this guide for any new news source integration to maintain system consistency and reliability.