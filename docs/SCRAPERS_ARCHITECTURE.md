# Scrapers Architecture

## Overview

The Panora.hk scraping system is a robust, multi-source news aggregation platform that extracts articles from 5 major Hong Kong news outlets. It features a layered architecture with fallback mechanisms, AI-powered content processing, and comprehensive error handling.

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────┐
│                Scraper Orchestrator              │
├─────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  HKFP   │ │ SingTao │ │  HK01   │ │  ONCC   │ │
│  │ Scraper │ │ Scraper │ │ Scraper │ │ Scraper │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────────────────┤
│              AI Summarizer (Claude)              │
├─────────────────────────────────────────────────┤
│            Database Layer (Supabase)             │
└─────────────────────────────────────────────────┘
```

## Scraper Orchestrator

### Core Functionality (`/lib/scraper-orchestrator.ts`)

The orchestrator manages the execution of all scrapers and coordinates the data flow:

```typescript
const OUTLET_SCRAPERS = {
  hkfp: scrapeHKFPWithContent,
  singtao: scrapeSingTaoWithContent,
  hk01: scrapeHK01WithContent,
  oncc: scrapeOnccWithContent,
  rthk: scrapeRTHKWithContent,
}
```

#### Execution Flow

1. **Parallel Execution**: All scrapers run simultaneously using `Promise.allSettled()`
2. **Progress Tracking**: Real-time updates via Server-Sent Events
3. **Error Isolation**: Failed scrapers don't affect others
4. **Fallback Strategy**: Mock data when all scrapers fail
5. **AI Processing**: Automatic summarization for incomplete content
6. **Database Storage**: Duplicate detection and storage

### Individual Scraper Functions

Each scraper follows a standardized pattern:

```typescript
export async function runSingleScraper(outletKey: string, withProgress = false) {
  // 1. Progress initialization
  // 2. Content extraction
  // 3. AI summarization (if needed)
  // 4. Database storage
  // 5. Progress completion
}
```

## Individual Scraper Architecture

### 1. HKFP Scraper (`/lib/scrapers/hkfp.js`)

#### Content Discovery Strategy
- **Primary**: RSS feed parsing
- **Secondary**: HTML front-page scraping
- **Fallback**: Jina.ai proxy extraction

#### Content Extraction
- **Selectors**: `.post-content`, `.entry-content`, `article`
- **Image Extraction**: Featured images, Open Graph, content images
- **Metadata**: Author, publish date, category extraction

### 2. SingTao Scraper (`/lib/scrapers/singtao.js`)

#### Multi-tier Approach
- **RSS Feeds**: Multiple category feeds (local, international, finance)
- **HTML Scraping**: Category-based article discovery
- **Content Processing**: Big-5/UTF-8 encoding handling

#### Image Processing Strategy
```javascript
// 4-tier image discovery
1. Featured/article images (.featured-image, .article-image)
2. Open Graph metadata (og:image)
3. Content images from SingTao domains
4. Fallback placeholder images
```

### 3. HK01 Scraper (`/lib/scrapers/hk01.js`)

#### API Integration
- **JSON API**: Direct API endpoint access
- **HTML Fallback**: Category-based scraping
- **Sitemap Parsing**: XML sitemap as last resort

#### Advanced Content Extraction
```javascript
const contentSelectors = [
  "content-article-content",
  "article-content", 
  "content-body",
  "entry-content",
  "post-content"
]
```

### 4. ONCC Scraper (`/lib/scrapers/oncc.js`)

#### Multi-source Discovery
- **RSSHub Mirrors**: Primary RSS aggregation
- **Native XML Feeds**: Direct outlet RSS feeds
- **HTML Scraping**: Front-page link extraction
- **Jina.ai Proxy**: AI-powered fallback

#### Encoding Handling
```javascript
// Charset detection and conversion
const charset = (res.headers['content-type'] || '')
  .match(/charset=([^;]+)/i)?.[1]?.toLowerCase() || 'utf-8'
