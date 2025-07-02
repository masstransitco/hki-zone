# Panora.hk Architecture Overview

## Project Summary
Panora.hk is a Next.js-based Hong Kong news aggregator that scrapes articles from multiple local news sources, processes them with AI summarization, and provides a modern web interface for news consumption.

## Tech Stack
- **Frontend**: Next.js 14 with React 18, TypeScript
- **UI Framework**: Tailwind CSS with Radix UI components
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Anthropic Claude (Haiku model)
- **Web Scraping**: Cheerio for HTML parsing
- **State Management**: TanStack Query for data fetching
- **Deployment**: Vercel

## Architecture Layers

### 1. Frontend Layer (`/app`)
- **Next.js App Router** structure with TypeScript
- **Page Components**: Home (`page.tsx`), Article detail, Search, Topics, Profile
- **API Routes**: RESTful endpoints under `/api` directory
- **Responsive Design**: Mobile-first with theme support (dark/light)

### 2. Component Layer (`/components`)
- **UI Components**: Extensive Radix UI component library
- **Feature Components**: NewsFeeds, ArticleCards, SearchInterface
- **Provider Components**: Theme, Language, Query providers
- **Layout Components**: Header, Footer, Navigation

### 3. Business Logic Layer (`/lib`)
- **Data Access**: Supabase client and database operations
- **Web Scraping**: Orchestrator pattern with individual scrapers
- **AI Processing**: Article summarization using Anthropic Claude
- **Type Definitions**: TypeScript interfaces for data models

### 4. Data Layer
- **Primary Database**: Supabase PostgreSQL
- **Schema**: Single `articles` table with full-text search
- **Caching Strategy**: Mock data fallbacks for resilience

## Core Components

### News Scraping System
- **Scraper Orchestrator** (`scraper-orchestrator.ts`): Coordinates scraping operations
- **Individual Scrapers** (`/scrapers`): Source-specific scrapers (HKFP, SingTao, HK01, ONCC)
- **Progress Tracking**: Real-time scraping status updates
- **Error Handling**: Graceful fallbacks to mock data

### AI Integration
- **Summarization Service** (`ai-summarizer.ts`): Claude Haiku for article summaries
- **Content Processing**: Filters articles needing summarization
- **Rate Limiting**: Built-in delays to respect API limits

### Database Architecture
```sql
articles (
  id: UUID PRIMARY KEY,
  title: TEXT,
  content: TEXT,
  summary: TEXT,
  ai_summary: TEXT,
  url: TEXT UNIQUE,
  source: TEXT,
  published_at: TIMESTAMPTZ,
  image_url: TEXT,
  category: TEXT,
  created_at/updated_at: TIMESTAMPTZ
)
```

### API Structure
- `GET /api/articles` - Paginated article listing
- `GET /api/articles/[id]` - Individual article details
- `GET /api/search` - Full-text article search
- `POST /api/scrape/[outlet]` - Manual scraping triggers
- `GET /api/scrape/progress` - Real-time scraping status
- `POST /api/cron/scrape-news` - Scheduled scraping endpoint

## Data Flow

1. **Scraping Process**:
   - Cron job or manual trigger initiates scraping
   - Scraper orchestrator runs individual source scrapers
   - Articles extracted with content and metadata
   - AI summarization applied to articles without sufficient content
   - Duplicate detection via URL checking
   - Articles saved to Supabase database

2. **User Interface**:
   - Next.js pages fetch data via API routes
   - TanStack Query manages client-side caching
   - Components render articles with lazy loading
   - Search functionality uses database full-text search

## Key Features
- **Multi-source Aggregation**: HKFP, SingTao, HK01, ONCC news sources
- **AI-powered Summaries**: Automatic article summarization
- **Full-text Search**: PostgreSQL-based search with indexing
- **Real-time Progress**: Live scraping status updates
- **Responsive Design**: Mobile-optimized interface
- **Theme Support**: Dark/light mode switching
- **Internationalization**: Multi-language support structure

## External Dependencies
- **Supabase**: Database and authentication platform
- **Anthropic Claude**: AI summarization service
- **Vercel**: Hosting and deployment platform
- **News Sources**: HKFP, SingTao, HK01, ONCC for content

## Security Considerations
- Row Level Security (RLS) enabled on database
- Service role keys for backend operations
- Content Security Policy for image handling
- Environment variable management for API keys