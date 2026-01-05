# HKI News App - API Endpoints Documentation

## Overview

This documentation covers all API endpoints in the HKI News App. The API provides access to articles, headlines, search functionality, administrative tools, and automated content processing. All endpoints are built using Next.js API routes and integrate with Supabase for data persistence.

## Base URL Structure

All API endpoints follow the pattern: `https://your-domain.com/api/[endpoint]`

## Authentication

- **Public endpoints**: No authentication required
- **Admin endpoints**: Currently no authentication implemented (should be secured in production)
- **Cron endpoints**: Protected by Vercel Cron user-agent validation

## Database Fallback Strategy

Most endpoints implement a fallback strategy:
1. Check if database is properly set up
2. Attempt to fetch data from database
3. Fall back to mock data if database unavailable
4. Return error details in debug fields

---

## Public API Endpoints

### 1. Articles

#### Get Articles List
```
GET /api/articles
```

**Purpose**: Retrieve paginated list of articles with mock data fallback

**Parameters**:
- `page` (optional): Page number (default: 0)
- `category` (optional): Filter by category (e.g., 'cars', 'Technology', 'Politics')
- `enriched` (optional): Filter cars by enrichment status (true/false)

**Response Format**:
```json
{
  "articles": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "content": "string",
      "url": "string",
      "source": "string",
      "publishedAt": "ISO 8601 date",
      "imageUrl": "string",
      "category": "string",
      "readTime": number,
      "isAiEnhanced": boolean,
      "originalArticleId": "string",
      "enhancementMetadata": object
    }
  ],
  "nextPage": number | null,
  "usingMockData": boolean,
  "debug": "string"
}
```

**Example Requests**:
```bash
# Get all articles
curl "https://your-domain.com/api/articles?page=0"

# Get car listings only
curl "https://your-domain.com/api/articles?category=cars&page=0"
```

#### Get Single Article
```
GET /api/articles/[id]
```

**Purpose**: Retrieve individual article by ID

**Parameters**:
- `id` (path): Article ID

**Response Format**: Single article object (same structure as above)

**Example Request**:
```bash
curl "https://your-domain.com/api/articles/123"
```

### 2. Headlines

#### Get Headlines by Category
```
GET /api/headlines
```

**Purpose**: Retrieve categorized headlines for Hong Kong news

**Parameters**:
- `category` (optional): Filter by category

**Response Format**:
```json
{
  "headlines": {
    "Politics": [
      {
        "id": "string",
        "category": "string",
        "title": "string",
        "url": "string",
        "source": "string",
        "published_at": "ISO 8601 date",
        "created_at": "ISO 8601 date",
        "image_url": "string",
        "author": "string"
      }
    ]
  },
  "usingMockData": boolean,
  "debug": "string"
}
```

**Categories**: Politics, Economy, Crime, Lifestyle, Health, International

**Example Request**:
```bash
curl "https://your-domain.com/api/headlines?category=Politics"
```

### 3. Search

#### Search Articles
```
GET /api/search
```

**Purpose**: Full-text search across articles

**Parameters**:
- `q` (required): Search query string

**Response Format**: Array of article objects

**Example Request**:
```bash
curl "https://your-domain.com/api/search?q=artificial%20intelligence"
```

### 4. Topics (AI-Enhanced Articles)

#### Get AI-Enhanced Articles
```
GET /api/topics
```

**Purpose**: Retrieve AI-enhanced articles with multilingual support

**Parameters**:
- `page` (optional): Page number (default: 0)
- `language` (optional): Language code (en, zh-TW, zh-CN)
- `category` (optional): Category filter. If null/omitted, returns ALL categories (Top Stories feed)

**Category Behavior**:
- **With category**: Returns articles only from the specified category
- **Without category (Top Stories)**: Returns articles from ALL categories, sorted by `published_at DESC`

> **Note (Jan 1, 2026):** Previously, the "Top Stories" feed only returned articles from `['Top Stories', 'Local', 'General']` categories. This was changed to include ALL categories to ensure the latest articles are always shown regardless of their category.

**Response Format**:
```json
{
  "articles": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "content": "string",
      "url": "string",
      "source": "string",
      "publishedAt": "ISO 8601 date",
      "imageUrl": "string",
      "category": "string",
      "readTime": number,
      "isAiEnhanced": boolean,
      "language": "en" | "zh-TW" | "zh-CN",
      "originalArticleId": "string",
      "enhancementMetadata": object
    }
  ],
  "nextPage": number | null,
  "usingMockData": boolean,
  "debug": "string"
}
```

