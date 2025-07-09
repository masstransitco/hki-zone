# Perplexity Admin Architecture

## Overview

The Perplexity Admin system is a comprehensive web interface for managing AI-generated news articles from Perplexity. Built as part of the Panora.hk admin panel, it provides complete control over the perplexity news generation pipeline with features for viewing, editing, bulk operations, and real-time monitoring.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Panel Layout                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐  │
│  │   Sidebar   │  │         Main Content Area               │  │
│  │             │  │                                         │  │
│  │ • Dashboard │  │  ┌─────────────────────────────────────┐ │  │
│  │ • Articles  │  │  │      Stats Dashboard                │ │  │
│  │ • Perplexity│  │  │  • Total Articles                   │ │  │
│  │ • Database  │  │  │  • Generation Costs                 │ │  │
│  │ • Settings  │  │  │  • Status Counts                    │ │  │
│  │             │  │  └─────────────────────────────────────┘ │  │
│  └─────────────┘  │                                         │  │
│                   │  ┌─────────────────────────────────────┐ │  │
│                   │  │      Enhanced Filters & Search      │ │  │
│                   │  │  • Category Filter                  │ │  │
│                   │  │  • Status Filter                    │ │  │
│                   │  │  • Article Count Selector           │ │  │
│                   │  │  • Text Search                      │ │  │
│                   │  └─────────────────────────────────────┘ │  │
│                   │                                         │  │
│                   │  ┌─────────────────────────────────────┐ │  │
│                   │  │      Bulk Operations                │ │  │
│                   │  │  • Selection Controls               │ │  │
│                   │  │  • Bulk Actions                     │ │  │
│                   │  └─────────────────────────────────────┘ │  │
│                   │                                         │  │
│                   │  ┌─────────────────┐ ┌─────────────────┐ │  │
│                   │  │ Article Grid    │ │ Article Detail  │ │  │
│                   │  │ (2/3 width)     │ │ (1/3 width)     │ │  │
│                   │  │                 │ │                 │ │  │
│                   │  │ • Article Cards │ │ • Full Content  │ │  │
│                   │  │ • Status Icons  │ │ • Edit Controls │ │  │
│                   │  │ • Bulk Select   │ │ • Metadata      │ │  │
│                   │  │ • Actions       │ │ • Citations     │ │  │
│                   │  └─────────────────┘ └─────────────────┘ │  │
│                   └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Navigation Integration

#### Admin Sidebar (`/components/admin/admin-sidebar.tsx`)
- **Integration**: Added "Perplexity News" navigation item
- **Icon**: Brain icon from Lucide React
- **URL**: `/admin/perplexity`
- **Description**: "Manage AI-generated news articles"
- **Active State**: Proper highlighting when on perplexity routes

### 2. Main Page Component

#### Perplexity Admin Page (`/app/admin/perplexity/page.tsx`)
- **Purpose**: Main orchestration component for perplexity management
- **State Management**: 
  - Article data loading and caching
  - Selection state for bulk operations
  - Filter state (category, status, search)
  - UI state (loading, selected article)

**Key Features**:
```typescript
interface PageState {
  articles: PerplexityArticle[]
  filteredArticles: PerplexityArticle[]
  selectedArticle: PerplexityArticle | null
  selectedArticles: string[]
  loading: boolean
  searchQuery: string
  categoryFilter: string
  statusFilter: string
  usingMockData: boolean
}
```

### 3. Article Grid Component

#### Perplexity Article Grid (`/components/admin/perplexity-article-grid.tsx`)
- **Purpose**: Display articles in a responsive grid layout
- **Selection**: Multi-select with checkboxes
- **Actions**: Per-article action buttons (View, Edit, Regenerate, Delete)
- **Status Indicators**: Visual status icons and badges
- **Responsive Design**: Adapts from 3 columns to 1 column on mobile

**Card Features**:
- Status icons (pending, enriched, ready, failed)
- Category badges with color coding
- Image previews when available
- Cost display
- Hover actions
- Selection state visual feedback

### 4. Article Detail Component

