# HKI News App - Development Workflow

## Overview

This document provides comprehensive guidance for developing, testing, and deploying the HKI News App. It covers the entire development lifecycle from initial setup to production deployment.

## Development Environment Setup

### Prerequisites

- **Node.js**: Version 18+ 
- **npm**: Version 9+
- **Git**: Version control
- **Supabase CLI**: For database management (optional)
- **Chrome/Chromium**: Required for car scraping in development

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd panora830
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file with required environment variables:
   ```bash
   # Database Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # AI Services
   PERPLEXITY_API_KEY=your-perplexity-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   
   # Development
   NODE_ENV=development
   ```

4. **Database Setup**
   Run the database setup script:
   ```bash
   npm run setup-db
   # or manually
   node scripts/setup-database.js
   ```

### Development Scripts

The project includes several npm scripts for development:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "setup-db": "node scripts/setup-database.js",
    "migrate": "node scripts/run-migrations.js",
    "test-api": "node test-api.js"
  }
}
```

## Development Workflow

### 1. Starting Development

```bash
# Start the development server
npm run dev

# The application will be available at http://localhost:3000
```

### 2. Database Management

#### Database Status Check
```bash
# Check database connection and schema
curl http://localhost:3000/api/debug/database

# Check specific table status
curl http://localhost:3000/api/admin/database/status
```

#### Running Migrations
```bash
# Run all migrations
./run-migrations.sh

# Or run specific migration scripts
psql $DATABASE_URL -f scripts/add-perplexity-news-table.sql
```

#### Database Statistics
```bash
# Get database statistics
curl http://localhost:3000/api/admin/database/stats
```

### 3. Content Management

#### Manual Content Scraping
```bash
# Scrape all news sources
curl -X POST http://localhost:3000/api/manual-scrape

# Scrape specific outlet
curl -X POST http://localhost:3000/api/scrape/hkfp
curl -X POST http://localhost:3000/api/scrape/singtao
```

#### AI Content Generation
```bash
# Trigger Perplexity news generation
curl http://localhost:3000/api/cron/fetch-perplexity-news

# Enrich existing articles
curl http://localhost:3000/api/cron/enrich-perplexity-news

# Enrich car listings with AI
curl http://localhost:3000/api/cron/enrich-cars
```

#### Car Management Testing
```bash
# Test car statistics API
curl http://localhost:3000/api/admin/cars/stats

# Test manual car enrichment
curl -X POST http://localhost:3000/api/admin/cars/enrich \
  -H "Content-Type: application/json" \
  -d '{"enrichAll": true}'

# Test single car enrichment
curl -X POST http://localhost:3000/api/admin/cars/enrich \
  -H "Content-Type: application/json" \
  -d '{"carId": "your-car-id"}'

# Check enrichment status
curl http://localhost:3000/api/admin/cars/enrich

# Test manual car scraping
curl -X POST http://localhost:3000/api/cron/scrape-cars

# Test car scraper via admin trigger endpoint
curl -X POST http://localhost:3000/api/admin/trigger-scraper \
  -H "Content-Type: application/json" \
  -d '{"type": "cars"}'
```

### 4. Testing API Endpoints

#### Test Script Usage
```bash
# Test all API endpoints
node test-api.js

# Test specific functionality
node test-perplexity-api.js
node test-enhancement.js
```

#### Manual API Testing
```bash
# Test articles endpoint
curl "http://localhost:3000/api/articles?page=0"

# Test search
curl "http://localhost:3000/api/search?q=artificial+intelligence"

# Test headlines
curl "http://localhost:3000/api/headlines?category=Politics"

# Test car listings with enrichment filter
curl "http://localhost:3000/api/articles?category=cars&enriched=true"

