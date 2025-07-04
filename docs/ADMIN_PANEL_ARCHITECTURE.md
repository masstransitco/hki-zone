# Admin Panel Architecture

## Overview

The Panora.hk admin panel is a comprehensive, responsive web interface built with Next.js and React that provides complete control over the news scraping system. It features a modern sidebar navigation, real-time monitoring, article review capabilities, and mobile-optimized user experience.

## Architecture Layers

### 1. Layout Structure

```
/app/admin/
├── layout.tsx                 # Root admin layout with sidebar
├── page.tsx                   # Dashboard (scraping controls)
├── articles/
│   ├── page.tsx              # Article review interface
│   └── [id]/page.tsx         # Individual article detail (future)
├── database/
│   └── page.tsx              # Database management
└── settings/
    └── page.tsx              # Admin configuration
```

### 2. Component Architecture

#### Core Layout Components
- **AdminSidebar** (`/components/admin/admin-sidebar.tsx`)
  - Responsive navigation with mobile sheet overlay
  - Active state management with Next.js router
  - Icon-based collapsed mode with tooltips
  - Keyboard shortcut support (Cmd/Ctrl+B)

- **AdminHeader** (`/components/admin/admin-header.tsx`)
  - Breadcrumb navigation with dynamic path generation
  - Mobile sidebar trigger
  - Consistent header styling across all pages

#### Feature Components
- **ArticleReviewGrid** (`/components/admin/article-review-grid.tsx`)
  - Virtualized article list with infinite scroll
  - Quality indicators for content completeness
  - Mobile-optimized card layout
  - Selection state management

- **ArticleDetailPanel** (`/components/admin/article-detail-panel.tsx`)
  - Comprehensive article metadata display
  - Content and AI summary comparison
  - Image preview with fallback handling
  - Admin actions (edit, delete, re-scrape)

## Navigation Structure

### Primary Navigation Items

1. **Dashboard** (`/admin`)
   - Main scraping controls interface
   - Real-time progress monitoring
   - System status overview

2. **Article Review** (`/admin/articles`)
   - Browse all scraped articles
   - Advanced filtering and search
   - Quality control and content review

3. **Database** (`/admin/database`)
   - Database setup and initialization
   - Statistics and metrics
   - Maintenance operations

4. **Settings** (`/admin/settings`)
   - System configuration
   - Scraping parameters
   - API key management

## Responsive Design Strategy

### Mobile-First Approach

- **Breakpoint Strategy**: Uses Tailwind CSS breakpoints (sm: 640px, md: 768px, lg: 1024px)
- **Navigation**: Sheet overlay on mobile, collapsible sidebar on desktop
- **Content Layout**: Stacked cards on mobile, grid layouts on larger screens
- **Touch Optimization**: Larger tap targets, swipe-friendly interactions

### Desktop Optimizations

- **Sidebar Behavior**: Persistent sidebar with collapse/expand functionality
- **Split Panel Layout**: Article list + detail panel side-by-side
- **Keyboard Navigation**: Full keyboard shortcut support
- **Context Menus**: Right-click actions where appropriate

## Data Flow Architecture

### API Integration

```typescript
// Admin-specific API endpoints
/api/admin/articles          # Enhanced article fetching with filters
/api/admin/database/stats    # Database statistics and metrics
/api/scrape/progress         # Real-time scraping progress (SSE)
/api/scrape/[outlet]         # Individual outlet scraping
```

### State Management

- **Local State**: React hooks for component-specific state
- **URL State**: Search params for filters, pagination
- **Real-time Updates**: Server-Sent Events for live progress
- **Cache Strategy**: React Query for server state management

### Data Transformation Pipeline

```typescript
// Raw database article → Frontend article interface
{
  id: string
  title: string
  summary: string (ai_summary || summary)
  content: string
  url: string
  source: string
  author?: string
  publishedAt: string (published_at || created_at)
  imageUrl: string (image_url || placeholder)
  category: string
  readTime: number (calculated)
}
```

## Feature Specifications