**Example Requests**:
```bash
# English Top Stories (all categories, latest articles)
curl "https://your-domain.com/api/topics?language=en"

# Traditional Chinese Politics only
curl "https://your-domain.com/api/topics?language=zh-TW&category=Politics"

# Simplified Chinese Finance, page 2
curl "https://your-domain.com/api/topics?language=zh-CN&category=Finance&page=1"
```

### 5. Discovery

#### Get Discovery Content
```
GET /api/discovery
```

**Purpose**: Retrieve trending, recommended, and recent articles

**Response Format**:
```json
{
  "trending": [article],
  "recommended": [article],
  "recent": [article]
}
```

### 6. Perplexity News

#### Get Perplexity Generated News
```
GET /api/perplexity-news
```

**Purpose**: Retrieve AI-generated news from Perplexity API

**Parameters**:
- `category` (optional): Filter by category

**Response Format**:
```json
{
  "news": {
    "politics": [perplexity_article],
    "business": [perplexity_article],
    "tech": [perplexity_article]
  },
  "usingMockData": boolean,
  "debug": "string"
}
```

### 7. User Profile

#### Get User Profile
```
GET /api/user/profile
```

**Purpose**: Retrieve user profile data (currently mock data)

**Response Format**:
```json
{
  "savedArticles": [article],
  "readingHistory": [article],
  "preferences": {
    "darkMode": boolean,
    "fontSize": "string",
    "notifications": boolean
  }
}
```

### 8. Police Stations

#### Get Police Stations
```
GET /api/police
```

**Purpose**: Retrieve filtered list of Hong Kong police stations with multilingual support

**Parameters**:
- `district` (optional): Filter by district (e.g., 'Hong Kong Island', 'Kowloon East')
- `service` (optional): Filter by service type (e.g., 'Report Room', 'Police Post')
- `search` (optional): Search by name, address, or district

**Response Format**:
```json
{
  "stations": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "district": "string",
      "services": ["string"],
      "latitude": number,
      "longitude": number,
      "hasCoordinates": boolean,
      "primaryService": "string",
      "serviceCount": number
    }
  ],
  "total": number,
  "metadata": {
    "source": "hk_police_with_coords",
    "last_updated": "string",
    "districts_available": ["string"],
    "services_available": ["string"],
    "total_stations": number,
    "stations_with_coordinates": number
  }
}
```

**Implementation Details**:
- Data sourced from `/public/hk_police_with_coords.json`
- 64 police stations across 6 districts
- 5 service types with automatic classification
- Server-side filtering for performance
- Enhanced data with coordinate validation and service counting

### 9. Parks & Recreation

#### Get Parks
```
GET /api/parks
```

**Purpose**: Retrieve filtered list of Hong Kong parks with intelligent data processing

**Parameters**:
- `district` (optional): Filter by district (e.g., 'Hong Kong Island', 'Islands')
- `type` (optional): Filter by park type (e.g., 'Public Park', 'Country Park')
- `search` (optional): Search by name, address, or district

**Response Format**:
```json
{
  "parks": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "district": "string",
      "type": "string",
      "latitude": number,
      "longitude": number,
      "hasCoordinates": boolean
    }
  ],
  "total": number,
  "metadata": {
    "source": "parks_hk",
    "last_updated": "string",
    "districts_available": ["string"],
    "types_available": ["string"],
    "total_parks": number,
    "parks_with_coordinates": number
  }
}
```

**Implementation Details**:
- Data sourced from `/public/parks_hk.json`
- Intelligent address processing and district extraction
- Automatic park name generation from addresses
- 9 park type classifications based on keywords
- Enhanced data with coordinate validation and type detection

---

## Admin API Endpoints

### 1. Article Management

#### Get Admin Articles
```
GET /api/admin/articles
```

**Purpose**: Advanced article filtering and management

**Parameters**:
- `page`, `limit`: Pagination
- `source`, `category`, `language`: Filters
- `search`: Search query
- `aiEnhanced`: Filter AI-enhanced articles

**Response Format**:
```json
{
  "articles": [article],
  "hasMore": boolean,
  "total": number,
  "page": number,
  "limit": number
}
```

#### Update Article
```
PATCH /api/admin/articles/[id]
```

**Purpose**: Update article metadata