#### Perplexity Article Detail (`/components/admin/perplexity-article-detail.tsx`)
- **Purpose**: Comprehensive article viewing and editing
- **Modes**: View mode and inline edit mode
- **Content Display**: Full HTML rendering with proper styling
- **Metadata**: Complete article information display

**Detail Sections**:
- **Header**: Title, category, status badges
- **Summary**: Article lede/summary
- **Content**: Full HTML article content
- **Image**: Article image with status overlay
- **URL Management**: Copy and external link buttons
- **Citations**: AI-generated source citations
- **Metadata**: Model, costs, timestamps

**Edit Capabilities**:
- Inline title editing
- Category dropdown selection
- Content text area editing
- Save/cancel controls

### 5. Bulk Operations Component

#### Perplexity Bulk Operations (`/components/admin/perplexity-bulk-operations.tsx`)
- **Purpose**: Manage multiple articles simultaneously
- **Selection Summary**: Display selected counts by status/category
- **Safety Features**: Confirmation dialogs for destructive actions
- **Progress Indicators**: Loading states during operations

**Operations Available**:
- **Bulk Delete**: Remove multiple articles with confirmation
- **Bulk Regenerate**: Trigger content regeneration
- **Bulk Category Update**: Change category for selected articles
- **Bulk Export**: Export selected articles (future)

### 6. API Layer

#### Admin Perplexity API (`/app/api/admin/perplexity/route.ts`)
- **Purpose**: RESTful API for perplexity article management
- **Methods**: GET, POST, PUT, DELETE
- **Features**: Advanced filtering, pagination, bulk operations

**Enhanced API Endpoints**:
```typescript
GET /api/admin/perplexity
- Query params: category, status, search, page, limit
- Category: "all" | "politics" | "business" | "tech" | "health" | "lifestyle" | "entertainment"
- Status: "all" | "pending" | "enriched" | "ready"
- Limit: "20" | "50" | "100" | "200" | "all"
- Response: Paginated articles with metadata

POST /api/admin/perplexity
- Body: { action, articleIds, data }
- Actions: regenerate, delete, update
- Response: Operation result

PUT /api/admin/perplexity
- Body: { id, updates }
- Purpose: Update individual article
- Response: Updated article

DELETE /api/admin/perplexity?id=<id>
- Purpose: Delete individual article
- Response: Deletion confirmation
```

**Enhanced Database Functions**:
```typescript
// Admin version with configurable per-category limits
getPerplexityNewsByCategory(limitPerCategory: number = 10)

// Admin version with no per-category limits (shows all articles)
getPerplexityNewsByCategoryAdmin()
```

## Data Flow Architecture

### 1. Data Loading Flow
```
Page Load → API Call → Data Processing → State Update → UI Render
     ↓
/api/perplexity-news → Flatten categories → Filter/Sort → Display
```

### 2. Filtering Flow
```
User Input → State Update → Filter Function → UI Update
     ↓
Search/Category/Status → Update filteredArticles → Re-render Grid
```

### 3. Selection Flow
```
User Selection → State Update → Bulk Operations → UI Feedback
     ↓
Checkbox Change → Update selectedArticles → Show Bulk Panel
```

### 4. Bulk Operations Flow
```
User Action → Confirmation → API Call → State Update → UI Update
     ↓
Bulk Delete → Confirm Dialog → DELETE API → Remove from State → Refresh Grid
```

## Database Integration

