# Article Pipeline Architecture

## Overview

The article pipeline is a sophisticated system that scrapes, processes, selects, enhances, and serves multilingual news articles. The pipeline consists of several key stages:

1. **Article Scraping** - Automated collection from multiple Hong Kong news sources
2. **AI Selection** - Perplexity AI intelligently selects high-value articles
3. **Trilingual Enhancement** - Selected articles are enhanced and translated into English, Traditional Chinese, and Simplified Chinese
4. **Content Delivery** - Enhanced articles are served through APIs and displayed on the frontend

## System Components

### 1. Article Scraping System

**Sources:**
- Hong Kong Free Press (HKFP) - English news
- Sing Tao Daily (SingTao) - Chinese news
- HK01 - Chinese news
- Oriental Daily (ONCC) - Chinese news
- RTHK - Bilingual news
- On.cc - Chinese news

**Key Files:**
- `/lib/scrapers/` - Individual scraper implementations for each source
- `/app/api/cron/scrape-all/route.ts` - Cron job endpoint for automated scraping

**Process:**
1. Cron jobs run every 15 minutes (6 AM - 1 AM HKT)
2. Each scraper fetches latest articles from its source
3. Articles are deduplicated based on URL and title similarity
4. New articles are stored in the `articles` table

### 2. AI Selection System

**Technology:** Perplexity AI API

**Key Files:**
- `/lib/perplexity-article-selector.ts` - Core selection logic with anti-hallucination safeguards
- `/app/api/cron/select-article/route.ts` - Automated selection cron job
- `/app/api/admin/articles/select-article/route.ts` - Admin-triggered selection

**Selection Process:**
1. Fetches recent unprocessed articles (last 7 days)
2. Filters articles with sufficient content (≥100 characters) to prevent hallucination
3. Analyzes topic distribution and coverage gaps
4. Sends curated batch to Perplexity AI for selection
5. AI selects articles based on:
   - News value and timeliness
   - Relevance to Hong Kong readers
   - Topic diversity
   - Content quality

**Anti-Hallucination Safeguards:**
- Minimum content length requirement (100 characters)
- Enhanced prompt engineering to restrict AI to provided content only
- Extended article previews (400 characters)
- Explicit instructions to avoid external knowledge

### 3. Trilingual Enhancement System

**Technology:** Perplexity AI with custom prompts for each language

**Key Files:**
- `/lib/perplexity-trilingual-enhancer.ts` - Core enhancement logic
- `/app/api/cron/enhance-selected/route.ts` - Automated enhancement cron job
- `/app/api/admin/articles/enhance-selected/route.ts` - Admin-triggered enhancement

**Enhancement Pipeline:**
1. Retrieves articles marked for enhancement
2. For each article, creates 3 enhanced versions:
   - **English**: Comprehensive rewrite with context and background
   - **Traditional Chinese**: Culturally adapted for Hong Kong readers
   - **Simplified Chinese**: Mainland-oriented perspective with context
3. Each version includes:
   - Contextual enrichment
   - Background information
   - Related developments
   - Cultural adaptations
   - SEO-optimized titles

**Quality Controls:**
- Structured output validation
- Language-specific prompts
- Batch processing for efficiency
- Cost tracking ($0.075 per enhanced article)

### 4. Article Storage & Retrieval

**Database Schema:**

```sql
articles table:
- id (uuid)
- title (text)
- summary (text)
- content (text)
- url (text)
- source (text)
- category (text)
- language (text)
- published_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
- is_ai_enhanced (boolean)
- selected_for_enhancement (boolean)
- selection_metadata (jsonb)
- enhancement_metadata (jsonb)
- quality_score (integer)
- parent_article_id (uuid) - Links enhanced versions to originals
```

**Metadata Tracking:**
- Selection metadata: reason, score, method, session ID
- Enhancement metadata: processing time, cost, batch ID, admin trigger flag

### 5. Admin Controls

**Location:** `/app/admin/articles/`

**Features:**
- Manual article selection for enhancement
- Bulk enhancement operations (up to 10 articles)
- AI-powered single article selection and enhancement
- Article deletion and management
- Real-time progress tracking

**Key Endpoints:**
- `/api/admin/articles/mark-for-enhancement` - Manual selection
- `/api/admin/articles/select-article` - AI selection
- `/api/admin/articles/enhance-selected` - Enhancement processing
- `/api/admin/articles/batch-delete` - Bulk deletion

### 6. Content Delivery

**API Endpoints:**
- `/api/articles` - Public article feed with filtering
- `/api/admin/articles` - Admin article management
- `/api/topics` - Topic-based article grouping

**Frontend Display:**
- Masonry grid layout for article cards
- Language switching (EN/繁/简)
- Source attribution with icons
- Category filtering
- Share functionality

## Cron Job Schedule

All times in Hong Kong Time (GMT+8), converted to UTC for Vercel:

1. **Article Scraping** - Every 15 minutes, 6 AM - 1 AM HKT
   - `/api/cron/scrape-all`
   - Schedule: `*/15 0-17,22-23 * * *` (UTC)

2. **AI Selection** - Every 15 minutes, 6 AM - 1 AM HKT
   - `/api/cron/select-article`
   - Schedule: `*/15 0-17,22-23 * * *` (UTC)

3. **Article Enhancement** - 5 minutes after each quarter hour, 6 AM - 1 AM HKT
   - `/api/cron/enhance-selected`
   - Schedule: `5,20,35,50 0-17,22-23 * * *` (UTC)

## Performance & Optimization

### Deduplication Strategy
1. URL-based deduplication for exact matches
2. Title normalization and similarity detection
3. Recent selection filtering (3-day window)
4. Cross-source duplicate detection

### Rate Limiting
- Perplexity API: Sequential processing with delays
- Scraping: Respects source rate limits
- Database: Connection pooling via Supabase

### Cost Management
- Average cost: $0.075 per enhanced article
- Daily budget: ~$5-10 depending on news volume
- Batch processing for efficiency

## Error Handling

### Graceful Degradation
- Scraper failures logged but don't stop pipeline
- AI selection failures fall back to next run
- Enhancement failures retry once
- Partial success tracking for bulk operations

### Monitoring
- Detailed console logging at each stage
- Error tracking with context
- Processing time measurements
- Cost estimation tracking

## Security Considerations

1. **API Keys**: Stored as environment variables
2. **Database Access**: Service role key for cron jobs
3. **Input Validation**: Content length and format checks
4. **Output Sanitization**: Structured data validation

## Future Enhancements

1. **Quality Scoring**: ML-based article quality assessment
2. **Topic Modeling**: Advanced topic extraction and clustering
3. **User Personalization**: Reader preference learning
4. **Performance Analytics**: Engagement tracking and optimization
5. **Multi-source Synthesis**: Combining multiple articles on same topic