**Request Body**:
```json
{
  "title": "string",
  "summary": "string",
  "content": "string",
  "language": "en" | "zh-TW" | "zh-CN",
  "imageUrl": "string",
  "category": "string",
  "ai_summary": "string"
}
```

**Response**: Updated article object with validation

#### Delete Article
```
DELETE /api/admin/articles/[id]
```

**Purpose**: Soft delete article (sets deleted_at timestamp)

**Response**:
```json
{
  "ok": true,
  "message": "Article deleted successfully",
  "deletedAt": "ISO 8601 date"
}
```

#### Batch Delete Articles
```
POST /api/admin/articles/batch-delete
```

**Purpose**: Soft delete multiple articles simultaneously

**Request Body**:
```json
{
  "articleIds": ["string"]
}
```

**Response**:
```json
{
  "success": true,
  "deletedCount": number,
  "message": "Successfully deleted N articles"
}
```

**Features**:
- Supports batch deletion of multiple selected articles
- Uses soft deletion (sets deleted_at timestamp)
- Returns count of successfully deleted articles
- Accessible from admin interface batch selection

### 2. AI Enhancement

#### Clone Article with AI
```
POST /api/admin/articles/clone-with-ai
```

**Purpose**: Create AI-enhanced version of existing article

**Request Body**:
```json
{
  "articleId": "string",
  "language": "en" | "zh-TW" | "zh-CN",
  "options": {
    "searchQueries": ["string"],
    "maxSources": number
  }
}
```

**Response**:
```json
{
  "success": true,
  "originalArticle": {
    "id": "string",
    "title": "string"
  },
  "enhancedArticle": article,
  "enhancementStats": {
    "searchQueries": number,
    "sources": number,
    "relatedTopics": number,
    "estimatedCost": number
  }
}
```

**Authentication**: Requires PERPLEXITY_API_KEY environment variable

#### Bulk Clone Articles with AI
```
POST /api/admin/articles/bulk-clone
```

**Purpose**: Clone multiple selected articles into all 3 languages (English, Traditional Chinese, Simplified Chinese)

**Request Body**:
```json
{
  "articleIds": ["string"],
  "options": {
    "searchDepth": "light" | "medium" | "thorough",
    "recencyFilter": "day" | "week" | "month",
    "maxTokens": number
  }
}
```

**Response**:
```json
{
  "success": true,
  "summary": {
    "originalArticles": number,
    "targetClones": number,
    "successfulClones": number,
    "failedClones": number,
    "successRate": number,
    "totalCost": number,
    "articlesMarkedAsSelected": number,
    "languageBreakdown": {
      "en": number,
      "zh-TW": number,
      "zh-CN": number
    }
  },
  "results": {
    "successful": [
      {
        "originalArticleId": "string",
        "originalTitle": "string",
        "enhancedArticleId": "string",
        "language": "en" | "zh-TW" | "zh-CN",
        "enhancementCost": number,
        "sources": number,
        "searchQueries": number
      }
    ],
    "failed": [
      {
        "originalArticleId": "string",
        "originalTitle": "string",
        "language": "en" | "zh-TW" | "zh-CN",
        "error": "string"
      }
    ],
    "totalProcessed": number,
    "totalCost": number
  },
  "message": "Successfully cloned N articles across 3 languages from N source articles"
}
```

**Features**:
- **Batch Processing**: Clone up to 20 articles per operation
- **Trilingual Support**: Each article cloned into English, Traditional Chinese, and Simplified Chinese
- **Rate Limiting**: 1-second delay between requests to prevent API overwhelm
- **Unique URLs**: Each language version gets unique URL with timestamp
- **Comprehensive Reporting**: Detailed success/failure tracking with language breakdown
- **Cost Tracking**: Real-time cost calculation and reporting
- **Error Resilience**: Continues processing if individual articles fail
- **Selection Validation**: Only allows cloning of non-AI-enhanced articles
- **Selection Tracking**: Marks original articles as `selected_for_enhancement = true` to prevent re-selection by automated processes

**Limits**:
- Maximum 20 articles per batch operation
- Only non-enhanced articles can be cloned
- Requires PERPLEXITY_API_KEY environment variable

**Processing Pipeline**:
1. Validate article selection (max 20, non-enhanced only)
2. Process each article in each language sequentially
3. Generate unique URLs per language version
4. Store trilingual metadata and relationships
5. Mark original articles as `selected_for_enhancement = true` (prevents re-selection)
6. Track costs and processing statistics
7. Return comprehensive results with language breakdown and selection status