### Perplexity News Table Structure
```sql
CREATE TABLE perplexity_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category VARCHAR NOT NULL,
  url TEXT UNIQUE NOT NULL,
  url_hash VARCHAR UNIQUE,
  
  -- Status Management
  article_status VARCHAR DEFAULT 'pending',
  image_status VARCHAR DEFAULT 'pending',
  
  -- Content
  article_html TEXT,
  lede TEXT, -- Legacy field for backward compatibility
  image_url TEXT,
  image_prompt TEXT,
  image_license TEXT,
  
  -- Enhanced structured content fields
  enhanced_title TEXT, -- Improved headline
  summary TEXT, -- Executive summary
  key_points TEXT[], -- Array of key points
  why_it_matters TEXT, -- Significance analysis
  structured_sources JSONB, -- Source citations in JSON format
  
  -- Metadata
  source VARCHAR DEFAULT 'Perplexity AI',
  author VARCHAR DEFAULT 'AI Generated',
  perplexity_model VARCHAR,
  generation_cost DECIMAL,
  search_queries TEXT[],
  citations TEXT[],
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Status Flow Management
```
Article Status: pending → enriched → ready
Image Status:  pending → ready/failed
```

## TypeScript Architecture

### Core Types

#### Enhanced PerplexityArticle Interface
```typescript
export interface PerplexityArticle {
  id: string
  title: string
  category: string
  url: string
  url_hash?: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
  article_html?: string
  lede?: string // Legacy field for backward compatibility
  image_url?: string
  image_prompt?: string
  image_license?: string
  
  // Enhanced structured content fields
  enhanced_title?: string
  summary?: string
  key_points?: string[]
  why_it_matters?: string
  structured_sources?: {
    citations: string[]
    sources: Array<{
      title: string
      url: string
      description?: string
      domain?: string
    }>
    generated_at: string
  }
  
