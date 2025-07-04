# Bottom Sheet Architecture - Article Detail Modal

## Overview
The bottom sheet architecture provides a native mobile app-like experience for article viewing, allowing users to preview full articles without leaving the main news feed. The implementation uses a layered component approach with smooth animations and responsive design.

## DOM Structure & Component Hierarchy

### Root Container: `article-bottom-sheet.tsx`
**Purpose**: Main orchestrator component that manages modal state and provides the drawer foundation.

```jsx
<Drawer> 
  <DrawerContent className="h-[95vh]">
    {/* Built-in drag handle (from Vaul) */}
    <div className="drag-handle" />
    
    {/* Custom header with controls */}
    <div className="header-controls">
      <Button className="close-button" />    // X button (left)
      <ShareButton compact={true} />         // Share button (right)
    </div>
    
    {/* Article content container */}
    <div className="content-scroll-area">
      <ArticleDetailSheet />
    </div>
  </DrawerContent>
</Drawer>
```

**Key Responsibilities:**
- Modal state management (open/close)
- Drag-to-dismiss functionality (via Vaul library)
- Header controls layout and positioning
- Scroll container configuration

---

### Content Component: `article-detail-sheet.tsx`
**Purpose**: Optimized article display component specifically designed for bottom sheet constraints.

```jsx
<article className="px-4 pb-6">
  <header className="mb-6">
    <h1 className="text-2xl md:text-3xl" />           // Large title
    <div className="metadata-row justify-between">
      <div className="source-info" />                 // Left: Source display
      <div className="time-display" />                // Right: Clock + time
    </div>
  </header>
  
  <div className="image-container mb-6">
    <Image className="rounded-xl" />                  // Article image
  </div>
  
  <div className="content-body space-y-6">
    <div className="article-text" />                  // Main article content
    <div className="sources-section" />               // AI sources (if applicable)
  </div>
  
  <footer className="read-original-link">
    <Link />                                          // External link to source
  </footer>
</article>
```

**Key Responsibilities:**
- Compact article layout for mobile viewing
- Typography hierarchy optimized for reading
- Content scrolling and text flow
- Source attribution and metadata display

---

### Loading State: `article-detail-skeleton.tsx`
**Purpose**: Provides coherent loading experience that matches the final DOM structure.

```jsx
<div className="skeleton-container animate-pulse">
  <header className="skeleton-header">
    <div className="title-skeleton" />               // 2-line title placeholder
    <div className="metadata-skeleton justify-between">
      <div className="source-placeholder" />         // Left: Source skeleton
      <div className="time-placeholder" />           // Right: Clock + time skeleton
    </div>
  </header>
  
  <div className="image-skeleton" />                 // Image placeholder
  
  <div className="content-skeleton">
    <div className="paragraph-skeletons" />          // Multiple content lines
  </div>
  
  <footer className="footer-skeleton" />             // Footer link skeleton
</div>
```

**Key Responsibilities:**
- Structural preview of loading content
- Smooth transition to actual content
- Performance optimization during data fetch

---

## Integration Components

### News Feed Integration: `news-feed.tsx`
```jsx
<NewsFeed>
  {articles.map(article => (
    <ArticleCard onReadMore={handleReadMore} />      // Triggers bottom sheet
  ))}
  
  <ArticleBottomSheet 
    articleId={selectedArticleId}
    open={isBottomSheetOpen}
    onOpenChange={handleBottomSheetChange}
  />
</NewsFeed>
```

### Article Card Trigger: `article-card.tsx`
```jsx
<ArticleCard>
  <Button onClick={() => onReadMore(article.id)}>   // "Read More" button
    Read More <ExternalLink />
  </Button>
</ArticleCard>
```

---

## Data Flow Architecture

### 1. User Interaction Flow
```
User clicks "Read More" 
  ↓
NewsFeed.handleReadMore()
  ↓
setSelectedArticleId() + setIsBottomSheetOpen(true)
  ↓
ArticleBottomSheet renders with articleId
  ↓
ArticleDetailSheet fetches article data
  ↓
Content renders with full article layout
```

### 2. State Management
```jsx
// NewsFeed component state
const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)

// ArticleDetailSheet component state  
const [article, setArticle] = useState<Article | null>(null)
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState<Error | null>(null)
```

### 3. Data Fetching Pattern
```jsx
useEffect(() => {
  const fetchArticleData = async () => {
    const response = await fetch(`/api/articles/${articleId}`)
    const data = await response.json()
    setArticle(data)
  }
  fetchArticleData()
}, [articleId])
```

