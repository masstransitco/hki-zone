# Signals Feed Architecture

## Overview

The Signals feed (formerly Perplexity feed) is a modern, AI-powered news aggregation system that displays AI-generated articles from the Perplexity API. It provides users with a streamlined interface to browse categorized news signals with infinite scrolling and detailed article views via bottom sheets.

## Key Features

- **Modern List View**: Card-based list layout with square thumbnails
- **Category Filtering**: Horizontal scrollable category pills for quick filtering
- **Infinite Scroll**: Automatic loading of more content as users scroll
- **Bottom Sheet Integration**: Full article content displayed in a sliding panel
- **Real-time Updates**: Auto-refresh every 2 minutes
- **Responsive Design**: Optimized for both mobile and desktop experiences

## System Architecture

### Frontend Components

#### 1. Main Page Component (`/app/perplexity/page.tsx`)
- **Purpose**: Entry point for the Signals feed
- **Key Features**:
  - Category selection with horizontal scrolling pills
  - Refresh functionality (icon-only button)
  - State management for articles, loading, and pagination
  - Auto-refresh timer (2-minute intervals)

#### 2. Article List Component (`/components/perplexity-public-list.tsx`)
- **Purpose**: Renders the list of signal cards
- **Key Features**:
  - Modern card-based list view
  - Square thumbnail display (96x96px)
  - Infinite scroll implementation using Intersection Observer
  - Click-to-open bottom sheet functionality
  - Loading states and empty states

#### 3. Bottom Sheet Integration
- **Component**: `ArticleBottomSheet` (reused from main article system)
- **Features**:
  - 95vh height for immersive reading
  - Drag-to-dismiss functionality
  - Structured content display (Summary, Key Points, Why It Matters)
  - Share functionality

### Backend Architecture

#### 1. API Endpoint (`/app/api/perplexity/route.ts`)
- **Purpose**: Fetches articles from the `perplexity_news` table
- **Features**:
  - Category filtering
  - Search functionality
  - Pagination support
  - Status filtering (shows only 'ready' or 'enriched' articles)
  - Consistent with admin panel data source

#### 2. Article Detail API (`/app/api/perplexity/[id]/route.ts`)
- **Purpose**: Fetches individual article details
- **Features**:
  - Transforms Perplexity data to standard Article format
  - Fallback to mock data if database unavailable
  - Structured content formatting

### Data Flow

```
User Interaction → Signals Page → API Request → perplexity_news table
                                                          ↓
Bottom Sheet ← Article Detail ← Transformation ← Article Data
```

### Database Schema

The Signals feed uses the `perplexity_news` table with the following key fields:

```typescript
interface PerplexityArticle {
  id: string
  title: string
  enhanced_title?: string
  category: string
  url: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
  article_html?: string
  lede?: string
  summary?: string
  key_points?: string[]
  why_it_matters?: string
  image_url?: string
  source: string
  author: string
  created_at: string
  updated_at?: string
  // ... additional metadata fields
}
```

### Content Processing

#### 1. Content Transformation (`/lib/perplexity-utils.ts`)
- **Purpose**: Converts Perplexity articles to standard Article format
- **Key Functions**:
  - `transformPerplexityToArticle()`: Main transformation function
  - `formatPerplexityContentForAI()`: Formats content for structured display
  - HTML to markdown conversion for consistent parsing

#### 2. Content Parsing (`/lib/content-parser.ts`)
- **Purpose**: Parses structured content sections
- **Features**:
  - Detects markdown sections (`**Summary**`, `**Key Points**`, etc.)
  - Extracts structured data for enhanced display
  - Handles both Perplexity format and standard AI-enhanced format

#### 3. Content Display (`/components/ai-enhanced-content.tsx`)
- **Purpose**: Renders parsed content with proper formatting
- **Features**:
  - Styled section headings
  - Numbered key points with visual indicators
  - Responsive typography
  - Consistent spacing and layout

## UI/UX Design Decisions

### 1. List View Format
- **Rationale**: Provides a scannable, micro-content feed ideal for quick browsing
- **Implementation**:
  - Card-based layout with consistent spacing
  - Square thumbnails for visual consistency
  - Category badges with color coding
  - Timestamp display for recency

### 2. Category Navigation
- **Rationale**: Quick filtering without dropdown complexity
- **Implementation**:
  - Horizontal scrolling pills
  - Active state highlighting
  - Smooth scroll with navigation arrows on desktop
  - Hidden scrollbar for cleaner appearance

### 3. Infinite Scroll
- **Rationale**: Seamless content consumption without pagination buttons
- **Implementation**:
  - Intersection Observer API for performance
  - Loading indicator at scroll trigger point
  - Automatic fetch when approaching bottom
  - 100px margin for early loading

### 4. Bottom Sheet for Articles
- **Rationale**: Immersive reading without navigation
- **Implementation**:
  - Reuses existing article bottom sheet component
  - Maintains context with background scaling
  - Easy dismissal with drag or close button

## Performance Optimizations

1. **Lazy Loading**: Images use `loading="lazy"` attribute
2. **Pagination**: Loads 20 articles at a time
3. **Debounced Scroll**: Intersection Observer prevents excessive API calls
4. **Efficient Re-renders**: State updates batched where possible
5. **Auto-refresh**: 2-minute interval balances freshness with performance

## State Management

The Signals feed uses React hooks for state management:

```typescript
- articles: PerplexityArticle[] // Article data
- loading: boolean // Initial load state
- categoryFilter: string // Selected category
- page: number // Current page for pagination
- hasMore: boolean // More articles available
- refreshing: boolean // Refresh in progress
- canScrollLeft/Right: boolean // Category scroll state
- selectedArticleId: string | null // For bottom sheet
- bottomSheetOpen: boolean // Bottom sheet visibility
```

## Error Handling

1. **API Failures**: Falls back to previous data or shows error state
2. **Missing Images**: Graceful degradation with placeholder
3. **Network Issues**: Retry mechanisms in place
4. **Database Unavailability**: Mock data fallback

## Future Enhancements

1. **Personalization**: User preference for categories
2. **Save for Later**: Bookmark functionality
3. **Share Integration**: Native sharing capabilities
4. **Advanced Filtering**: Date ranges, multiple categories
5. **Analytics**: Track user engagement with signals
6. **Push Notifications**: Real-time alerts for breaking signals

## Related Documentation

- [Bottom Sheet Architecture](./BOTTOM_SHEET_ARCHITECTURE.md)
- [Content Parser Documentation](./CONTENT_PARSER.md)
- [API Documentation](./API_DOCUMENTATION.md)