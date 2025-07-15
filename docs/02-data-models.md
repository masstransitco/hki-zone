# HKI News App - Data Models & Database Schema

## Database Architecture

The application uses **Supabase PostgreSQL** as the primary database with a unified schema design that consolidates multiple content types into a single table structure.

### Core Design Philosophy

1. **Unified Schema**: All content types (scraped, AI-generated, AI-enhanced) in one table
2. **Status-Driven Processing**: Multi-stage pipeline with clear status tracking
3. **Feature Flags**: Flexible filtering and display logic
4. **Metadata-Rich**: Comprehensive tracking of AI operations and costs
5. **Migration-Safe**: Backward compatibility with legacy data

## Primary Tables

### 1. `articles_unified` (Main Content Table)

The central table storing all article content with unified schema:

```sql
CREATE TABLE articles_unified (
    -- Core fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,  -- Primary ordering field
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Content fields
    summary TEXT,
    lede TEXT,
    key_points JSONB,
    why_it_matters TEXT,
    
    -- Media
    image_url TEXT,
    image_metadata JSONB,
    
    -- Status tracking
    status article_status DEFAULT 'published' NOT NULL,
    processing_status processing_status DEFAULT 'ready' NOT NULL,
    
    -- Metadata
    article_type article_type NOT NULL,
    generation_metadata JSONB,
    enhancement_metadata JSONB,
    structured_sources JSONB,
    contextual_data JSONB,
    
    -- Author information
    author TEXT,
    
    -- Cost tracking
    generation_cost DECIMAL(10, 6),
    
    -- Feature flags
    features JSONB DEFAULT '{
        "has_image": false, 
        "has_ai_content": false, 
        "has_translation": false
    }'::jsonb NOT NULL,
    
    -- Search queries for discoverability
    search_queries TEXT[],
    
    -- Legacy ID references for migration
    legacy_article_id TEXT,
    legacy_table_name TEXT
);
```

### 2. Legacy Tables (Maintained for Backward Compatibility)

#### `articles` (Traditional Scraped Content)
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- AI Enhancement Tracking
    is_ai_enhanced BOOLEAN DEFAULT false,
    original_article_id UUID,
    enhancement_metadata JSONB,
    language VARCHAR(10),
    
    -- Selection Tracking (prevents re-selection)
    selected_for_enhancement BOOLEAN DEFAULT false,
    selection_metadata JSONB,
    
    -- Soft Delete Support
    deleted_at TIMESTAMPTZ NULL
);
```

**Selection Tracking Fields**:
- `selected_for_enhancement`: Boolean flag preventing AI from re-selecting the same articles
- `selection_metadata`: JSONB containing:
  - `selected_at`: Timestamp when article was selected
  - `selection_reason`: Why Perplexity chose this article
  - `priority_score`: Quality score assigned by AI (0-100)
  - `perplexity_selection_id`: Original selection identifier
  - `selection_session`: Session timestamp for grouping selections

**Enhanced Articles**:
- Original articles remain unchanged with `selected_for_enhancement = true`
- Enhanced versions are saved as separate records with `is_ai_enhanced = true`
- Unique URLs prevent conflicts (`#enhanced-en-timestamp`, etc.)

#### `perplexity_news` (AI-Generated Content)
```sql
CREATE TABLE perplexity_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    article_status TEXT DEFAULT 'pending',
    image_status TEXT DEFAULT 'pending',
    article_html TEXT,
    lede TEXT,
    image_url TEXT,
    enhanced_title TEXT,
    summary TEXT,
    key_points JSONB,
    why_it_matters TEXT,
    structured_sources JSONB,
    source TEXT NOT NULL,
    author TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `headlines` (Categorized News Headlines)
```sql
CREATE TABLE headlines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## TypeScript Data Models

### Core Article Types