const html = iconv.decode(res.data, charset)
```

### 5. RTHK Scraper (`/lib/scrapers/rthk.js`)

#### Government Source Optimization
- **Official RSS**: Multiple government RSS feeds
- **HTML Scraping**: Structured government website parsing
- **Content Extraction**: Government-specific selectors

#### Image Enhancement (Recently Added)
```javascript
// RTHK-specific image discovery
- Featured images: .featured-image, .news-image
- Open Graph: meta[property="og:image"]
- RTHK domains: rthk.hk, news.rthk.hk
- Quality fallbacks: Unsplash placeholders
```

## Content Processing Pipeline

### 1. Article Discovery Phase

```javascript
// Standard scraper pattern
async function scraper() {
  let items = await primaryMethod()    // RSS, API, etc.
  if (items.length) return items
  
  items = await secondaryMethod()      // HTML scraping
  if (items.length) return items
  
  return await fallbackMethod()        // Jina.ai, mock data
}
```

### 2. Content Extraction Phase

```javascript
async function extractArticleContent(url) {
  try {
    // Primary extraction with charset handling
    const response = await fetch(url, { responseType: 'arraybuffer' })
    const html = iconv.decode(response.data, detectedCharset)
    
    // Image extraction (4-tier strategy)
    let imageUrl = extractFeaturedImage(html) ||
                   extractOpenGraphImage(html) ||
                   extractContentImage(html) ||
                   getFallbackImage()
    
    // Content extraction with multiple selectors
    let content = extractWithSelectors(html, contentSelectors)
    
    return {
      title, url, content, summary, imageUrl, source, author, publishDate
    }
  } catch (error) {
    // Fallback to Jina.ai proxy
    return await extractWithJina(url)
  }
}
```

### 3. AI Summarization Phase

#### Integration with Anthropic Claude (`/lib/ai-summarizer.ts`)

```typescript
export async function summarizeArticles(articles: any[]): Promise<any[]> {
  const summarizedArticles = []
  
  for (const article of articles) {
    if (needsSummarization(article)) {
      const aiSummary = await summarizeArticle(article.title, article.content)
      article.ai_summary = aiSummary
      article.summary = aiSummary
    }
    
    summarizedArticles.push(article)
    await rateLimitDelay(1000) // Respect API limits
  }
  
  return summarizedArticles
}
```

## Error Handling and Resilience

### Fallback Hierarchy

1. **Network Failures**: Timeout handling with configurable limits
2. **Content Extraction Failures**: Multiple selector strategies
3. **Image Loading Failures**: Graceful degradation to placeholders
4. **AI Processing Failures**: Original content preservation
5. **Database Failures**: Local caching and retry mechanisms

### Robustness Features

```javascript
// Comprehensive error handling pattern
try {
  const result = await primaryMethod()
  if (isValidResult(result)) return result
} catch (primaryError) {
  try {
    const fallback = await fallbackMethod()
    if (isValidResult(fallback)) return fallback
  } catch (fallbackError) {
    return createMockData() // Last resort
  }
}
```

## Performance Optimizations

### Concurrency Management

- **Parallel Execution**: All scrapers run simultaneously
- **Rate Limiting**: Configurable delays between requests
- **Connection Pooling**: Efficient HTTP connection reuse
- **Timeout Management**: Prevents hanging requests

### Memory Optimization

```javascript
// Streaming and chunked processing
const articles = []
for (let i = 0; i < headlines.length; i++) {
  const article = await processArticle(headlines[i])
  articles.push(article)
  
  // Rate limiting between articles
  if (i < headlines.length - 1) {
    await new Promise(r => setTimeout(r, 1500))
  }
}
```

## Scheduling and Automation

### Vercel Cron Integration (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-news",
      "schedule": "*/30 * * * *"  // Every 30 minutes
    }
  ]
}
```

### Execution Monitoring