**Authentication**: Requires PERPLEXITY_API_KEY environment variable

#### Trilingual Auto-Select & Enhance (Batch)
```
POST /api/admin/auto-select-headlines
```

**Purpose**: Automatically select 10 best articles using Perplexity AI and enhance them into 30 trilingual articles (English, Traditional Chinese, Simplified Chinese)

#### Trilingual Auto-Select & Enhance (Single)
```
POST /api/admin/auto-select-single
```

**Purpose**: Automatically select 1 best article using Perplexity AI and enhance it into 3 trilingual articles (English, Traditional Chinese, Simplified Chinese)

**Request Body**: None required

**Response**:
```json
{
  "success": true,
  "batchId": "single_1752484233132_abc123",
  "sourceArticles": 1,
  "totalEnhanced": 3,
  "totalSaved": 3,
  "selectedArticle": {
    "id": "uuid",
    "title": "Selected Article Title",
    "source": "HKFP",
    "selectionReason": "This article covers...",
    "priorityScore": 92
  },
  "articlesByLanguage": {
    "english": 1,
    "traditionalChinese": 1,
    "simplifiedChinese": 1
  },
  "processingTime": 45000,
  "processingTimeMinutes": 0.8,
  "estimatedCost": "0.2250",
  "articles": [
    {
      "id": "uuid",
      "title": "Enhanced Article Title",
      "language": "en",
      "url": "https://source.com/article#enhanced-en-1752484233132",
      "source": "HKFP",
      "qualityScore": 92
    }
  ]
}
```

**Features**:
- **Quick Processing**: Faster than batch enhancement (~1-3 minutes vs 15-20 minutes)
- **Single Article Focus**: AI selects the single most newsworthy article
- **Same Quality**: Uses identical enhancement pipeline as batch processing
- **Lower Cost**: ~$0.225 per operation (3 articles vs 30)
- **Immediate Results**: Ideal for testing or quick content creation

**Processing Pipeline**:
1. **Article Candidate Filtering**: Gets recent articles where `is_ai_enhanced = false` AND `selected_for_enhancement = false`
2. **Sequential ID Assignment**: Maps articles to sequential numbers (1, 2, 3...) for Perplexity
3. **AI Selection**: Perplexity analyzes candidates and selects the single best one using sequential IDs
4. **Selection Marking**: Immediately marks selected article as `selected_for_enhancement = true` with metadata
5. **Trilingual Enhancement**: Sequential processing (EN → zh-TW → zh-CN) with rate limiting
6. **Database Storage**: Saves all 3 enhanced articles with unique URLs and metadata
7. **Batch Tracking**: Links all articles with trilingual_batch_id for relationship queries

#### Check Single Article Configuration
```
GET /api/admin/auto-select-single
```

**Purpose**: Check API configuration and candidate article statistics

**Response**:
```json
{
  "configured": true,
  "message": "Single article trilingual enhancement is ready",
  "candidateStats": {
    "totalCandidates": number,
    "qualityArticles": number,
    "sourcesRepresented": ["string"],
    "averageQuality": number
  }
}
```

#### Check Batch Configuration
```
GET /api/admin/auto-select-headlines
```

**Purpose**: Check API configuration and candidate article statistics for batch processing

**Response**:
```json
{
  "sourceArticles": 10,
  "totalEnhanced": 30,
  "totalSaved": 30,
  "articlesByLanguage": {
    "english": 10,
    "traditionalChinese": 10,
    "simplifiedChinese": 10
  },
  "processingTime": number,
  "processingTimeMinutes": number,
  "estimatedCost": "string",
  "articles": [
    {
      "id": "string",
      "title": "string",
      "language": "en" | "zh-TW" | "zh-CN",
      "url": "string",
      "source": "string",
      "qualityScore": number
    }
  ]
}
```

**Features**:
- **Intelligent Selection**: Uses Perplexity AI to evaluate and select the 10 most newsworthy articles from existing non-enhanced, non-selected articles
- **Selection Tracking**: Prevents re-selection of articles by marking them as `selected_for_enhancement = true` with comprehensive metadata
- **UUID Corruption Fix**: Uses sequential IDs (1, 2, 3...) instead of UUIDs for Perplexity communication
- **Quality Scoring**: Articles scored based on newsworthiness, impact, relevance, and enhancement potential
- **Trilingual Processing**: Each selected article enhanced into 3 languages with unique URLs
- **Batch Tracking**: All articles linked with trilingual_batch_id for relationship tracking
- **Rate Limiting**: 1.5s between languages, 2s between articles to respect API limits
- **Metadata Storage**: All trilingual tracking data stored in enhancement_metadata

