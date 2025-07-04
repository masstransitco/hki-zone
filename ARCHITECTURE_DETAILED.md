# Panora.hk - Detailed Architecture Documentation

## Project Overview
Panora.hk is a comprehensive Hong Kong news aggregator built with Next.js 14 that scrapes articles from multiple local news sources, processes them with AI summarization, and provides a modern responsive web interface for news consumption.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Component Library**: Radix UI (comprehensive set of accessible components)
- **Icons**: Lucide React, Heroicons
- **State Management**: TanStack Query (React Query) for server state
- **Theme**: next-themes for dark/light mode

### Backend
- **Runtime**: Next.js API Routes (Edge Runtime)
- **Database**: Supabase (PostgreSQL)
- **Web Scraping**: Cheerio for HTML parsing
- **AI Processing**: Anthropic Claude (Haiku model)
- **File Processing**: fast-xml-parser, iconv-lite

### Development & Deployment
- **Package Manager**: pnpm
- **Build System**: Next.js build system
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics
- **Environment**: Node.js with TypeScript

## Project Structure

```
panora830/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Homepage
│   ├── globals.css              # Global styles
│   ├── admin/                   # Admin panel pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── articles/
│   │   ├── database/
│   │   └── settings/
│   ├── api/                     # API routes
│   │   ├── articles/           # Article CRUD operations
│   │   ├── search/             # Search functionality
│   │   ├── scrape/             # Scraping operations
│   │   ├── cron/               # Scheduled jobs
│   │   └── admin/              # Admin operations
│   ├── article/[id]/           # Individual article pages
│   ├── search/                 # Search results pages
│   ├── topics/                 # Topic discovery
│   └── profile/                # User profile
├── components/                  # Reusable UI components
│   ├── ui/                     # Radix UI components
│   ├── admin/                  # Admin-specific components
│   ├── news-feed.tsx           # Main news feed component
│   ├── article-card.tsx        # Article display component
│   ├── search-interface.tsx    # Search functionality
│   └── theme-provider.tsx      # Theme management
├── lib/                        # Business logic & utilities
│   ├── scrapers/               # News source scrapers
│   │   ├── hkfp.js
│   │   ├── singtao.js
│   │   ├── hk01.js
│   │   ├── oncc.js
│   │   └── rthk.js
│   ├── scraper-orchestrator.ts # Coordinates scraping
│   ├── ai-summarizer.ts        # AI content processing
│   ├── supabase.ts             # Database operations
│   ├── types.ts                # TypeScript definitions
│   └── utils.ts                # Utility functions
├── hooks/                      # Custom React hooks
├── public/                     # Static assets
├── scripts/                    # Database setup scripts
├── docs/                       # Additional documentation
└── styles/                     # Additional stylesheets
```

## Core Architecture Components

### 1. Frontend Layer (`/app`)

#### App Router Structure
- **Root Layout** (`layout.tsx`): Provides global providers (Theme, Language, Query, Analytics)
- **Pages**: Follow Next.js 14 App Router convention with `page.tsx` files
- **API Routes**: Server-side endpoints under `/api` directory
- **Dynamic Routes**: `[id]` patterns for article details

#### Key Pages
- **Homepage** (`page.tsx`): Main news feed with topic filtering
- **Article Detail** (`article/[id]/page.tsx`): Individual article view
- **Search** (`search/page.tsx`): Search results with filtering
- **Admin Panel** (`admin/`): Content management interface

### 2. Component Architecture (`/components`)

#### UI Components (`/components/ui`)
- **Radix UI Based**: Accessible, unstyled components
- **Shadcn/ui Pattern**: Customizable component library
- **Key Components**: Button, Card, Dialog, Sheet, Table, Form elements

#### Feature Components
- **NewsFeed** (`news-feed.tsx`): Infinite scroll article listing
- **ArticleCard** (`article-card.tsx`): Article preview component
- **SearchInterface** (`search-interface.tsx`): Search functionality
- **Header** (`header.tsx`): Navigation and branding
- **AdminPanel** (`admin-panel.tsx`): Content management

#### Provider Components
- **ThemeProvider**: Dark/light mode management
- **LanguageProvider**: Internationalization support
- **QueryProvider**: TanStack Query configuration
- **AnalyticsProvider**: Vercel Analytics integration

### 3. Business Logic Layer (`/lib`)

#### Data Access (`supabase.ts`)
```typescript
// Key functions:
export async function getArticles(page, limit, filters)
export async function saveArticle(article)
export async function searchArticles(query)
export async function checkDatabaseSetup()
```

#### Web Scraping System

##### Scraper Orchestrator (`scraper-orchestrator.ts`)
- **Coordinates**: Multiple news source scrapers
- **Progress Tracking**: Real-time scraping status
- **Error Handling**: Graceful fallbacks and retry logic

##### Individual Scrapers (`/lib/scrapers/`)
- **HKFP** (`hkfp.js`): Hong Kong Free Press
- **SingTao** (`singtao.js`): Sing Tao Daily
- **HK01** (`hk01.js`): HK01 News
- **ONCC** (`oncc.js`): ON.CC News
- **RTHK** (`rthk.js`): Radio Television Hong Kong