### Article Review System

#### Filtering Capabilities
- **Source Filter**: HKFP, SingTao, HK01, ONCC, RTHK
- **Category Filter**: Politics, Local, News, General
- **Search**: Full-text search across title, summary, content
- **Date Range**: Filter by publication date
- **Quality Filter**: Content completeness, image availability

#### Quality Indicators
- **Content Length**: Visual indicator (>200 chars = good)
- **Image Availability**: Presence of valid article image
- **Summary Quality**: AI summary vs original summary
- **Metadata Completeness**: Author, date, category fields

### Real-time Monitoring

#### Progress Tracking
- **Overall Progress**: Aggregated progress across all outlets
- **Individual Outlet Status**: Per-source scraping progress
- **Live Updates**: Server-Sent Events for real-time data
- **Error Handling**: Graceful degradation and retry logic

#### Performance Metrics
- **Articles Per Source**: Distribution of content by outlet
- **Success Rates**: Scraping success/failure statistics
- **Quality Metrics**: Content and image extraction rates
- **Time-based Analytics**: Scraping duration and frequency

## Security Considerations

### Access Control
- **Admin Routes**: Protected behind authentication middleware
- **API Security**: Server-side validation and authorization
- **CSRF Protection**: Built-in Next.js CSRF protection
- **Environment Variables**: Secure API key management

### Data Protection
- **Input Sanitization**: All user inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Protection**: React's built-in XSS prevention
- **Content Security Policy**: Strict CSP headers

## Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Automatic route-based splitting
- **Lazy Loading**: Dynamic imports for heavy components
- **Image Optimization**: Next.js Image component with WebP
- **Bundle Analysis**: Webpack bundle analyzer integration

### Backend Optimizations
- **Database Indexing**: Optimized indexes for common queries
- **Query Optimization**: Efficient pagination and filtering
- **Caching Strategy**: Edge caching for static assets
- **Compression**: Gzip compression for API responses

## Accessibility Features

### WCAG Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and landmarks
- **Color Contrast**: WCAG AA compliant color ratios
- **Focus Management**: Visible focus indicators

### Internationalization
- **Language Support**: English and Chinese language support
- **RTL Support**: Right-to-left language compatibility
- **Locale-aware Formatting**: Date, time, number formatting
- **Dynamic Translation**: Runtime language switching

## Development Workflow

### Component Development
```typescript
// Component structure pattern
export default function AdminComponent() {
  // 1. State and hooks
  const [state, setState] = useState()
  
  // 2. Effects and data fetching
  useEffect(() => {}, [])
  
  // 3. Event handlers
  const handleAction = () => {}
  
  // 4. Render with responsive design
  return (
    <div className="responsive-layout">
      {/* Mobile layout */}
      <div className="lg:hidden">Mobile content</div>
      {/* Desktop layout */}
      <div className="hidden lg:block">Desktop content</div>
    </div>
  )
}
```

### Testing Strategy
- **Unit Tests**: Component logic and utility functions
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Critical user workflows
- **Visual Regression**: Screenshot-based UI testing

## Deployment Architecture

### Build Process
- **Next.js Production Build**: Optimized static generation
- **Asset Optimization**: Image, CSS, JS minification
- **Environment Configuration**: Multi-environment support
- **Health Checks**: Built-in monitoring endpoints

### Monitoring and Logging
- **Error Tracking**: Sentry integration for error monitoring
- **Performance Monitoring**: Core Web Vitals tracking
- **User Analytics**: Privacy-compliant usage analytics
- **System Metrics**: Server performance and availability

## Future Enhancements

### Planned Features
- **Bulk Operations**: Multi-select article management
- **Export Functionality**: CSV/JSON data export
- **Advanced Analytics**: Trend analysis and reporting
- **User Management**: Multi-user admin access

### Scalability Considerations
- **Horizontal Scaling**: Stateless component architecture
- **Database Scaling**: Read replicas and connection pooling
- **CDN Integration**: Global content delivery
- **Microservices**: Service decomposition strategy