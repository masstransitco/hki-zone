# Article AI Clone Feature - High-Level Architecture Documentation

## Overview

The Article AI Clone feature is a sophisticated content enhancement system that leverages Perplexity AI to create enriched versions of news articles with additional research, context, sources, and multimedia content. This system provides admin users with a powerful tool to enhance article quality and depth through automated AI research and analysis.

## Architecture Components

### 1. Data Layer (Supabase Integration)

#### Database Schema
```sql
-- Core articles table with AI enhancement support
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  ai_summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  is_ai_enhanced BOOLEAN DEFAULT FALSE,
  original_article_id UUID REFERENCES articles(id),
  enhancement_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Supabase Data Access Layer (`lib/supabase.ts`)
- **`getArticles()`**: Main entry point with balanced source distribution
- **`getBalancedArticles()`**: Ensures proportional representation from all Hong Kong news sources
- **`searchArticles()`**: Full-text search across content, titles, and AI summaries
- **`saveArticle()`**: Persists enhanced articles with metadata
- **`getArticleById()`**: Retrieves individual articles for enhancement

**Key Features:**
- **Balanced Source Distribution**: Prevents bias by ensuring equal representation
- **Full-Text Search**: Searches across original and enhanced content
- **Metadata Storage**: JSONB field for flexible enhancement data
- **Referential Integrity**: Links enhanced articles to originals

### 2. Admin Interface Layer

#### Articles Management Page (`app/admin/articles/page.tsx`)
**State Management:**
- `articles`: Array of loaded articles with pagination
- `selectedArticle`: Currently selected article for detail view
- `isSheetOpen`: Controls full-screen editor modal state
- `searchQuery` & `sourceFilter`: User-driven filtering

**Key Features:**
- **Statistics Dashboard**: Real-time article counts by source
- **Search & Filtering**: Live search with source-specific filtering
- **Infinite Scroll**: Seamless pagination with "Load More"
- **Responsive Layout**: Adaptive grid for desktop/mobile

#### Article Display Components

##### ArticleReviewGrid (`components/admin/article-review-grid.tsx`)
- **Card-Based Layout**: Visual article previews with metadata
- **Quality Indicators**: Progress bars for content completeness
- **AI Enhancement Badges**: Visual indicators for enhanced articles
- **Selection State**: Highlights currently selected article

##### ArticleDetailPanel (`components/admin/article-detail-panel.tsx`)
- **Metadata Display**: Publication date, source, category information
- **Content Tabs**: Switch between summary and full content
- **Quality Metrics**: Visual indicators for content quality
- **Action Buttons**: View original, copy URL, delete, re-scrape
- **AI Enhancement Trigger**: "CLONE WITH AI" button with progress tracking

##### ArticleDetailSheet (`components/admin/article-detail-sheet.tsx`)
- **Full-Screen Experience**: Slide-out panel for enhanced editing
- **Larger Content Areas**: Improved visibility for content review
- **Enhanced Image Display**: Better image viewing capabilities
- **Comprehensive Source Citations**: Expanded source information display

### 3. AI Enhancement Engine

#### Perplexity API Integration (`lib/perplexity-enhancer-v2.ts`)

**Core Architecture:**
```typescript
class PerplexityEnhancerV2 {
  private baseUrl = 'https://api.perplexity.ai'
  private model = 'sonar-pro'
  private searchDepth = 'medium'
  private rateLimitDelay = 1500ms
}
```

**Enhancement Workflow:**
1. **Query Generation**: Creates 3 targeted search queries focused on Hong Kong context
2. **Research Phase**: Executes searches with rate limiting and error handling
3. **Source Extraction**: Multi-method source discovery and validation
4. **Content Enhancement**: Generates structured content with sections
5. **Metadata Compilation**: Assembles comprehensive enhancement metadata

#### Search Query Strategy
```typescript
// Primary search with visual content focus
`"${title}" latest news developments 2025 images photos`

// Entity-focused Hong Kong context
`${keyEntities.join(' ')} Hong Kong recent updates images`