# Test car price parsing validation
curl "http://localhost:3000/api/articles?category=cars" | grep -o "HK\$[0-9,]*"
```

## Code Organization

### Project Structure
```
panora830/
├── app/                    # Next.js App Router
│   ├── (public)/          # Public pages
│   ├── admin/             # Admin interface
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── admin/            # Admin components
│   └── *.tsx             # Feature components
├── lib/                   # Utilities and services
│   ├── types/            # TypeScript types
│   ├── scrapers/         # News scrapers
│   └── *.ts              # Service modules
├── hooks/                 # Custom React hooks
├── scripts/              # Database and utility scripts
├── docs/                 # Documentation
└── public/               # Static assets
```

### Component Development

#### Creating New Components
1. **Create component file**
   ```typescript
   // components/new-component.tsx
   interface NewComponentProps {
     title: string;
     description?: string;
   }
   
   export function NewComponent({ title, description }: NewComponentProps) {
     return (
       <div className="p-4">
         <h2 className="text-xl font-bold">{title}</h2>
         {description && <p className="text-gray-600">{description}</p>}
       </div>
     );
   }
   ```

2. **Add to index exports** (if using index files)
   ```typescript
   export { NewComponent } from './new-component';
   ```

3. **Use in pages or other components**
   ```typescript
   import { NewComponent } from '@/components/new-component';
   ```

#### UI Component Usage
```typescript
// Using Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Component</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="outline">Click me</Button>
      </CardContent>
    </Card>
  );
}
```

### API Route Development

#### Creating New API Routes
1. **Create route file**
   ```typescript
   // app/api/my-endpoint/route.ts
   import { NextRequest, NextResponse } from 'next/server';
   
   export async function GET(request: NextRequest) {
     try {
       const searchParams = request.nextUrl.searchParams;
       const param = searchParams.get('param');
       
       // Your logic here
       const data = await fetchData(param);
       
       return NextResponse.json({ data });
     } catch (error) {
       return NextResponse.json(
         { error: 'Internal server error' },
         { status: 500 }
       );
     }
   }
   
   export async function POST(request: NextRequest) {
     try {
       const body = await request.json();
       
       // Your logic here
       const result = await processData(body);
       
       return NextResponse.json({ result });
     } catch (error) {
       return NextResponse.json(
         { error: 'Bad request' },
         { status: 400 }
       );
     }
   }
   ```

2. **Add error handling**
   ```typescript
   // lib/api-utils.ts
   export function handleApiError(error: unknown) {
     if (error instanceof Error) {
       return NextResponse.json(
         { error: error.message },
         { status: 500 }
       );
     }
     return NextResponse.json(
       { error: 'Unknown error' },
       { status: 500 }
     );
   }
   ```

## Database Development

### Schema Changes

#### Adding New Tables
1. **Create migration script**
   ```sql
   -- scripts/add-new-table.sql
   CREATE TABLE IF NOT EXISTS new_table (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Add indexes
   CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);
   ```

2. **Test migration**
   ```bash
   psql $DATABASE_URL -f scripts/add-new-table.sql
   ```

3. **Add to migration runner**
   ```javascript
   // scripts/run-migrations.js
   const migrations = [
     'add-new-table.sql',
     // ... other migrations
   ];
   ```

#### Updating TypeScript Types
```typescript
// lib/types.ts
export interface NewTableRecord {
  id: string;
  name: string;
  created_at: string;
}
```

### Data Seeding

#### Creating Seed Data
```javascript
// scripts/seed-data.js
const { createClient } = require('@supabase/supabase-js');

async function seedData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data, error } = await supabase
    .from('new_table')
    .insert([
      { name: 'Sample 1' },
      { name: 'Sample 2' }
    ]);
  
  if (error) {
    console.error('Seed error:', error);
  } else {
    console.log('Seed successful:', data);
  }
}

seedData();
```

## Testing

### Manual Testing

#### API Testing
```bash
# Test article creation
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "content": "Test content",
    "url": "https://example.com/test"
  }'
```

#### Frontend Testing
1. **Test different screen sizes**
   - Desktop: 1920x1080
   - Tablet: 768x1024
   - Mobile: 375x667

2. **Test different themes**
   - Light mode
   - Dark mode
   - System preference

3. **Test accessibility**
   - Keyboard navigation
   - Screen reader compatibility
   - Color contrast

### Automated Testing

#### Component Tests
```typescript
// __tests__/components/article-card.test.tsx
import { render, screen } from '@testing-library/react';
import { ArticleCard } from '@/components/article-card';