**Authentication**: Requires PERPLEXITY_API_KEY environment variable

**Processing Pipeline**:
1. **Article Candidate Filtering**: Gets 50 recent articles where `is_ai_enhanced = false` AND `selected_for_enhancement = false`
2. **Sequential ID Assignment**: Maps articles to sequential numbers (1, 2, 3...) for Perplexity
3. **AI Selection**: Perplexity analyzes candidates and returns selections using sequential IDs
4. **Selection Marking**: Immediately marks selected articles as `selected_for_enhancement = true` with metadata
5. **Trilingual Enhancement**: Sequential processing (EN → zh-TW → zh-CN) with rate limiting
6. **Database Storage**: Saves all 30 enhanced articles with unique URLs and metadata
7. **Batch Tracking**: Links all articles in the same trilingual batch for relationship queries

#### Check Trilingual Configuration
```
GET /api/admin/auto-select-headlines
```

**Purpose**: Check API configuration and candidate article statistics

**Response**:
```json
{
  "configured": true,
  "message": "Trilingual auto-enhancement is ready",
  "candidateStats": {
    "totalCandidates": number,
    "qualityArticles": number,
    "sourcesRepresented": ["string"],
    "averageQuality": number
  }
}
```

### 3. Perplexity Management

#### Get Perplexity Articles (Admin)
```
GET /api/admin/perplexity
```

**Purpose**: Advanced filtering and management of Perplexity-generated content

**Parameters**:
- `category`, `status`, `search`: Filters
- `page`, `limit`: Pagination

**Response**: Articles with processing status and metadata

#### Trigger Perplexity Enrichment
```
POST /api/admin/perplexity/trigger-enrichment
```

**Purpose**: Manually trigger content enrichment process

**Request Body**:
```json
{
  "batchSize": number,
  "forceAll": boolean
}
```

**Response**: Processing results with cost tracking

### 4. Car Management

#### Get Car Statistics
```
GET /api/admin/cars/stats
```

**Purpose**: Car listing analytics with price range breakdown

**Response**:
```json
{
  "total": number,
  "recent24h": number,
  "priceRanges": {
    "under200k": number,
    "range200to300k": number,
    "range300to500k": number,
    "over500k": number
  }
}
```

#### Enrich Cars
```
POST /api/admin/cars/enrich
```

**Purpose**: AI-powered car listing enrichment using Perplexity API

**Request Body**:
```json
{
  "carId": "string",     // Optional: Enrich specific car
  "enrichAll": boolean   // Optional: Enrich all unenriched cars
}
```

**Response**:
```json
{
  "message": "string",
  "enrichedCount": number,
  "errors": ["string"]
}
```

**Authentication**: Requires PERPLEXITY_API_KEY environment variable

#### Car Enrichment Status
```
GET /api/admin/cars/enrich
```

**Purpose**: Check enrichment statistics and API configuration

**Response**:
```json
{
  "totalCars": number,
  "enrichedCars": number,
  "unenrichedCars": number,
  "isConfigured": boolean
}
```

### 5. Database Management

#### Database Status Check
```
GET /api/admin/database/status
```

**Purpose**: Check database schema and missing migrations

**Response**:
```json
{
  "tableName": "articles",
  "tableExists": boolean,
  "columns": [
    {
      "column": "string",
      "exists": boolean
    }
  ],
  "missingColumns": ["string"],
  "migrations": [
    {
      "name": "string",
      "required": boolean,
      "applied": boolean
    }
  ],
  "instructions": {
    "endpoints": [
      {
        "name": "string",
        "method": "string",
        "endpoint": "string"
      }
    ]
  }
}
```

#### Database Statistics
```
GET /api/admin/database/stats
```

**Purpose**: Get article statistics and database health

**Response**:
```json
{
  "total": number,
  "bySource": object,
  "latest": article,
  "oldest": article
}
```

---

## Cron Job Endpoints

**Security**: All cron endpoints verify `user-agent: vercel-cron/1.0`

### 1. News Scraping

#### Scrape All News Sources
```
GET /api/cron/scrape-news
```

**Purpose**: Automated scraping of all configured news sources

