# Article Pipeline Database Architecture

## Overview

The article pipeline uses a PostgreSQL database hosted on Supabase with a multi-table architecture designed to handle news article scraping, AI enhancement, and content management at scale. The system processes approximately **1,000+ articles daily** across **15 unique sources**.

## Core Statistics

| Table | Total Records | Active Records | Size | Unique Sources/Categories |
|-------|---------------|----------------|------|---------------------------|
| `articles` | 26,210 | 26,075 | 100 MB | 15 sources |
| `perplexity_news` | 1,429 | 1,227 | 7.2 MB | 6 categories |

## Table Architecture

### 1. Articles Table (Primary Content)

The main table storing all scraped and processed articles.

#### Schema

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `title` | TEXT | NO | - | Article headline |
| `content` | TEXT | YES | - | Full article content |
| `summary` | TEXT | YES | - | Original article summary |
| `ai_summary` | TEXT | YES | - | AI-generated summary |
| `url` | TEXT | NO | - | Unique article URL |
| `source` | TEXT | NO | - | News outlet name |
| `author` | TEXT | YES | - | Article author |
| `published_at` | TIMESTAMPTZ | YES | - | Original publication date |
| `source_published_at` | TIMESTAMPTZ | YES | - | Source-specific publication timestamp |
| `image_url` | TEXT | YES | - | Main article image |
| `category` | TEXT | YES | `'General'` | Content category |
| `created_at` | TIMESTAMPTZ | YES | `now()` | Database insertion time |
| `updated_at` | TIMESTAMPTZ | YES | `now()` | Last modification time |
| `deleted_at` | TIMESTAMPTZ | YES | - | Soft deletion timestamp |

#### AI Enhancement Fields

| Column | Type | Description |
|--------|------|-------------|
| `is_ai_enhanced` | BOOLEAN | Enhancement status flag |
| `original_article_id` | UUID | Links to source article for enhanced versions |
| `enhancement_metadata` | JSONB | Enhancement processing metadata |
| `trilingual_batch_id` | TEXT | Groups multilingual article versions |
| `language_variant` | VARCHAR(10) | Language code (en, zh-CN, zh-TW) |
| `language_order` | INTEGER | Order within language batch |
| `quality_score` | INTEGER | Content quality assessment |
| `selected_for_enhancement` | BOOLEAN | Selection pipeline flag |
| `selection_metadata` | JSONB | Selection processing metadata |

#### Specialized Fields (Cars Content)

| Column | Type | Description |
|--------|------|-------------|
| `make` | TEXT | Vehicle manufacturer |
| `model` | TEXT | Vehicle model |
| `specs` | JSONB | Vehicle specifications |
| `images` | JSONB | Multiple vehicle images |
| `image_metadata` | JSONB | Image processing metadata |

#### Search & Indexing

| Column | Type | Description |
|--------|------|-------------|
| `search_text` | TSVECTOR | Full-text search vector |
| `source_article_id` | TEXT | External article identifier |

### 2. Perplexity News Table (AI-Generated Content)

Stores AI-generated news articles from Perplexity AI.

#### Schema

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `category` | TEXT | - | News category |
| `title` | TEXT | - | Generated headline |
| `enhanced_title` | TEXT | - | Improved headline |
| `url` | TEXT | - | Reference URL |
| `url_hash` | TEXT | - | URL deduplication hash |
| `article_status` | TEXT | `'pending'` | Processing status |
| `article_html` | TEXT | - | Generated article content |
| `lede` | TEXT | - | Article lead paragraph |
| `summary` | TEXT | - | Article summary |
| `key_points` | TEXT[] | - | Key points array |
| `why_it_matters` | TEXT | - | Significance explanation |

#### AI Processing Fields

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `perplexity_model` | TEXT | `'sonar-pro'` | AI model used |
| `generation_cost` | NUMERIC | - | Processing cost |
| `search_queries` | TEXT[] | - | Source search queries |
| `citations` | JSONB | - | Source citations |
| `structured_sources` | JSONB | - | Organized source references |
| `contextual_data` | JSONB | - | Additional context metadata |

#### Image Processing

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `image_status` | TEXT | `'pending'` | Image generation status |
| `image_url` | TEXT | - | Generated image URL |
| `image_prompt` | TEXT | - | Image generation prompt |
| `image_license` | TEXT | - | Image licensing info |

#### Metadata

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | TEXT | `'Perplexity AI'` | Content source |
| `author` | TEXT | `'AI Generated'` | Content author |
| `inserted_at` | TIMESTAMPTZ | `now()` | Creation timestamp |
| `created_at` | TIMESTAMPTZ | `now()` | Database insertion |
| `updated_at` | TIMESTAMPTZ | `now()` | Last modification |

## Indexing Strategy

### Articles Table Indexes (23 indexes)

#### Core Performance Indexes
- `articles_pkey` - Primary key (id)
- `articles_url_key` - Unique URL constraint
- `idx_articles_created_at` - Time-based queries
- `idx_articles_source` - Source filtering
- `idx_articles_category` - Category filtering