```typescript
// Main unified article interface
export interface UnifiedArticle {
  // Core fields
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  category: string;
  
  // Timestamps
  created_at: string;
  published_at: string;  // Primary ordering field
  updated_at: string;
  
  // Content fields
  summary?: string;
  lede?: string;
  key_points?: string[];
  why_it_matters?: string;
  
  // Media
  image_url?: string;
  image_metadata?: ImageMetadata;
  
  // Status tracking
  status: ArticleStatus;
  processing_status: ProcessingStatus;
  
  // Metadata
  article_type: ArticleType;
  generation_metadata?: GenerationMetadata;
  enhancement_metadata?: EnhancementMetadata;
  structured_sources?: StructuredSources;
  contextual_data?: ContextualData;
  
  // Author
  author?: string;
  
  // Cost tracking
  generation_cost?: number;
  
  // Features
  features: ArticleFeatures;
  
  // Search
  search_queries?: string[];
  
  // Legacy tracking
  legacy_article_id?: string;
  legacy_table_name?: string;
}
```

### Status Enums

```typescript
export type ArticleStatus = 'draft' | 'published' | 'archived';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type ArticleType = 'scraped' | 'ai_generated' | 'ai_enhanced';
```

### Metadata Structures

```typescript
export interface ImageMetadata {
  original?: string;
  optimized?: string;
  whatsapp?: string;
  license?: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface GenerationMetadata {
  model?: string;
  cost?: number;
  image_prompt?: string;
  citations?: any[];
  enhanced_title?: string;
  generated_at?: string;
}

export interface EnhancementMetadata {
  searchQueries?: string[];
  sources?: string[];
  relatedTopics?: string[];
  enhancedAt?: string;
  enhancementCost?: string;
  originalArticleId?: string;
  language?: string;
}

export interface StructuredSources {
  citations?: any[];
  sources?: string[];
  generated_at?: string;
}

export interface ContextualData {
  contextual_bullets?: string[];
  data_points?: any[];
  historical_references?: any[];
  enrichment_version?: string;
}

export interface ArticleFeatures {
  has_image: boolean;
  has_ai_content: boolean;
  has_translation: boolean;
}
```

## Content Processing Pipeline

### 1. Traditional Scraping Pipeline
```
Raw HTML → Content Extraction → articles table → published
```

### 2. AI-Generated Content Pipeline
```
Topic/Category → Perplexity API → perplexity_news table → Enhancement → published
```

### 3. Unified Pipeline (Target Architecture)
```
Content Source → Processing → articles_unified → Status Updates → published
```

## Database Indexes

### Performance Indexes
```sql
-- Time-based queries
CREATE INDEX idx_articles_unified_published_at ON articles_unified(published_at DESC);
CREATE INDEX idx_articles_unified_created_at ON articles_unified(created_at DESC);

-- Filtering indexes
CREATE INDEX idx_articles_unified_category ON articles_unified(category);
CREATE INDEX idx_articles_unified_source ON articles_unified(source);
CREATE INDEX idx_articles_unified_article_type ON articles_unified(article_type);
CREATE INDEX idx_articles_unified_status ON articles_unified(status);
CREATE INDEX idx_articles_unified_processing_status ON articles_unified(processing_status);

-- JSONB indexes
CREATE INDEX idx_articles_unified_features ON articles_unified USING gin(features);
CREATE INDEX idx_articles_unified_search_queries ON articles_unified USING gin(search_queries);

-- Full-text search
CREATE INDEX idx_articles_search ON articles USING gin(
    to_tsvector('english', title || ' ' || COALESCE(summary, ''))
);
```

## Row Level Security (RLS)

### Public Access Policy
```sql
CREATE POLICY "Public can read published articles" ON articles_unified
    FOR SELECT
    USING (status = 'published');
```

### Service Role Policy
```sql
CREATE POLICY "Service role can manage all articles" ON articles_unified
    FOR ALL
    USING (auth.role() = 'service_role');
```

## Migration Strategy

### Current State
- Multiple tables with different schemas
- Backward compatibility maintained
- Legacy data preserved

### Migration Path
1. **Phase 1**: Dual-write to both old and new tables
2. **Phase 2**: Migrate existing data to unified table
3. **Phase 3**: Update application to read from unified table
4. **Phase 4**: Deprecate legacy tables

### Migration Scripts
- `20240116_unified_articles_schema.sql`: Creates unified table
- `20240116_migrate_existing_articles.sql`: Migrates legacy data
- `20240116_backward_compatibility_views.sql`: Creates compatibility views

## Cost Tracking

### AI Operation Costs
```sql
generation_cost DECIMAL(10, 6)  -- Tracks per-article AI processing costs
```

### Cost Metadata
```typescript
interface GenerationMetadata {
  model?: string;           // AI model used
  cost?: number;           // Cost in USD
  generated_at?: string;   // Timestamp
}
```

