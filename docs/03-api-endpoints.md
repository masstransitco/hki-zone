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

**Response Format**: Similar to articles endpoint with additional language and enhancement metadata

**Example Request**:
```bash
curl "https://your-domain.com/api/topics?language=zh-TW&page=0"
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
```

**Purpose**: Automated scraping of car listings from 28car.com

**Schedule**: Every 15 minutes (updated from 30 minutes)

**Response**: Car scraping results with listing counts

**Example Response**:
```json
{
  "success": true,
  "message": "28car scraping completed: 19/19 cars saved",
  "result": {
    "outlet": "28car",
    "articlesFound": 19,
    "articlesSaved": 19
  },
  "timestamp": "2025-07-11T07:55:24.827Z"
}
```

#### Enrich Car Listings
```
GET /api/cron/enrich-cars
```

**Purpose**: Automated AI enrichment of car listings using Perplexity API

**Schedule**: Every 2 hours

**Processing**: 
- Processes 5 cars per run with rate limiting
- Determines estimated year, common faults, electric status, fuel consumption
- Includes comprehensive logging and cost tracking

**Response**: Car enrichment results with processing statistics

**Example Response**:
```json
{
  "success": true,
  "processed": 5,
  "enriched": 4,
  "errors": 1,
  "totalCost": "$0.0240",
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