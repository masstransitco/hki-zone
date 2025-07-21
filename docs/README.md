# HKI News App - AI Agent Documentation

## Overview

This is a comprehensive documentation suite for the HKI News App (香港資訊), an AI-enhanced news aggregation platform focused on Hong Kong news sources. This documentation is specifically optimized for AI agent processing and manipulation of the codebase.

## Quick Start for AI Agents

### Understanding the Application
The HKI News App is a Next.js 14 application that:
- Aggregates news from major Hong Kong sources (HKFP, SingTao, HK01, ONCC, RTHK, on.cc)
- Uses AI to intelligently select and enhance articles in three languages
- Provides both public and admin interfaces
- Uses Supabase for data persistence
- Implements automated article pipeline with cron jobs

### Key Technologies
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase PostgreSQL
- **AI Services**: Perplexity API for selection and enhancement
- **UI Components**: Shadcn/ui (Radix UI)
- **State Management**: React Query, React Context
- **Deployment**: Vercel with cron jobs

## Documentation Structure

### Core Article Pipeline Documentation

#### 1. [Article Pipeline Architecture](./article-pipeline-architecture.md) ⭐ *NEW*
**Purpose**: Comprehensive overview of the entire article processing pipeline.

**Key Information**:
- Complete pipeline flow from scraping to delivery
- AI selection system with anti-hallucination safeguards
- Trilingual enhancement process
- Cron job scheduling and automation
- Performance optimization strategies
- Error handling and monitoring

**When to Use**: When understanding the overall article system, implementing pipeline changes, or troubleshooting issues.

#### 2. [Architecture Overview](./01-architecture-overview.md)
**Purpose**: Understand the overall system architecture and design decisions.

**Key Information**:
- System architecture diagram
- Core architectural decisions
- Technology stack rationale
- Integration patterns
- Performance considerations

**When to Use**: Before making any significant architectural changes or when you need to understand how components interact.

#### 3. [Data Models & Database Schema](./02-data-models.md)
**Purpose**: Understand the data structures and database design.

**Key Information**:
- Database schema for articles table
- TypeScript interfaces and types
- Data relationships and constraints
- Migration strategies
- Metadata tracking structures

**When to Use**: When working with database operations, creating new data types, or modifying existing schemas.

#### 4. [API Endpoints](./03-api-endpoints.md)
**Purpose**: Comprehensive guide to all API endpoints and their usage.

**Key Information**:
- Public API endpoints (`/api/articles`, `/api/topics`)
- Admin API endpoints (`/api/admin/*`)
- Cron job endpoints (`/api/cron/*`)
- Request/response formats
- Authentication requirements

**When to Use**: When creating new API endpoints, modifying existing ones, or integrating with the API.

#### 5. [Development Workflow](./05-development-workflow.md)
**Purpose**: Step-by-step guide for development, testing, and deployment.

**Key Information**:
- Environment setup
- Development scripts
- Testing strategies
- Deployment procedures
- Monitoring and debugging

**When to Use**: When setting up the development environment, deploying changes, or troubleshooting issues.

### Article Enhancement Documentation

#### 6. [News Feed Masonry Implementation](./08-news-feed-masonry.md)
**Purpose**: Complete guide to the responsive waterfall masonry layout for news articles.

**Key Information**:
- Three-tier masonry approach
- Responsive breakpoints and spacing
- Infinite scroll implementation
- Performance optimizations

**When to Use**: When working with the news feed layout or implementing similar UI patterns.

#### 7. [Trilingual AI Enhancement System](./09-trilingual-ai-enhancement.md)
**Purpose**: Comprehensive guide to the trilingual article enhancement system.

**Key Information**:
- AI-powered article selection using Perplexity
- Trilingual processing (EN, zh-TW, zh-CN)
- Anti-hallucination safeguards
- Cost optimization strategies
- Processing pipeline details

**When to Use**: When working with AI enhancement features or implementing multilingual content.