describe('ArticleCard', () => {
  it('renders article information', () => {
    const article = {
      id: '1',
      title: 'Test Article',
      summary: 'Test summary',
      // ... other props
    };
    
    render(<ArticleCard article={article} />);
    
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });
});
```

#### API Route Tests
```typescript
// __tests__/api/articles.test.ts
import { GET } from '@/app/api/articles/route';
import { NextRequest } from 'next/server';

describe('/api/articles', () => {
  it('returns articles list', async () => {
    const request = new NextRequest('http://localhost:3000/api/articles');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.articles).toBeInstanceOf(Array);
  });
});
```

## Deployment

### Vercel Deployment

#### Configuration
The project includes a `vercel.json` configuration:
```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-news",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/scrape-cars",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/enrich-cars",
      "schedule": "0 */2 * * *"
    },
    {
      "path": "/api/cron/collect-headlines",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/fetch-perplexity-news",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/enrich-unified-articles",
      "schedule": "5 * * * *"
    }
  ]
}
```

**Cron Schedule Summary**:
- **News Scraping**: Every 30 minutes (all news sources)
- **Car Scraping**: Every 15 minutes (28car.com listings with browser automation)
- **Car Enrichment**: Every 2 hours (AI-powered with Perplexity API, 5 cars per run)
- **Headlines Collection**: Daily at 8:00 AM
- **Perplexity News**: Every hour
- **Article Enrichment**: Every hour at 5 minutes past

#### Deployment Steps
1. **Connect to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add PERPLEXITY_API_KEY
   ```

3. **Deploy**
   ```bash
   vercel deploy
   # or for production
   vercel --prod
   ```

### Database Migration in Production

#### Pre-deployment Checklist
1. **Backup database**
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Test migrations locally**
   ```bash
   ./run-migrations.sh
   ```

3. **Run migrations in production**
   ```bash
   # Set production DATABASE_URL
   export DATABASE_URL="production-connection-string"
   ./run-migrations.sh
   ```

## Monitoring and Debugging

### Performance Monitoring

#### Vercel Analytics
The app includes Vercel Analytics for performance monitoring:
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Error Tracking

#### Client-side Error Tracking
```typescript
// lib/error-tracking.ts
export function trackError(error: Error, context?: Record<string, any>) {
  console.error('Error:', error, context);
  
  // Send to error tracking service
  // e.g., Sentry, LogRocket, etc.
}
```

#### API Error Logging
```typescript
// lib/api-logger.ts
export function logApiError(endpoint: string, error: Error) {
  console.error(`API Error [${endpoint}]:`, error);
  
  // Log to monitoring service
  // e.g., DataDog, CloudWatch, etc.
}
```

## Best Practices

### Code Quality

#### TypeScript Usage
- Use strict TypeScript configuration
- Define interfaces for all data structures
- Use type guards for runtime type checking
- Prefer `interface` over `type` for object shapes

#### Component Design
- Keep components small and focused
- Use composition over inheritance
- Implement proper error boundaries
- Use React.memo for performance optimization

#### API Design
- Use consistent naming conventions
- Implement proper error handling
- Use HTTP status codes correctly
- Provide meaningful error messages

### Performance Optimization

#### Frontend
- Use Next.js Image component for image optimization
- Implement lazy loading for heavy components
- Use React Query for efficient data fetching
- Minimize bundle size with dynamic imports

#### Backend
- Use database indexes for frequently queried columns
- Implement caching strategies
- Use connection pooling
- Monitor and optimize slow queries

### Security

#### Environment Variables
- Never commit sensitive data to version control
- Use different keys for development and production
- Rotate API keys regularly
- Use least privilege principle

#### Database Security
- Use Row Level Security (RLS) in Supabase
- Validate all user inputs
- Use parameterized queries
- Implement rate limiting

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connection
curl http://localhost:3000/api/debug/database

