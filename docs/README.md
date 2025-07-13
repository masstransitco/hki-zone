# HKI News App - AI Agent Documentation

## Overview

This is a comprehensive documentation suite for the HKI News App (香港資訊), an AI-enhanced news aggregation platform focused on Hong Kong news sources. This documentation is specifically optimized for AI agent processing and manipulation of the codebase.

## Quick Start for AI Agents

### Understanding the Application
The HKI News App is a Next.js 14 application that:
- Aggregates news from major Hong Kong sources (HKFP, SingTao, HK01, ONCC, RTHK)
- Enhances content using AI (Perplexity API, Anthropic Claude)
- Provides both public and admin interfaces
- Uses Supabase for data persistence
- Implements a unified content management system

### Key Technologies
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase PostgreSQL
- **AI Services**: Perplexity API, Anthropic Claude
- **UI Components**: Shadcn/ui (Radix UI)
- **State Management**: React Query, React Context
- **Deployment**: Vercel with cron jobs

## Documentation Structure

### 1. [Architecture Overview](./01-architecture-overview.md)
**Purpose**: Understand the overall system architecture and design decisions.

**Key Information**:
- System architecture diagram
- Core architectural decisions
- Technology stack rationale
- Integration patterns
- Performance considerations

**When to Use**: Before making any significant architectural changes or when you need to understand how components interact.

### 2. [Data Models & Database Schema](./02-data-models.md)
**Purpose**: Understand the data structures and database design.

**Key Information**:
- Database schema for all tables
- TypeScript interfaces and types
- Data relationships and constraints
- Migration strategies
- Status tracking and processing pipelines

**When to Use**: When working with database operations, creating new data types, or modifying existing schemas.

### 3. [API Endpoints](./03-api-endpoints.md)
**Purpose**: Comprehensive guide to all API endpoints and their usage.

**Key Information**:
- Public API endpoints (`/api/articles`, `/api/headlines`, etc.)
- Admin API endpoints (`/api/admin/*`)
- Cron job endpoints (`/api/cron/*`)
- Request/response formats
- Authentication requirements
- Error handling patterns

**When to Use**: When creating new API endpoints, modifying existing ones, or integrating with the API.

### 4. [Frontend Architecture](./04-frontend-architecture.md)
**Purpose**: Understand the React component architecture and patterns.

**Key Information**:
- Component organization and hierarchy
- State management patterns
- Data fetching strategies
- Routing structure
- Performance optimizations
- Accessibility features

**When to Use**: When working with React components, implementing new features, or optimizing the frontend.

### 5. [Development Workflow](./05-development-workflow.md)
**Purpose**: Step-by-step guide for development, testing, and deployment.

**Key Information**:
- Environment setup
- Development scripts
- Testing strategies
- Deployment procedures
- Monitoring and debugging
- Best practices

**When to Use**: When setting up the development environment, deploying changes, or troubleshooting issues.

## Quick Reference

### Key File Locations

```
📁 Core Application Files
├── app/                          # Next.js App Router pages and API routes
│   ├── (public)/                # Public pages (home, headlines, search)
│   ├── admin/                   # Admin interface
│   └── api/                     # API endpoints
├── components/                   # React components
│   ├── ui/                      # Shadcn/ui components
│   └── admin/                   # Admin-specific components
├── lib/                         # Utilities and services
│   ├── types.ts                 # Main TypeScript interfaces
│   ├── types/unified.ts         # Unified content system types
│   └── scrapers/                # News scraping modules
└── scripts/                     # Database migrations and utilities

📁 Key Configuration Files
├── package.json                 # Dependencies and scripts
├── next.config.mjs             # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── vercel.json                 # Deployment and cron configuration
```

### Common Development Tasks

#### 1. Adding a New API Endpoint
```typescript
// 1. Create route file: app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Your implementation
  return NextResponse.json({ data: 'response' });
}
```

#### 2. Creating a New Component
```typescript
// 1. Create component file: components/your-component.tsx
interface YourComponentProps {
  title: string;
}

export function YourComponent({ title }: YourComponentProps) {
  return <div>{title}</div>;
}
```

#### 3. Adding Database Schema Changes
```sql
-- 1. Create migration file: scripts/add-your-table.sql
CREATE TABLE IF NOT EXISTS your_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Updating TypeScript Types
```typescript
// lib/types.ts or lib/types/unified.ts
export interface YourNewType {
  id: string;
  name: string;
  created_at: string;
}
```

### Environment Variables

```bash
# Required for development
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional for AI features
PERPLEXITY_API_KEY=your-perplexity-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### Common Commands

