# HKI News App - Architecture Overview

## System Architecture

This is a Next.js 14 application serving as an AI-enhanced news aggregation platform for Hong Kong news sources and automotive listings. The system combines traditional web scraping with advanced AI content enhancement using Perplexity API, featuring four distinct content feeds: news articles, AI-enhanced topics, headlines, and car listings.

### Core Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                      │
├─────────────────────────────────────────────────────────────────┤
│  Public Routes     │  Admin Routes     │  API Routes            │
│  • Home Feed       │  • Dashboard      │  • Content APIs        │
│  • Headlines       │  • Article Mgmt   │  • Admin APIs          │
│  • Perplexity      │  • Perplexity     │  • Cron Jobs           │
│  • Topics          │  • Database       │  • Utility APIs        │
│  • Cars Feed       │  • Settings       │                        │
│  • Search          │                   │                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer (Supabase)                   │
├─────────────────────────────────────────────────────────────────┤
│  Tables:           │  Content Pipeline:                         │
│  • articles        │  Raw Scraped → AI Enhanced → Published     │
│  • perplexity_news │  Status: pending → enriched → ready        │
│  • headlines       │                                            │
│  • unified_articles│                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                           │
├─────────────────────────────────────────────────────────────────┤
│  News Sources:     │  AI Services:                             │
│  • HKFP            │  • Perplexity API (content enhancement)   │
│  • SingTao         │  • Anthropic Claude (AI processing)       │
│  • HK01            │  • Google Images (image search)           │
│  • ONCC            │  • Unsplash (fallback images)             │
│  • RTHK            │                                            │
│  • 28car (Cars)    │                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Dual Content Pipeline
- **Traditional Scraping**: Direct content extraction from news sources
- **AI Enhancement**: Contextual enrichment using Perplexity API
- **Unified Interface**: Combined view of all content types

### 2. Progressive Enhancement Strategy
- **Base Content**: Articles work without AI enhancement
- **AI Augmentation**: Additional context, key points, and structured data
- **Fallback Mechanisms**: Mock data when external services unavailable

### 3. Multi-Stage Processing Pipeline
```
Raw Article → Scraped → AI Enhanced → Published
   ↓           ↓           ↓            ↓
pending → enriched → ready → displayed
```

### 4. Database Architecture
- **Primary**: Supabase PostgreSQL with real-time subscriptions
- **Fallback**: Mock data for offline/development scenarios
- **Migration**: Backward-compatible schema evolution

### 5. API Design Patterns
- **RESTful**: Standard HTTP methods for CRUD operations
- **Cron Jobs**: Automated content processing via API routes
- **Rate Limiting**: Controlled external API usage
- **Error Handling**: Graceful degradation across all endpoints

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **UI Components**: Radix UI with custom styling
- **State Management**: React Query for server state
- **Styling**: Tailwind CSS with custom components
- **Theming**: Next-themes for dark/light mode

### Backend
- **Runtime**: Node.js with Edge Runtime support
- **Database**: Supabase (PostgreSQL)
- **AI Integration**: Perplexity API, Anthropic Claude
- **Image Processing**: Sharp for optimization
- **Web Scraping**: Puppeteer with serverless browser automation
  - **Development**: Regular Puppeteer with local Chrome/Chromium
  - **Production**: @sparticuz/chromium for Vercel serverless compatibility

### DevOps & Deployment
- **Platform**: Vercel with edge functions
- **Cron Jobs**: Vercel cron for automated tasks
- **Analytics**: Vercel Analytics integration
- **Monitoring**: Built-in health checks and status endpoints

## Data Flow

### Content Ingestion
1. **Scheduled Scraping**: Cron jobs trigger scrapers every 15 minutes (updated from 30 minutes)
2. **Content Extraction**: Serverless browser automation extracts articles and car listings
   - **Environment Detection**: Automatically selects appropriate browser configuration
   - **Development**: Uses local Chrome/Chromium installation via Puppeteer
   - **Production**: Uses @sparticuz/chromium for Vercel serverless environment
3. **Initial Processing**: Basic metadata extraction and categorization
4. **Database Storage**: Raw content stored with appropriate category (news/cars)
   - **Primary**: articles_unified table (2,272 cars - 90%+ of content)
   - **Legacy**: articles table (235 cars - older content)