# Test direct connection
psql $DATABASE_URL -c "SELECT NOW();"
```

#### API Errors
```bash
# Check API logs
vercel logs

# Test API endpoints
curl -v http://localhost:3000/api/articles
```

#### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Car Image Quality Issues
```bash
# Check if high-resolution images are being extracted
curl http://localhost:3000/api/cron/scrape-cars -X POST

# Look for these indicators in logs:
# ✅ Success: "📸 Upgraded to BIG quality: filename_b.jpg (50KB)"
# ✅ Success: "(+5 photos: 5B)" = 5 Big images extracted
# ❌ Issue: "(+5 photos: 5M)" = Only medium quality extracted

# Test specific car image URLs manually
curl -I "https://djlfajk23a.28car.com/data/image/sell/.../car_id_b.jpg"
# Should return 200 OK for high-res images

# Check scraper browser configuration
# Development: Should use local Chrome
# Production: Should use @sparticuz/chromium
```

#### Troubleshooting Image Extraction
```bash
# If high-res extraction is failing:

# 1. Check browser dependencies
npm list puppeteer @sparticuz/chromium

# 2. Test modal gallery interaction
# Look for this warning in logs:
# "⚠️ Could not trigger modal gallery: [reason]"

# 3. Verify URL pattern recognition
# High-res URLs should follow this pattern:
# https://djlfajk23a.28car.com/data/image/sell/XXXX/XXXX/hash/id_b.jpg

# 4. Check network connectivity to 28car.com
curl -I "http://m.28car.com/sell_lst.php"

# 5. Monitor scraper performance
# Should see: "🎉 High-res success: X/Y images are high-resolution (Z%)"
```

#### Browser Automation Issues

##### Playwright vs Puppeteer Migration
The project migrated from Playwright to Puppeteer + @sparticuz/chromium for serverless compatibility:

**Development Environment:**
- Uses regular Puppeteer with local Chrome/Chromium
- Requires Chrome/Chromium to be installed locally
- Browser automation works with full browser features

**Production Environment (Vercel):**
- Uses @sparticuz/chromium for serverless compatibility
- Automatically detects production environment
- Falls back gracefully if dependencies are missing

##### Common Browser Automation Errors

**Error: "browserType.launch: Executable doesn't exist"**
```bash
# Check if running in serverless environment
# This error indicates Playwright binaries are missing in production

# Solution: Code automatically uses @sparticuz/chromium in production
# Verify dependencies are installed:
npm install @sparticuz/chromium puppeteer puppeteer-core
```

**Error: "Cannot statically analyse 'require'"**
```bash
# Webpack static analysis issue with dynamic imports
# Solution: Use conditional imports based on environment
# Code now uses environment detection to avoid this issue
```

**Development Browser Issues:**
```bash
# Install Chrome/Chromium locally
# macOS:
brew install chromium

# Ubuntu/Debian:
sudo apt-get install chromium-browser

# Test local browser availability
puppeteer browsers install chrome
```

**Production Deployment Issues:**
```bash
# Check Vercel deployment logs
vercel logs

# Test serverless browser functionality
curl -X POST https://your-app.vercel.app/api/cron/scrape-cars

# Verify @sparticuz/chromium is included in deployment
# Check package.json dependencies section
```

##### Browser Configuration Testing
```bash
# Test development browser setup
curl -X POST http://localhost:3000/api/cron/scrape-cars

# Check browser logs in development
# Look for: "🚀 Using local Chrome for development"

# Test production browser setup (after deployment)
# Look for: "@sparticuz/chromium loaded successfully"
```

##### Memory and Performance Issues
```bash
# Monitor memory usage during scraping
# Car scraper processes 40+ listings with image downloads

# Optimize browser settings for serverless:
# - Reduced viewport size
# - Disabled images (optional)
# - Mobile user agent for faster loading
```

This comprehensive development workflow guide provides the foundation for efficient development, testing, and deployment of the HKI News App. Following these practices ensures code quality, performance, and maintainability.