Each scraper implements:
```javascript
// Common pattern for all scrapers
export async function scrapeWithContent() {
  // Fetch article list
  // Extract content and metadata
  // Return structured article data
}
```

##### AI Integration (`ai-summarizer.ts`)
- **Provider**: Anthropic Claude Haiku model
- **Function**: Generates article summaries for content-light articles
- **Rate Limiting**: Built-in delays for API compliance
- **Fallback**: Uses article title if AI processing fails

### 4. Data Layer

#### Database Schema (Supabase/PostgreSQL)
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  is_ai_enhanced BOOLEAN DEFAULT FALSE,
  original_article_id UUID,
  enhancement_metadata JSONB
);
```

#### Database Operations
- **Balanced Querying**: Proportional representation from all sources
- **Full-text Search**: PostgreSQL search capabilities
- **Duplicate Detection**: URL-based deduplication
- **Graceful Degradation**: Mock data fallbacks

### 5. API Layer (`/app/api`)

#### Core Endpoints
- `GET /api/articles` - Paginated article listing with filters
- `GET /api/articles/[id]` - Individual article details
- `GET /api/search` - Full-text search functionality
- `POST /api/scrape/[outlet]` - Manual scraping triggers
- `GET /api/scrape/progress` - Real-time scraping status
- `POST /api/cron/scrape-news` - Scheduled scraping endpoint

#### Admin Endpoints
- `GET /api/admin/articles` - Admin article management
- `POST /api/admin/articles/clone-with-ai` - AI enhancement
- `GET /api/admin/database/stats` - Database statistics
- `POST /api/admin/database/migrate-ai-enhancement` - Schema migrations

## Data Flow Architecture

### 1. Content Ingestion Flow
```
News Sources → Scrapers → Content Extraction → AI Processing → Database Storage
```

**Detailed Process:**
1. **Scheduled Trigger**: Cron job or manual initiation
2. **Scraper Orchestration**: Run individual source scrapers
3. **Content Extraction**: Parse HTML and extract article data
4. **AI Enhancement**: Process articles needing summarization
5. **Deduplication**: Check for existing articles by URL
6. **Database Storage**: Save to Supabase with metadata

### 2. User Interface Flow
```
User Request → Next.js API → Database Query → Component Rendering → User Interface
```

**Detailed Process:**
1. **User Navigation**: Browse, search, or filter articles
2. **API Request**: Frontend calls Next.js API routes
3. **Data Fetching**: Query Supabase database
4. **State Management**: TanStack Query handles caching
5. **Component Rendering**: React components display data
6. **Responsive UI**: Tailwind CSS provides styling

### 3. Real-time Features
- **Progress Tracking**: Live scraping status updates
- **Infinite Scroll**: Seamless content loading
- **Search Suggestions**: Dynamic query processing
- **Theme Switching**: Instant UI mode changes

## Key Features & Capabilities

### News Aggregation
- **Multi-source**: 5 major Hong Kong news outlets
- **Real-time**: Scheduled and manual scraping
- **Balanced Content**: Proportional representation from all sources
- **Content Enhancement**: AI-powered summarization

### User Experience
- **Responsive Design**: Mobile-first approach
- **Performance**: Optimized loading and caching
- **Accessibility**: Radix UI components for screen readers
- **Theming**: Dark/light mode support
- **Search**: Full-text search across all content

### Content Management
- **Admin Interface**: Article review and management
- **AI Enhancement**: Content improvement workflows
- **Database Tools**: Statistics and migration utilities
- **Progress Monitoring**: Real-time scraping visibility

## Security & Performance

### Security Measures
- **Row Level Security**: Supabase RLS policies
- **Environment Variables**: Secure API key management
- **Content Security Policy**: Image and script restrictions
- **Input Validation**: Sanitization of user inputs

### Performance Optimizations
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Dynamic imports for large components
- **Database Indexing**: Optimized query performance
- **Caching Strategy**: TanStack Query for client-side caching
- **Bundle Optimization**: Tree shaking and minification

## External Dependencies

### Required Services
- **Supabase**: Database and authentication platform
- **Anthropic**: AI summarization service
- **Vercel**: Hosting and deployment platform

### News Sources
- **Hong Kong Free Press** (HKFP)
- **Sing Tao Daily** (SingTao)
- **HK01**
- **ON.CC**
- **Radio Television Hong Kong** (RTHK)

## Development & Deployment

### Local Development
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

### Environment Configuration
- `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Backend database access
- `ANTHROPIC_API_KEY`: AI summarization service

### Deployment Architecture
- **Platform**: Vercel (Edge Runtime)
- **Database**: Supabase cloud hosting
- **CDN**: Vercel's global CDN
- **Analytics**: Vercel Analytics integration

## Monitoring & Maintenance

### Health Checks
- Database connectivity validation
- Scraper performance monitoring
- AI service availability
- Content freshness verification

### Error Handling
- Graceful degradation to mock data
- Retry mechanisms for failed operations
- User-friendly error messages
- Comprehensive logging

This architecture provides a robust, scalable foundation for Hong Kong news aggregation with modern web technologies and AI enhancement capabilities.