---

## Styling & Layout Architecture

### CSS Structure
```css
/* Bottom Sheet Container */
.drawer-content {
  height: 95vh;                    /* 95% viewport height */
  border-radius: 10px 10px 0 0;   /* Rounded top corners */
  background: var(--background);   /* Theme-aware background */
}

/* Header Controls */
.header-controls {
  position: relative;
  padding: 8px 16px 24px;
  flex-shrink: 0;                  /* Prevent header compression */
}

/* Content Scroll Area */
.content-scroll-area {
  flex: 1;                         /* Fill remaining space */
  overflow-y: auto;                /* Vertical scrolling */
  overscroll-behavior: contain;    /* Prevent overscroll */
}

/* Article Layout */
.article-container {
  padding: 0 16px 24px;           /* Side padding + bottom padding */
  max-width: none;                 /* Full width in bottom sheet */
}
```

### Responsive Breakpoints
```css
/* Mobile First (default) */
.title { font-size: 1.5rem; }           /* text-2xl */
.image { height: 12rem; }               /* h-48 */

/* Tablet and up */
@media (min-width: 640px) {
  .title { font-size: 1.875rem; }       /* md:text-3xl */
  .image { height: 16rem; }             /* sm:h-64 */
}
```

---

## Animation & Interaction Architecture

### Drawer Animations (Vaul Library)
- **Open**: Slides up from bottom with backdrop fade-in
- **Close**: Slides down with backdrop fade-out  
- **Drag**: Real-time position tracking with haptic feedback
- **Threshold**: 50% drag distance triggers close

### Content Transitions
- **Loading**: Skeleton animation with pulse effect
- **Content**: Fade-in transition when article loads
- **Error**: Smooth error state presentation

### Scroll Behavior
- **Overscroll**: Contained within bottom sheet
- **Momentum**: Native iOS/Android scroll momentum
- **Threshold**: Header controls remain fixed during scroll

---

## File Dependencies & Imports

### Core Dependencies
```typescript
// UI Framework
import { Drawer, DrawerContent } from "@/components/ui/drawer"  // Vaul-based
import { Button } from "@/components/ui/button"                 // Radix UI
import Image from "next/image"                                  // Next.js

// State & Effects
import { useState, useEffect } from "react"                     // React hooks
import { useLanguage } from "./language-provider"               // i18n context

// Data & Types
import type { Article } from "@/lib/types"                      // TypeScript
import { formatDistanceToNow } from "date-fns"                  // Time formatting
```

### API Integration
```typescript
// Article data fetching
GET /api/articles/${articleId}

// Response structure
interface Article {
  id: string
  title: string
  content: string
  summary: string
  imageUrl?: string
  source: string
  publishedAt: string
  // ... additional fields
}
```

---

## Performance Considerations

### 1. Lazy Loading
- Article content only fetches when bottom sheet opens
- Images load progressively with proper error handling
- Skeleton UI prevents layout shift

### 2. Memory Management
- Component unmounts clean up timers and async operations
- Event listeners properly removed on component destruction
- State reset when bottom sheet closes

### 3. Scroll Optimization
- `overscroll-behavior: contain` prevents body scroll
- Virtualization not needed due to single article constraint
- Smooth scrolling with CSS `scroll-behavior`

---

## Accessibility Features

### Screen Reader Support
```jsx
<DrawerTitle className="sr-only">Article Details</DrawerTitle>
<DrawerDescription className="sr-only">
  Full article content and details
</DrawerDescription>
```

### Keyboard Navigation
- **Escape**: Closes bottom sheet
- **Tab**: Navigates through interactive elements
- **Enter/Space**: Activates buttons and links

### Focus Management
- Focus traps within bottom sheet when open
- Focus returns to trigger button when closed
- Proper ARIA labels for all interactive elements

---

## Error Handling Architecture

### Loading States
1. **Initial**: Skeleton UI with pulse animation
2. **Error**: User-friendly error message with retry option
3. **Not Found**: Clear "Article not found" messaging
4. **Success**: Smooth transition to article content

### Fallback Strategies
- Graceful image loading with error handling
- Network failure recovery with retry mechanisms  
- Malformed data handling with safe defaults

This architecture provides a robust, performant, and accessible article viewing experience that feels native on mobile devices while maintaining the flexibility of a web application.