- **Progress Tracking**: Real-time scraping status via SSE
- **Error Reporting**: Comprehensive error logging and alerts
- **Performance Metrics**: Scraping duration and success rates
- **Quality Metrics**: Content and image extraction success

## Database Integration

### Storage Strategy (`/lib/supabase.ts`)

```typescript
export async function saveArticle(article: Article) {
  // 1. Duplicate detection by URL
  const existing = await checkExistingArticle(article.url)
  if (existing) return { ...existing, skipped: true }
  
  // 2. Data transformation and validation
  const processedArticle = processArticleData(article)
  
  // 3. Database insertion with error handling
  const { data, error } = await supabase
    .from("articles")
    .insert([processedArticle])
    .select()
    .single()
    
  return { ...data, skipped: false }
}
```

### Database Schema

```sql
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  ai_summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX idx_articles_source ON articles(source);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_search ON articles 
  USING gin(to_tsvector('english', title || ' ' || COALESCE(summary, '')));
```

## Quality Assurance

### Content Validation

```javascript
function validateArticle(article) {
  return {
    hasValidTitle: article.title && article.title.length > 10,
    hasValidContent: article.content && article.content.length > 100,
    hasValidImage: article.imageUrl && !article.imageUrl.includes('placeholder'),
    hasValidUrl: isValidUrl(article.url),
    hasValidSource: VALID_SOURCES.includes(article.source)
  }
}
```

### Quality Metrics

- **Content Completeness**: Title, content, summary presence
- **Image Quality**: Valid image URLs and accessibility
- **Metadata Accuracy**: Author, date, category validation
- **Duplicate Detection**: URL-based deduplication
- **Source Verification**: Authentic source attribution

## API Integration Points

### External Services

1. **Jina.ai Proxy**: Content extraction fallback
2. **Anthropic Claude**: AI summarization service
3. **Supabase**: Database and storage
4. **RSS Feeds**: Primary content discovery

### Rate Limiting Strategy

```javascript
// Adaptive rate limiting
const RATE_LIMITS = {
  jina: 1000,      // 1 second between requests
  anthropic: 1000, // Respect Claude API limits
  rss: 500,        // RSS feed politeness
  html: 1500       // Website scraping courtesy
}
```

## Security Considerations

### Data Protection

- **Input Sanitization**: All scraped content sanitized
- **SQL Injection Prevention**: Parameterized queries only
- **XSS Protection**: Content encoding before storage
- **CSRF Protection**: API endpoint security

### Privacy Compliance

- **No Personal Data**: Only public article content
- **Attribution**: Proper source attribution
- **Copyright Respect**: Link-based sharing, not republishing
- **Rate Limiting**: Respectful scraping practices

## Monitoring and Debugging

### Logging Strategy

```javascript
// Structured logging with context
console.log(`🚀 Starting ${outletName} scraper...`)
console.log(`📰 ${outletName}: Found ${articles.length} articles`)
console.log(`✅ ${outletName} completed: ${savedCount}/${articles.length} saved`)
console.error(`💥 ${outletName} scraping failed:`, error)
```

### Debug Features

- **Environment Flags**: `NODE_DEBUG=scraper` for verbose logging
- **Progress Tracking**: Real-time status updates
- **Error Context**: Detailed error reporting with stack traces
- **Performance Timing**: Execution duration tracking

## Future Enhancements

### Planned Improvements

1. **Machine Learning**: Content classification and ranking
2. **Advanced Analytics**: Trend detection and analysis
3. **Multi-language Support**: Automatic language detection
4. **Real-time Processing**: WebSocket-based live updates
5. **Content Enrichment**: Related article discovery

### Scalability Roadmap

1. **Microservices**: Individual scraper services
2. **Message Queues**: Asynchronous processing
3. **Distributed Caching**: Redis for performance
4. **Load Balancing**: Horizontal scraper scaling
5. **Edge Computing**: Global scraping distribution