#### AI Enhancement Indexes
- `idx_articles_is_ai_enhanced` - Enhancement status
- `idx_articles_original_article_id` - Article relationships
- `idx_articles_language_variant` - Language filtering
- `idx_articles_trilingual_batch` - Batch processing
- `idx_articles_quality_score` - Quality filtering

#### Search & Content Indexes
- `idx_articles_search` - Full-text search (GIN)
- `idx_articles_enhancement_metadata` - Metadata queries (GIN)
- `idx_articles_search_text` - Specialized car search (GIN)

#### Specialized Car Indexes
- `idx_articles_cars_category_created` - Car listings by date
- `idx_articles_cars_price` - Price-based filtering
- `idx_articles_cars_year` - Year-based filtering
- `idx_articles_make_trgm` - Fuzzy make search (trigram)
- `idx_articles_model_trgm` - Fuzzy model search (trigram)
- `idx_articles_specs` - Specification queries (GIN)
- `idx_articles_images` - Car image metadata (GIN)

#### Management Indexes
- `idx_articles_deleted_at` - Soft deletion queries
- `idx_articles_published_at` - Publication date sorting
- `idx_articles_source_article` - External ID mapping

### Perplexity News Indexes (9 indexes)

#### Core Indexes
- `perplexity_news_pkey` - Primary key
- `unique_perplexity_url` - URL deduplication
- `idx_perplexity_news_category` - Category filtering
- `idx_perplexity_news_inserted_at` - Time-based queries

#### Processing Indexes
- `idx_perplexity_news_article_status` - Status filtering
- `idx_perplexity_enhanced_title` - Enhanced content queries
- `idx_perplexity_summary` - Summary-based queries

#### Metadata Indexes
- `idx_perplexity_structured_sources` - Source references (GIN)
- `idx_perplexity_news_contextual_data` - Context metadata (GIN)

## Data Flow Architecture

### 1. Article Ingestion Pipeline

```
News Sources → Scrapers → Articles Table → Enhancement Pipeline
```

**Sources (15 active):**
- Traditional News: Bloomberg, SCMP, HKFP, RTHK, SingTao
- Local Outlets: HK01, AM730, On.cc, ONCC, TVB
- Specialized: 28car (automotive), Government feeds

### 2. AI Enhancement Pipeline

```
Articles → Selection → Enhancement → Trilingual Generation
```

**Processing Stages:**
1. **Selection**: `selected_for_enhancement` = true
2. **Enhancement**: Generate AI summaries and metadata
3. **Trilingual**: Create EN, ZH-CN, ZH-TW versions
4. **Batch Linking**: Group via `trilingual_batch_id`

### 3. Perplexity AI Pipeline

```
Categories → Perplexity API → Content Generation → Image Generation
```

**Content Categories:**
- Business, Technology, Politics, Sports, Entertainment, General

## Performance Characteristics

### Read Performance
- **Average Query Time**: <100ms for filtered article lists
- **Search Performance**: Full-text search via GIN indexes
- **Pagination**: Efficient via indexed created_at DESC

### Write Performance
- **Insert Rate**: ~1,000 articles/day sustained
- **Enhancement Processing**: Batch operations via selection pipeline
- **Soft Deletes**: 0.5% deletion rate (135/26,210 articles)

### Storage Efficiency
- **Articles**: 100MB for 26K records (~4KB average per article)
- **Perplexity**: 7.2MB for 1.4K records (~5KB average per article)
- **Index Overhead**: ~30% of total table size

## Scaling Considerations

### Current Capacity
- **Daily Volume**: 1,000+ articles/day comfortably handled
- **Active Sources**: 15 sources with room for expansion
- **Enhancement Rate**: 16.3% of articles AI-enhanced

### Growth Projections
- **Sustainable Scale**: Current architecture supports 10x growth
- **Bottlenecks**: Full-text search at >1M articles may need partitioning
- **Optimization**: Consider read replicas for dashboard queries

### Maintenance
- **Soft Deletes**: 135 deleted articles (manual cleanup only)
- **No Automated Retention**: Articles preserved indefinitely
- **Index Maintenance**: PostgreSQL auto-maintenance sufficient

## API Integration

### Supabase Configuration
- **Client**: PostgREST with 1000-row default limit
- **Authentication**: Service role for server operations
- **Real-time**: Enabled for live dashboard updates
- **Row Level Security**: Configured for multi-tenant access

### Query Patterns
- **Pagination**: Range-based for large datasets
- **Filtering**: Source, category, language, enhancement status
- **Search**: Full-text via tsvector indexes
- **Aggregation**: Metrics calculated server-side for performance

## Monitoring & Analytics

### Key Metrics Tracked
- **Volume**: Articles per day/source
- **Enhancement Rate**: AI processing efficiency
- **Source Performance**: Coverage and quality by outlet
- **Processing Time**: Pipeline stage durations

### Dashboard Queries
- **Real-time Updates**: WebSocket connections for live data
- **Historical Trends**: Time-series analysis with date indexing
- **Source Analysis**: Performance breakdown by news outlet

This architecture provides a robust foundation for high-volume news processing with sophisticated AI enhancement capabilities while maintaining query performance and data integrity.