  source: string
  author: string
  published_at: string
  inserted_at: string
  created_at: string
  updated_at: string
  perplexity_model?: string
  generation_cost?: number
  search_queries?: string[]
  citations?: string[]
}
```

#### API Response Types
```typescript
export interface PerplexityNewsResponse {
  news: {
    [category: string]: PerplexityArticle[]
  } | PerplexityArticle[]
  usingMockData: boolean
  debug: string
  error?: string
}
```

### Component Props Interfaces
Each component has strongly typed props interfaces ensuring type safety throughout the application.

## UI/UX Design Patterns

### 1. Status Visualization
- **Icons**: Different icons for each status (CheckCircle, Clock, AlertCircle, XCircle)
- **Colors**: Consistent color scheme (Green=ready, Blue=enriched, Yellow=pending, Red=failed)
- **Badges**: Status badges with appropriate background colors

### 2. Category System
- **Color Coding**: Each category has distinct colors
- **Filtering**: Dropdown selection with "All Categories" option
- **Badge Display**: Consistent badge styling across components

### 3. Selection UX
- **Multi-select**: Checkboxes with indeterminate state support
- **Visual Feedback**: Selected items have visual highlighting
- **Bulk Panel**: Contextual bulk operations panel appears when items selected
- **Clear Actions**: Easy selection clearing and summary display

### 4. Action Patterns
- **Hover Actions**: Actions appear on card hover
- **Confirmation Dialogs**: Destructive actions require confirmation
- **Loading States**: Visual feedback during operations
- **Success/Error States**: Clear feedback for operation results

## Responsive Design Strategy

### Breakpoint Strategy
- **Mobile**: `< 768px` - Single column layout, sheet overlays
- **Tablet**: `768px - 1024px` - Two column layout
- **Desktop**: `> 1024px` - Three column layout with sidebar

### Layout Adaptations
- **Grid**: 3 columns → 2 columns → 1 column
- **Detail Panel**: Side panel → Bottom sheet → Full screen
- **Bulk Operations**: Horizontal → Vertical → Stacked
- **Navigation**: Sidebar → Collapsed → Sheet overlay

## Performance Optimizations

### 1. Data Loading
- **Lazy Loading**: Articles loaded on demand
- **Pagination**: Limit results per page
- **Caching**: Browser caching for repeated requests
- **Debounced Search**: Search input debouncing

### 2. Rendering Optimizations
- **Virtual Scrolling**: For large article lists (future)
- **Memoization**: React.memo for expensive components
- **Lazy Components**: Dynamic imports for heavy components
- **Image Optimization**: Lazy loading and WebP format

### 3. State Management
- **Local State**: React hooks for component state
- **Derived State**: Computed values from base state
- **Batch Updates**: Grouped state updates for performance
- **Cleanup**: Proper cleanup of event listeners and timers

## Security Considerations

### 1. Access Control
- **Route Protection**: Admin routes behind authentication
- **API Security**: Server-side validation and authorization
- **CSRF Protection**: Built-in Next.js CSRF protection
- **Input Validation**: Client and server-side validation

### 2. Data Protection
- **Sanitization**: HTML content sanitization
- **XSS Prevention**: React's built-in XSS protection
- **SQL Injection**: Parameterized queries via Supabase
- **Content Security Policy**: Strict CSP headers

### 3. Operation Safety
- **Confirmation Dialogs**: For destructive operations
- **Audit Logging**: Track admin actions (future)
- **Rate Limiting**: API rate limiting
- **Error Boundaries**: Graceful error handling

## Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live updates
2. **Advanced Analytics**: Article performance metrics
3. **Workflow Management**: Approval workflows for articles
4. **User Management**: Multi-user admin access with roles
5. **Export Functionality**: CSV/JSON export capabilities
6. **Rich Text Editor**: WYSIWYG editing for article content
7. **Image Management**: Upload and edit article images
8. **Scheduling**: Schedule article publication
9. **Templates**: Article templates for consistency
10. **Automation**: Automated content workflows

### Technical Improvements
1. **Virtual Scrolling**: For large datasets
2. **Offline Support**: Service worker integration
3. **Performance Monitoring**: Real-time performance tracking
4. **A/B Testing**: Feature flag system
5. **Microservices**: Service decomposition for scalability

## Maintenance Guidelines

### Code Quality
- **TypeScript**: Maintain strict type safety
- **Component Structure**: Keep components focused and reusable
- **Error Handling**: Comprehensive error boundaries
- **Testing**: Unit and integration tests (future)

### Performance Monitoring
- **Bundle Size**: Monitor and optimize bundle size
- **API Performance**: Track API response times
- **User Experience**: Monitor Core Web Vitals
- **Error Tracking**: Production error monitoring

### Documentation
- **Code Comments**: Document complex logic
- **API Documentation**: Maintain API documentation
- **User Guide**: Admin user documentation
- **Architecture Updates**: Keep architecture docs current

## Deployment Considerations

### Build Process
- **Next.js Optimization**: Production build optimizations
- **Static Generation**: Pre-rendered pages where possible
- **Asset Optimization**: Image and CSS optimization
- **Bundle Splitting**: Efficient code splitting

### Monitoring
- **Health Checks**: API health endpoints
- **Performance Metrics**: Real-time performance monitoring
- **Error Tracking**: Production error tracking
- **Usage Analytics**: Admin usage analytics

## Enhanced Features (July 2025)

### 1. Enhanced Article Enrichment
- **Structured Content**: Articles now include enhanced titles, summaries, key points, and significance analysis
- **Source Attribution**: Complete citation tracking with structured source information
- **Professional Format**: Newspaper-quality structured content generation
- **Backward Compatibility**: Legacy lede field maintained for existing integrations

### 2. Advanced Admin Filtering
- **Category Filtering**: Server-side filtering by specific categories
- **Article Count Control**: Configurable display limits (20, 50, 100, 200, or all articles)
- **Full Article Access**: Admin can now view all articles (86 total vs. previous 57 limit)
- **Performance Optimization**: Server-side filtering reduces client-side processing

### 3. Enhanced API Capabilities
- **Flexible Limits**: Support for unlimited article display in admin context
- **Smart Fallback**: Graceful fallback to public API if admin API fails
- **Real-time Filtering**: Immediate API calls when filters change
- **Comprehensive Logging**: Enhanced debugging and monitoring

### 4. Database Improvements
- **New Schema Fields**: Added enhanced_title, summary, key_points, why_it_matters, structured_sources
- **Migration Support**: Database migration scripts for existing deployments
- **Performance Indexing**: Optimized indexes for new structured fields
- **Dual Function Support**: Both public (limited) and admin (unlimited) access patterns

## Migration Notes

### Database Migration
```sql
-- Add enhanced fields to existing perplexity_news table
ALTER TABLE perplexity_news 
ADD COLUMN IF NOT EXISTS enhanced_title TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS key_points TEXT[],
ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
ADD COLUMN IF NOT EXISTS structured_sources JSONB;
```

### API Evolution
- **v1 (Legacy)**: `/api/perplexity-news` with 10-per-category limit
- **v2 (Enhanced)**: `/api/admin/perplexity` with configurable limits and filtering

---

## Summary

The Perplexity Admin system provides a comprehensive, professional-grade interface for managing AI-generated news articles. Built with modern web technologies and following best practices, it offers:

- **Complete Management**: Full CRUD operations for articles
- **Enhanced Content Structure**: Professional newspaper-quality article format
- **Advanced Filtering**: Server-side category and limit filtering
- **Full Article Access**: View all articles without artificial limits
- **Professional UI**: Clean, responsive design matching the existing admin panel
- **Bulk Operations**: Efficient management of multiple articles
- **Real-time Updates**: Live status monitoring and updates
- **Source Transparency**: Complete citation tracking and attribution
- **Type Safety**: Full TypeScript implementation
- **Scalability**: Architecture ready for future enhancements

The system integrates seamlessly with the existing Panora.hk architecture while providing powerful new capabilities for content management and editorial workflows, with enhanced article quality and comprehensive admin controls.

## Latest Frontend Integration Updates (Current Session)

### Public Feed Integration
With the recent frontend improvements, the perplexity admin system now fully integrates with the public-facing perplexity feed:

#### **Unified User Experience**
- **Consistent Article Viewing**: Articles managed through the admin panel now display seamlessly in the public feed
- **Bottom Sheet Integration**: Full support for detailed article viewing through the ArticleBottomSheet component
- **Responsive Design**: Articles adapt perfectly to mobile, tablet, and desktop viewing

#### **Enhanced API Architecture**
- **Dual API Support**: Admin panel uses `/api/admin/perplexity` while public feed uses `/api/perplexity`
- **Individual Article Retrieval**: New `/api/perplexity/[id]` endpoint enables detailed article viewing
- **Optimized Pagination**: Public feed uses efficient offset-based pagination for infinite scroll

#### **Feed Architecture Alignment**
- **Unified Grid Layout**: Public feed now matches the topics feed design with 1-4 column responsive grid
- **Infinite Scroll**: Seamless loading of additional articles as users browse
- **Consistent Card Design**: Uses shared ArticleCard component for uniform appearance

### Technical Integration Points

#### **Article Data Flow**
```
Admin Panel → Database → Public API → Feed Component → Article Cards → Bottom Sheet
```

#### **Key Integration Components**
- **`/lib/perplexity-utils.ts`**: Transforms admin-managed PerplexityArticle to public Article format
- **`/components/article-detail-sheet.tsx`**: Handles both admin and public article viewing
- **`/components/perplexity-feed.tsx`**: Public feed component with infinite scroll
- **`/app/api/perplexity/route.ts`**: Public API with pagination support
- **`/app/api/perplexity/[id]/route.ts`**: Individual article retrieval

#### **Admin Control Flow**
1. **Content Creation**: Admin panel manages article generation and editing
2. **Status Management**: Articles progress through pending → enriched → ready states
3. **Public Visibility**: Only "ready" articles appear in public feed
4. **Real-time Updates**: Changes in admin panel immediately affect public feed

### Navigation Integration
- **Footer Navigation**: Streamlined to show only Home, AI News (Perplexity), and Topics
- **Icon-Only Design**: Clean mobile-first navigation without text labels
- **Consistent Experience**: Same navigation across all sections

### Performance Improvements
- **Efficient Database Queries**: Optimized pagination reduces server load
- **Shared Components**: Reduced code duplication between admin and public views
- **Type Safety**: Full TypeScript integration ensures data consistency
- **Error Handling**: Comprehensive fallback mechanisms for reliability

### Future Enhancements Ready
The integrated architecture is prepared for:
- **Real-time Updates**: WebSocket integration for live article updates
- **Advanced Filtering**: Public feed filtering by category or date
- **Search Integration**: Full-text search across perplexity articles
- **Social Features**: Enhanced sharing and engagement capabilities

This integration creates a seamless flow from content creation in the admin panel to public consumption, ensuring that the rich, AI-generated content is presented in the most engaging and accessible way possible.