**Response**: Scraping results with article counts

#### Collect Headlines
```
GET /api/cron/collect-headlines
```

**Purpose**: Collect daily headlines from news sources

**Response**: Headlines collection results

#### Scrape Car Listings
```
GET /api/cron/scrape-cars
POST /api/cron/scrape-cars (manual trigger)
```

**Purpose**: Automated scraping of car listings from 28car.com

**Schedule**: Every 15 minutes (`*/15 * * * *`)

**Implementation Details**:
- Uses environment-aware browser automation (Puppeteer + @sparticuz/chromium)
- Extracts up to 5 photos per car listing
- Supports multi-comma price parsing (e.g., HK$2,450,000)
- Includes comprehensive car specifications and metadata
- Stores data in unified articles table with category='cars'

**Authentication**: Vercel cron user-agent verification for GET requests

**Response**: Car scraping results with listing counts

**Example Response**:
```json
{
  "success": true,
  "message": "28car scraping completed: 18/40 cars saved",
  "result": {
    "outlet": "28car", 
    "articlesFound": 18,
    "articlesSaved": 18,
    "articles": [...]
  },
  "timestamp": "2025-07-11T15:48:57.699Z"
}
```

#### Enrich Car Listings
```
GET /api/cron/enrich-cars
```

**Purpose**: Automated AI enrichment of car listings using Perplexity API

#### Hourly Single Article Trilingual Enhancement
```
GET /api/cron/auto-enhance-single
```

**Schedule**: Every hour (`0 * * * *`)

**Implementation Details**:
- Uses Perplexity AI to intelligently select 1 most newsworthy article from existing non-enhanced articles
- Enhances the selected article into 3 languages (English, Traditional Chinese, Simplified Chinese)
- Saves all 3 enhanced versions to the database with unique URLs
- Provides detailed logging with `[CRON]` prefix for monitoring
- Includes authentication verification for Vercel cron requests
- Supports manual testing via POST requests

**Processing Steps**:
1. Verify Perplexity API configuration
2. AI-powered article selection (1 from available candidates where `is_ai_enhanced = false` AND `selected_for_enhancement = false`)
3. Mark selected article as `selected_for_enhancement = true` with selection metadata
4. Sequential trilingual enhancement with rate limiting
5. Database storage with unique URLs and metadata
6. Comprehensive result logging and monitoring

**Response**: Processing results with detailed statistics

**Example Response**:
```json
{
  "success": true,
  "message": "Hourly trilingual enhancement completed: 1 → 3 articles",
  "batchId": "cron_single_1752484233132_abc123",
  "sourceArticles": 1,
  "totalEnhanced": 3,
  "totalSaved": 3,
  "selectedArticle": {
    "id": "uuid",
    "title": "Selected Article Title",
    "source": "HKFP",
    "selectionReason": "High impact political news with enhancement potential",
    "priorityScore": 92
  },
  "articlesByLanguage": {
    "english": 1,
    "traditionalChinese": 1,
    "simplifiedChinese": 1
  },
  "processingTime": 45000,
  "processingTimeMinutes": 0.8,
  "estimatedCost": "0.2250",
  "timestamp": "2025-07-14T12:00:00.000Z"
}
```

**Error Handling**:
- Returns 422 if no articles available for enhancement
- Returns 503 if Perplexity API not configured
- Returns 401 for unauthorized non-cron requests
- Comprehensive error logging for debugging

**Authentication**: Requires Vercel cron user-agent or CRON_SECRET environment variable

#### Car Enrichment (Legacy)
- Processes maximum 5 cars per run (cost control)
- Only enriches cars with `ai_summary` = null (unenriched cars)
- Processes newest cars first (`order('created_at', { ascending: false })`)
- Includes 3-second rate limiting between API calls
- Requires PERPLEXITY_API_KEY environment variable
- Creates structured markdown summary with enrichment data

**Processing Steps**:
1. Query unenriched cars from database (limit 5)
2. Parse car specifications from content
3. Call Perplexity API for enrichment (year, faults, fuel data)
4. Generate structured markdown summary
5. Update car record with ai_summary field
6. Log costs and processing results

**Enrichment Data Generated**:
- **Estimated Year**: Vehicle year estimation
- **Vehicle Type**: Electric vs Conventional fuel classification
- **Fuel Consumption**: MPG or L/100km estimates
- **Monthly Fuel Cost**: HKD cost estimates
- **Things to Look Out For**: Common faults and inspection points