// Background and visual content
`background context "${title}" Hong Kong photos images visual`
```

#### Source Extraction Methods

**1. Perplexity Metadata Sources (Primary)**
- Direct citations from API response metadata
- Structured source objects with URLs, titles, snippets

**2. Content-Based Sources (Fallback)**
- URL pattern matching: `https?:\/\/[^\s\)\"\]]+`
- Citation pattern recognition: `according to|source:|per|via|from`
- News source pattern matching for Hong Kong outlets

**3. Hong Kong Source Intelligence**
```typescript
const domainTitles = {
  'hk01.com': 'HK01',
  'scmp.com': 'South China Morning Post',
  'hongkongfp.com': 'Hong Kong Free Press',
  'rthk.hk': 'RTHK',
  'mingpao.com': 'Ming Pao',
  'censtatd.gov.hk': 'Census and Statistics Department'
}
```

### 4. API Layer

#### Enhancement API Route (`app/api/admin/articles/clone-with-ai/route.ts`)

**POST Endpoint:**
```typescript
POST /api/admin/articles/clone-with-ai
{
  articleId: string,
  options?: {
    searchDepth?: 'high' | 'medium' | 'low',
    recencyFilter?: 'hour' | 'day' | 'week' | 'month',
    maxTokens?: number
  }
}
```

**GET Endpoint:**
```typescript
GET /api/admin/articles/clone-with-ai
// Returns API configuration status
{
  configured: boolean,
  message: string
}
```

**Response Format:**
```typescript
{
  success: boolean,
  originalArticle: { id: string, title: string },
  enhancedArticle: Article,
  enhancementStats: {
    searchQueries: number,
    sources: number,
    relatedTopics: number,
    estimatedCost: string
  }
}
```

### 5. Content Processing Pipeline

#### Structured Content Format
Enhanced articles follow a standardized markdown structure:

```markdown
# ENHANCED TITLE: [AI-enhanced title]

## SUMMARY
[2-3 sentence executive summary with key findings]

## KEY POINTS
• [Key point 1 with additional context]
• [Key point 2 with background information]
• [Key point 3 with implications analysis]
• [Key point 4 with expert perspectives]
• [Key point 5 with related developments]

## WHY IT MATTERS
[2-3 sentences on broader significance and Hong Kong impact]
```

#### Content Parser (`lib/content-parser.ts`)
- **Source Removal**: Strips citation sections using regex patterns
- **Section Extraction**: Parses structured sections into components
- **Markdown Cleaning**: Preserves content while removing formatting
- **Fallback Handling**: Graceful degradation for unstructured content

### 6. Enhancement Metadata Schema

```typescript
interface EnhancementMetadata {
  searchQueries: string[]           // Original search queries used
  sources: SourceCitation[]         // Extracted source citations
  relatedTopics: string[]          // Related topic suggestions
  enhancedAt: string               // ISO timestamp of enhancement
  enhancementCost?: string         // Estimated API cost
  extractedImages?: ExtractedImage[] // Additional images found
  citationsText?: string           // Raw citations text
  structuredContent?: {
    enhancedTitle?: string         // AI-enhanced title
    enhancedSummary?: string       // AI-enhanced summary
    keyPoints?: string[]           // Structured key points
    whyItMatters?: string          // Significance analysis
  }
}

interface SourceCitation {
  url: string                      // Source URL
  title: string                    // Source title
  domain: string                   // Source domain
  snippet?: string                 // Content snippet
  accessedAt: string              // Access timestamp
}

interface ExtractedImage {
  url: string                      // Image URL
  alt?: string                     // Alt text
  caption?: string                 // Image caption
  source?: string                  // Image source
}
```

## Data Flow Architecture

### 1. Article Retrieval Flow
```
Database (Supabase) 
  ↓ [SQL Query with filters]
Supabase Client (lib/supabase.ts)
  ↓ [Data transformation]
API Route (/api/admin/articles)
  ↓ [Pagination & formatting]
ArticlesPage Component
  ↓ [State management]
ArticleReviewGrid → ArticleDetailPanel/Sheet
```