#### Car Listings Pipeline
1. **28car Scraping**: Dedicated scraper for automotive listings (every 15 minutes)
2. **High-Resolution Photo Extraction**: Advanced multi-tier image extraction system:
   - **Modal Gallery Interaction**: Simulates user clicks to trigger high-res image loading
   - **Direct URL Upgrade**: Tests `_b.jpg` (big), `_m.jpg` (medium), `_s.jpg` (small) variants
   - **Quality Prioritization**: Automatically selects highest available resolution
   - **Up to 8 photos per car** with 8-10x better quality (30-70KB vs 6-7KB)
3. **Spec Parsing**: Price, make, model, year, and technical specifications with improved multi-comma number support
4. **Data Storage**: Stored in articles table with category='cars' and enhanced image metadata
5. **AI Enrichment**: Automated Perplexity API enhancement every 2 hours

#### Car AI Enrichment Pipeline
1. **Automated Scheduling**: Cron job runs every 2 hours (`0 */2 * * *`)
2. **Car Selection**: Query unenriched cars (`ai_summary` = null), newest first, limit 5 per run
3. **Cost Control**: 3-second rate limiting between API calls, maximum 5 cars per batch
4. **Perplexity Analysis**: AI determines estimated year, common faults, electric status, fuel consumption
5. **Enrichment Storage**: Enhanced data stored in ai_summary field as structured markdown
6. **Data Generated**: Vehicle type, fuel consumption, monthly costs, inspection points
7. **Bottom Sheet Display**: Enriched content rendered in car detail views with "Things to Look Out For"
8. **Admin Management**: Manual enrichment triggers and filtering of enriched/unenriched cars

### AI Enhancement Pipeline
1. **Content Selection**: Identify articles for AI enhancement
2. **Perplexity Processing**: Generate enhanced summaries and key points
3. **Dual Format Support**: Handle both `**Header**` and `## HEADER` formats
4. **Content Parsing**: Extract structured sections (Summary, Key Points, Why It Matters)
5. **Source Management**: Remove redundant source lists while preserving citations
6. **Interactive Citations**: Transform `[1][2]` into clickable buttons
7. **Image Enhancement**: AI-generated image prompts and search
8. **Structured Data**: Extract citations, sources, and metadata
9. **Status Update**: Mark articles as 'enriched' or 'ready'

### Content Delivery
1. **API Endpoints**: Serve content through REST APIs
   - **Dual-table search**: Enhanced car search covers both articles_unified and articles tables
   - **Individual detail pages**: Direct routes for cars (`/cars/[id]`) and signals (`/perplexity/[id]`)
2. **Caching**: Client-side caching with React Query
3. **Pagination**: Infinite scroll for large datasets
4. **Real-time Updates**: Supabase subscriptions for live content
5. **Share Functionality**: Direct linking with proper SEO metadata
   - **In-app navigation**: Bottom sheets for smooth UX
   - **External sharing**: Full pages for SEO and social media

## Performance Considerations

### Scalability
- **Infinite Scroll**: Efficient pagination for large datasets
- **Image Optimization**: Multiple formats for different platforms
- **Database Indexing**: Optimized queries for fast retrieval
- **CDN**: Vercel Edge Network for global distribution

### Reliability
- **Fallback Data**: Mock data when external services fail
- **Error Boundaries**: Graceful error handling in React components
- **Rate Limiting**: Controlled API usage to prevent service overload
- **Health Checks**: Automated monitoring of critical services
- **Browser Automation Resilience**: 
  - Automatic fallback between Puppeteer and @sparticuz/chromium
  - Environment-specific browser configuration
  - Graceful degradation when browser dependencies unavailable
- **Advanced Image Extraction**:
  - Multi-layered approach: Modal gallery simulation + Direct URL testing
  - Smart quality prioritization with automatic upgrades
  - Fallback mechanisms ensure compatibility across all scenarios

### Security
- **API Authentication**: Supabase Row Level Security
- **Input Validation**: Zod schemas for data validation
- **CSRF Protection**: Next.js built-in protections
- **Content Security Policy**: Strict CSP headers for XSS prevention

## Integration Points

### External APIs
- **Perplexity API**: Content enhancement, contextual information, and car enrichment (year estimation, faults, fuel data)
- **Anthropic Claude**: Additional AI processing capabilities
- **Google Images**: Image search and metadata extraction
- **Unsplash**: High-quality fallback images

### Database Integration
- **Connection Pooling**: Supabase connection management
- **Real-time Subscriptions**: Live content updates
- **Batch Operations**: Efficient bulk data processing
- **Schema Migrations**: Version-controlled database evolution

This architecture provides a robust foundation for a scalable, AI-enhanced news aggregation platform with comprehensive admin tools and user-friendly interfaces.