**Response**: Car enrichment results with processing statistics

**Example Response**:
```json
{
  "success": true,
  "message": "Successfully enriched 3 cars",
  "enrichedCount": 3,
  "totalProcessed": 5,
  "errors": ["Failed to enrich car BMW X5: API timeout"],
  "timestamp": "2025-07-11T09:00:00.000Z"
}
```

### 2. AI Processing

#### Enrich Perplexity News
```
GET /api/cron/enrich-perplexity-news
```

**Purpose**: Automated content enrichment using Perplexity API

**Processing Steps**:
1. Get pending articles
2. Enrich content with contextual data
3. Generate images using AI
4. Update article status
5. Track costs and usage

**Response**: Processing results with detailed logging

#### Fetch Perplexity News
```
GET /api/cron/fetch-perplexity-news
```

**Purpose**: Generate fresh headlines using Perplexity API

**Response**: Generated headlines count and cost tracking

### 3. Unified Article Processing

#### Enrich Unified Articles
```
GET /api/cron/enrich-unified-articles
```

**Purpose**: Process articles in the unified content system

**Response**: Processing results for unified articles

---

## Utility Endpoints

### 1. Database Setup

#### Setup Database
```
POST /api/setup-database
```

**Purpose**: Initialize database tables and schema

**Response**: Setup results with manual SQL instructions if automation fails

### 2. Debug Tools

#### Database Debug
```
GET /api/debug/database
```

**Purpose**: Comprehensive database connectivity and setup debugging

**Response**: Environment check, connection test, and table validation

### 3. Manual Operations

#### Manual Scrape
```
POST /api/manual-scrape
```

**Purpose**: Manually trigger news scraping (bypasses cron protection)

**Response**: Scraping results with progress tracking

#### Scrape Single Outlet
```
POST /api/scrape/[outlet]
```

**Purpose**: Scrape specific news outlet

**Parameters**:
- `outlet` (path): Outlet code (hkfp, singtao, hk01, oncc, rthk)

**Response**: Outlet-specific scraping results

### 4. Progress Tracking

#### Scrape Progress
```
GET /api/scrape/progress
```

**Purpose**: Real-time scraping progress (requires server-sent events)

**Response**: Progress updates and status information

---

## Advanced Features

### 1. Unified Content System

#### Get Unified Articles
```
GET /api/unified/articles
```

**Purpose**: Advanced content aggregation with multiple article types

**Parameters**:
- `type`: Article type (scraped, ai_generated, enhanced)
- `features`: Feature filters (has_image, has_ai_content, has_translation)
- `sort`: Sorting (latest, popular, relevance)
- `status`: Publication status
- `processingStatus`: Processing state

**Response**: Unified articles with rich metadata

#### Get Unified Article
```
GET /api/unified/articles/[id]
```

**Purpose**: Retrieve single article from unified system

**Features**:
- Automatic content formatting
- Legacy ID compatibility
- Structured metadata transformation

### 2. Perplexity Integration

#### Individual Perplexity Articles
```
GET /api/perplexity/[id]
```

**Purpose**: Retrieve individual AI-generated articles

**Features**:
- Rich metadata including sources and citations
- Cost tracking
- Image licensing information

### 3. Testing and Development

#### Test Google Images
```
GET /api/test-google-images
```

**Purpose**: Test image search functionality

**Response**: Image search results and metadata

---

## Error Handling

All endpoints implement consistent error handling:

```json
{
  "error": "string",
  "details": "string",
  "debug": "string",
  "usingMockData": boolean
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request / validation error
- `401`: Unauthorized (cron endpoints)
- `404`: Not found
- `500`: Internal server error
- `503`: Service unavailable (API not configured)

## Rate Limiting

- Perplexity API calls: 2-second delays between requests
- Cron jobs: Protected by Vercel's cron service
- Manual operations: No explicit rate limiting

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `PERPLEXITY_API_KEY`: Perplexity API key (required for car enrichment)

## Database Schema

The system uses multiple tables:
- `articles`: Main articles table
- `headlines`: News headlines
- `perplexity_news`: AI-generated content
- `articles_unified`: Unified content system
- `image_usage`: Image usage tracking

Migration endpoints are available for schema updates.

---

This comprehensive documentation provides AI agents with the necessary information to interact effectively with the HKI News App API, including authentication requirements, request/response formats, error handling, and integration patterns.