### 2. AI Enhancement Flow
```
Admin User Clicks "CLONE WITH AI"
  ↓
ArticleDetailPanel/Sheet → API Call
  ↓
Enhancement API Route (/api/admin/articles/clone-with-ai)
  ↓
PerplexityEnhancerV2.enhanceArticle()
  ↓
[Query Generation] → [Research Execution] → [Source Extraction]
  ↓
[Content Enhancement] → [Metadata Compilation]
  ↓
Supabase.saveArticle() → Enhanced Article Created
  ↓
Frontend Refresh → Updated Article Display
```

### 3. Real-time Status Updates
```
Frontend (Article Detail Component)
  ↓ [WebSocket/Polling simulation]
Enhancement Status Messages:
- "Initializing AI enhancement..."
- "Checking Perplexity API configuration..."
- "Searching for additional context..."
- "Enhancement completed successfully!"
  ↓
UI Progress Indicators & Success/Error Messages
```

## Supabase Interactions

### 1. Read Operations
- **Article Listing**: `getBalancedArticles()` with source distribution
- **Search Functionality**: Full-text search across multiple fields
- **Individual Retrieval**: `getArticleById()` for enhancement processing
- **Statistics**: Real-time article counts by source and category

### 2. Write Operations
- **Enhanced Article Creation**: New article records with `is_ai_enhanced: true`
- **Metadata Storage**: JSONB field for flexible enhancement data
- **Reference Linking**: `original_article_id` maintains article relationships
- **Atomic Transactions**: Ensures data consistency during enhancement

### 3. Database Constraints & Validation
- **No Double Enhancement**: Prevents enhancing already enhanced articles
- **Metadata Requirements**: Ensures enhanced articles have complete metadata
- **URL Uniqueness**: Prevents duplicate articles in the system
- **Foreign Key Integrity**: Maintains relationships between original and enhanced articles

### 4. Search & Indexing
- **Full-Text Search**: Searches across `title`, `summary`, `content`, and `ai_summary`
- **JSONB Indexing**: Efficient queries on enhancement metadata
- **Source-Based Filtering**: Fast filtering by news source
- **Category Classification**: Organized content categorization

## Cost Management & Performance

### 1. API Cost Optimization
- **Query Limits**: Maximum 3 search queries per enhancement
- **Token Management**: Configurable token limits (default: 1000-2500)
- **Cost Estimation**: Pre-enhancement cost calculation
- **Rate Limiting**: 1.5-second delays between API calls

### 2. Caching & Performance
- **Frontend Caching**: React Query for efficient data management
- **Database Indexing**: Optimized queries for large datasets
- **Lazy Loading**: On-demand loading of enhancement metadata
- **Pagination**: Efficient infinite scroll implementation

### 3. Error Handling & Resilience
- **Multi-layer Validation**: API key, quota, and rate limit checks
- **Graceful Degradation**: Continues processing despite partial failures
- **Comprehensive Logging**: Detailed error tracking and debugging
- **Database Rollback**: Recovery mechanisms for failed enhancements

## Security & Data Integrity

### 1. API Security
- **Environment Variables**: Secure API key storage
- **Request Validation**: Input sanitization and validation
- **Rate Limiting**: Protection against API abuse
- **Error Masking**: Prevents sensitive information exposure

### 2. Data Validation
- **Schema Validation**: Ensures data integrity at database level
- **Content Sanitization**: Prevents XSS and injection attacks
- **Source Verification**: Validates extracted sources and URLs
- **Metadata Validation**: Ensures enhancement metadata completeness

## Future Enhancements

### 1. Planned Features
- **Batch Enhancement**: Multiple article processing
- **Enhancement Templates**: Customizable enhancement formats
- **Source Quality Scoring**: Automatic source credibility assessment
- **Multi-language Support**: Enhanced support for Traditional Chinese content

### 2. Performance Optimizations
- **Background Processing**: Async enhancement processing
- **Smart Caching**: Intelligent caching of research results
- **Enhanced Search**: Semantic search capabilities
- **Real-time Updates**: WebSocket-based status updates

This architecture provides a robust, scalable foundation for AI-enhanced article management with comprehensive source attribution, cost-efficient processing, and excellent user experience for Hong Kong news content.