#### 8. [Admin Interface Improvements](./10-admin-interface-improvements.md)
**Purpose**: Complete guide to the admin article management system.

**Key Information**:
- Article selection interface
- Batch operations (delete, enhance)
- AI enhancement workflow integration
- Modern UI implementation

**When to Use**: When working with admin features or implementing content management workflows.

#### 9. [AI Enhanced Article Improvements](./11-ai-enhanced-article-improvements.md)
**Purpose**: Details on AI article enhancement features and quality improvements.

**Key Information**:
- Enhancement algorithms
- Quality scoring systems
- Performance metrics
- Cost tracking

**When to Use**: When optimizing AI enhancement or implementing quality controls.

#### 10. [Source Icon System](./20-source-icon-system.md)
**Purpose**: Visual recognition system for news sources.

**Key Information**:
- Source favicon mapping
- Icon component implementation
- Fallback strategies
- Asset management

**When to Use**: When working with source attribution or implementing visual indicators.

#### 11. [Streamlined Article Pipeline Update](./25-streamlined-article-pipeline-update.md)
**Purpose**: Documentation of the major pipeline optimization update.

**Key Information**:
- Migration from bulk to focused processing
- Topic deduplication implementation
- Cost reduction strategies (68% savings)
- Legacy component removal

**When to Use**: When understanding current pipeline architecture or migrating legacy features.

## Quick Reference

### Key File Locations

```
📁 Core Article Pipeline Files
├── app/
│   ├── (public)/                # Public pages
│   ├── admin/articles/          # Article admin interface
│   └── api/
│       ├── articles/            # Article API endpoints
│       ├── admin/articles/      # Admin article endpoints
│       └── cron/                # Automated pipeline jobs
├── components/
│   ├── article-*.tsx            # Article components
│   └── admin/article-*.tsx      # Admin article components
├── lib/
│   ├── perplexity-article-selector.ts      # AI selection
│   ├── perplexity-trilingual-enhancer.ts   # Enhancement
│   ├── article-saver.ts                    # Storage logic
│   └── scrapers/                           # News scrapers
└── docs/                                   # Documentation
```

### Common Commands

```bash
# Development
npm run dev                      # Start development server
npm run build                    # Build for production

# Testing Article Pipeline
curl http://localhost:3000/api/articles              # Get articles
curl -X POST /api/admin/articles/select-article      # AI select
curl -X POST /api/admin/articles/enhance-selected    # Enhance

# Database
node scripts/setup-database.js   # Initialize database
```

### Environment Variables

```bash
# Required for article pipeline
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PERPLEXITY_API_KEY=your-perplexity-api-key
```

## Important Implementation Notes

### 1. Article Processing Pipeline
- **Scraping**: Every 15 minutes from 6 sources
- **Selection**: AI selects 1 article per cycle
- **Enhancement**: Creates 3 language versions
- **Deduplication**: Title and content similarity checks

### 2. AI Anti-Hallucination Measures
- Minimum content length (100 chars)
- Restricted prompts (no external knowledge)
- Extended previews (400 chars)
- Content validation

### 3. Cron Job Schedule (HKT)
- **Scraping**: Every 15 minutes, 6 AM - 1 AM
- **Selection**: Every 15 minutes, 6 AM - 1 AM  
- **Enhancement**: 5 minutes after each quarter hour

### 4. Cost Management
- Average: $0.075 per enhanced article
- Daily budget: ~$5-10
- 68% cost reduction from pipeline optimization

## Best Practices

### Code Modifications
- Read relevant documentation first
- Follow existing patterns
- Update TypeScript types
- Test locally before deployment

### Database Operations
- Use migrations for schema changes
- Maintain backward compatibility
- Update TypeScript interfaces

### API Development
- Follow RESTful conventions
- Implement proper error handling
- Use consistent response formats
- Include debug information

This documentation provides a comprehensive foundation for understanding and working with the HKI News App article pipeline system.