## Feature Flags

### Article Features
```typescript
interface ArticleFeatures {
  has_image: boolean;        // Article has associated image
  has_ai_content: boolean;   // Contains AI-generated content
  has_translation: boolean;  // Available in multiple languages
}
```

### Usage in Queries
```sql
-- Filter for articles with images
SELECT * FROM articles_unified WHERE features->>'has_image' = 'true';

-- Filter for AI-enhanced content
SELECT * FROM articles_unified WHERE features->>'has_ai_content' = 'true';
```

## API Response Types

### Unified Articles Response
```typescript
export interface UnifiedArticlesResponse {
  articles: UnifiedArticle[];
  nextPage: number | null;
  totalCount?: number;
  hasMore: boolean;
  debug?: {
    source: 'database' | 'mock';
    query?: any;
    error?: string;
  };
}
```

### Query Parameters
```typescript
export interface ArticleQueryParams {
  page?: number;
  limit?: number;
  type?: ArticleType | 'all';
  category?: string;
  source?: string;
  features?: string[];
  sort?: 'latest' | 'popular' | 'relevance';
  status?: ArticleStatus;
  processingStatus?: ProcessingStatus;
  search?: string;
}
```

## Car Listings Data Model

### Car Listing Interface
```typescript
export interface CarListing {
  id: string;
  title: string;
  make?: string;
  model?: string;
  year?: string;
  price?: string;
  content?: string;
  summary?: string;
  ai_summary?: string;  // AI enrichment data in markdown format
  url: string;
  source: string;
  imageUrl?: string;
  images?: string[];
  category: 'cars';
  publishedAt: string;
  specs?: Record<string, string>;
}
```

### Car Specifications
```typescript
export interface CarSpecs {
  make: string;           // 車廠 (e.g., "豐田 TOYOTA")
  model: string;          // 型號 (e.g., "ALPHARD 2.5 Z")
  year?: string;          // 年份 (e.g., "2023")
  price: string;          // 售價 - now supports multi-comma parsing (e.g., "HKD$2,450,000")
  engine?: string;        // 引擎 (e.g., "2.5L Hybrid")
  transmission?: string;  // 波箱 (e.g., "CVT")
  fuel?: string;          // 燃料 (e.g., "Hybrid")
  doors?: string;         // 車門 (e.g., "4")
  color?: string;         // 顏色 (e.g., "White")
  mileage?: string;       // 里程 (e.g., "8,000 km")
  contact?: string;       // 聯絡 (seller contact info)
  description?: string;   // 簡評 (seller description)
}
```

### Car Enrichment Data Model
```typescript
export interface CarEnrichmentData {
  estimatedYear?: number;    // AI-estimated manufacturing year
  isElectric: boolean;       // Whether the vehicle is electric
  fuelConsumption?: string;  // Fuel consumption (L/100km or kWh/100km)
  fuelCostHKD?: string;      // Estimated monthly fuel cost in HKD
  faults: string[];          // Common faults buyers should check
  sources: string[];         // Sources used for enrichment
}

export interface EnrichedCarListing extends CarListing {
  ai_summary?: string;          // Enriched data in markdown format
  enrichmentData?: CarEnrichmentData;  // Parsed enrichment data
}
```

### Car Image Metadata
```typescript
export interface CarImageMetadata {
  main: string;           // Main display image (highest resolution available)
  thumbnails: string[];   // Additional photos (up to 8)
  count: number;          // Total number of images
  qualityDistribution: {  // Quality breakdown of extracted images
    big: number;          // High-resolution _b.jpg images (30-70KB)
    medium: number;       // Medium-resolution _m.jpg images (6-7KB)
    small: number;        // Small-resolution _s.jpg images (2-3KB)
  };
  sources: {
    original: string;     // Original 28car.com image URL
    optimized?: string;   // Optimized high-resolution version
    quality: 'big' | 'medium' | 'small';  // Image quality level
    fileSize?: number;    // File size in bytes
  }[];
}
```