```bash
# Development
npm run dev                      # Start development server
npm run build                    # Build for production
npm run lint                     # Run linting

# Database
node scripts/setup-database.js   # Initialize database
./run-migrations.sh             # Run all migrations
curl /api/debug/database        # Check database status

# Testing
node test-api.js                # Test API endpoints
curl -X POST /api/manual-scrape # Manual content scraping
```

## AI Agent Integration Patterns

### 1. Content Processing Pipeline
```
Raw Content → Scraping → AI Enhancement → Database Storage → API Serving
```

### 2. Status Tracking
```
pending → processing → ready → published
```

### 3. Error Handling
```
Try Database → Fallback to Mock Data → Return with Debug Info
```

### 4. Data Fetching Pattern
```typescript
// Standard React Query pattern used throughout the app
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', params],
  queryFn: () => fetchResource(params),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

## Important Implementation Notes

### 1. AI Enhancement Process
- Articles can be enhanced with contextual information using Perplexity API
- Enhancement process tracks costs and sources
- Status progression: `pending` → `enriched` → `ready`

### 2. Database Architecture
- Unified table design consolidates different content types
- Legacy tables maintained for backward compatibility
- Row Level Security (RLS) implemented for access control

### 3. Content Sources
- **HKFP**: Hong Kong Free Press (English)
- **SingTao**: 星島日報 (Chinese)
- **HK01**: 香港01 (Chinese)
- **ONCC**: 東網 (Chinese)
- **RTHK**: 香港電台 (Bilingual)
- **28car**: Car listings with high-resolution image extraction

### 4. Cron Job Schedule
- News scraping: Every 30 minutes
- **Car scraping: Every 15 minutes** (with high-res image extraction)
- Headlines collection: Daily at 8 AM
- Perplexity news: Every hour
- Article enrichment: Every hour at 5 minutes past
- Car AI enrichment: Every 2 hours

### 5. Performance Optimizations
- Infinite scroll for large datasets
- **Advanced image optimization**: Multi-tier resolution extraction with 8-10x quality improvement
- React Query for caching and state management
- Database indexing for fast queries

### 6. **28car High-Resolution Image System** ⭐ *New Feature*
- **Multi-layered extraction**: Modal gallery simulation + Direct URL testing
- **Quality prioritization**: `_b.jpg` (30-70KB) > `_m.jpg` (6-7KB) > `_s.jpg` (2-3KB)
- **Performance**: Up to 8 photos per car with 8-10x better quality
- **Success rate**: 100% high-resolution extraction achieved
- **Automatic fallbacks**: Ensures compatibility if high-res unavailable

## Troubleshooting Guide

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check database status
curl http://localhost:3000/api/debug/database

# Test direct connection
psql $DATABASE_URL -c "SELECT NOW();"
```

#### API Errors
```bash
# Check API logs
vercel logs

# Test endpoints manually
curl -v http://localhost:3000/api/articles
```

#### Build Errors
```bash
# Clear Next.js cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
```

## Best Practices for AI Agents

### 1. Code Modifications
- Always read the relevant documentation section before making changes
- Follow existing patterns and conventions
- Test changes locally before deployment
- Update TypeScript types when modifying data structures

### 2. Database Operations
- Use migrations for schema changes
- Test migrations locally first
- Maintain backward compatibility
- Update relevant TypeScript interfaces

### 3. API Development
- Follow RESTful conventions
- Implement proper error handling
- Use consistent response formats
- Include debug information for troubleshooting

### 4. Frontend Development
- Use existing UI components from `components/ui/`
- Follow accessibility guidelines
- Implement responsive design
- Use React Query for data fetching

### 5. Testing and Deployment
- Test API endpoints manually
- Check database connectivity
- Verify environment variables
- Monitor application performance

## Contributing Guidelines

### Before Making Changes
1. Read the relevant documentation section
2. Understand the existing architecture
3. Check for similar implementations
4. Test your changes locally

### Code Quality
- Use TypeScript for type safety
- Follow existing naming conventions
- Implement proper error handling
- Write clear, self-documenting code

### Documentation Updates
- Update documentation when making architectural changes
- Add new sections for new features
- Keep examples up to date
- Maintain consistency across documents

This documentation provides a comprehensive foundation for AI agents to effectively understand, work with, and extend the HKI News App codebase. Each section builds upon the others to provide a complete picture of the application architecture and development patterns.