### Car Response Types
```typescript
export interface CarsResponse {
  articles: CarListing[];
  nextPage: number | null;
  hasMore: boolean;
  totalCount?: number;
  enrichmentStats?: {
    totalCars: number;
    enrichedCars: number;
    unenrichedCars: number;
  };
  debug?: {
    source: 'database' | 'mock';
    query?: any;
    error?: string;
  };
}

export interface CarStatsResponse {
  total: number;
  recent24h: number;
  priceRanges: {
    under200k: number;
    range200to300k: number;
    range300to500k: number;
    over500k: number;
  };
}
```

## Car Scraper Data Flow

### 28car Scraper Pipeline
1. **Browser Initialization**: Environment-aware browser setup
   - **Development**: Uses Puppeteer with local Chrome/Chromium
   - **Production**: Uses Puppeteer-core with @sparticuz/chromium for Vercel serverless
2. **Listing Discovery**: Parse mobile 28car.com listing page
3. **Detail Extraction**: Navigate to individual car pages using automated browser
4. **Spec Parsing**: Extract structured car specifications with improved price parsing for multi-comma numbers (e.g., 2,450,001)
5. **Advanced Image Collection**: Multi-tier high-resolution image extraction
   - **Modal Gallery Simulation**: Trigger user interactions to load high-res images
   - **Direct URL Testing**: Test `_b.jpg`, `_m.jpg`, `_s.jpg` variants systematically
   - **Quality Optimization**: Automatically upgrade to highest available resolution
   - **Extract up to 8 photos per car** with 8-10x better quality than previous version
6. **Data Transformation**: Convert to unified article format with enhanced image metadata
7. **Database Storage**: Store with category='cars' in articles table with image quality tracking
8. **AI Enrichment**: Optional Perplexity API enhancement for year estimation, faults, and fuel data

### Car Data Storage
Cars are stored in the unified articles table with these specific fields:
- `category`: Always set to 'cars'
- `source`: '28car'
- `title`: "{make} {model}" format
- `content`: Structured specifications as text
- `ai_summary`: AI enrichment data in markdown format (year, faults, electric status, fuel data)
- `image_url`: Primary car photo
- `images`: Array of all car photos (stored as JSONB)
- `specs`: Raw specifications data (stored as JSONB)

### Car Price Parsing
The system now supports accurate parsing of multi-comma numbers using the regex pattern `/(\d{1,3}(?:,\d{3})*)/g`:
- **Correct**: "HK$2,450,000" → "2,450,000"
- **Correct**: "HK$1,888,888" → "1,888,888"  
- **Previous Issue**: Multi-comma numbers like "2,450,001" were parsed as "2,450"
- **Fix**: Updated regex handles any number of comma groups for accurate price display

### Car Image Resolution System

#### Image Quality Variants
28car.com provides images in three quality levels:

| Suffix | Quality | Typical Size | Resolution | Usage |
|--------|---------|--------------|------------|-------|
| `_b.jpg` | **Big (High-res)** | 30-70KB | 375x281px | **Primary extraction target** |
| `_m.jpg` | Medium | 6-7KB | 144x108px | Fallback if big unavailable |
| `_s.jpg` | Small | 2-3KB | 64x48px | Last resort |

#### Extraction Strategy
The scraper uses a multi-layered approach to obtain the highest quality images:

1. **Modal Gallery Simulation**: Simulates user clicks to trigger loading of `_b.jpg` images
2. **Direct URL Testing**: Systematically tests URL variants for each discovered image
3. **Smart Prioritization**: Automatically selects the best available quality
4. **Fallback Protection**: Ensures at least some images are extracted even if high-res fails

#### URL Pattern Examples
```
Base: https://djlfajk23a.28car.com/data/image/sell/2589000/2589936/d114a8a9/2589936
Small: https://djlfajk23a.28car.com/data/image/sell/2589000/2589936/d114a8a9/2589936_s.jpg
Medium: https://djlfajk23a.28car.com/data/image/sell/2589000/2589936/d114a8a9/2589936_m.jpg  
Big: https://djlfajk23a.28car.com/data/image/sell/2589000/2589936/d114a8a9/2589936_b.jpg ⭐
```

#### Performance Results
- **Previous version**: Mixed quality, ~3-5 images per car
- **Current version**: 100% high-resolution, up to 8 images per car
- **Quality improvement**: 8-10x larger file sizes for significantly better image quality

This data model provides a robust foundation for the AI-enhanced news aggregation platform, supporting both traditional content and automotive listings while maintaining performance and scalability.