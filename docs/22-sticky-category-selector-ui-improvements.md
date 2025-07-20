# Sticky Category Selector and Feed Standardization

## Overview

This document outlines the UI improvements made to implement a sticky category selector and standardize feed positioning across the main app page. The improvements focus on modern UI practices, minimalist design principles, and enhanced user experience.

**Updated (January 2025)**: Fixed synchronization issues with the push effect layout and refined header visibility timing for optimal user experience.

## Changes Made

### 1. Sticky Category Selector Implementation

#### Problem
- Category selector (Headlines/News/Bulletin) was scrolling away with content
- Users lost context when scrolling through feeds
- Inconsistent navigation experience

#### Solution
**Created Sticky Category Selector Component** (`/components/sticky-category-selector.tsx`)
- Positioned as sticky element between header and main content
- Dynamic positioning based on header visibility
- Smooth transitions matching header behavior
- Removed background for modern floating appearance

**Key Features:**
- `position: sticky` with dynamic top positioning
- `top-[57px]` when header visible, `top-0` when header hidden (updated from `top-16`)
- Shared state management with header via `useHeaderVisibility` hook
- Smooth transitions: `transition-all duration-300 ease-in-out`
- Clean floating appearance without background (updated January 2025)
- Precise header visibility timing for optimal synchronization

### 2. Shared Header Visibility State

#### Problem
- Category selector needed to know header visibility state
- Duplicate scroll logic between components

#### Solution
**Created Shared Hook** (`/hooks/use-header-visibility.ts`)
- Centralized scroll detection logic
- Shared state between header and category selector
- Consistent behavior across components
- Performance optimized with throttling

**Updated Components:**
- `components/header.tsx` - Now uses shared hook
- `components/sticky-category-selector.tsx` - Uses hook for dynamic positioning

### 3. Layout Restructuring

#### Problem
- Category selector was nested inside main content
- No proper spacing for sticky positioning

#### Solution
**Updated Main Page Layout** (`/app/page.tsx`)
- Moved category selector out of main content
- Positioned between header and main content area
- Added state management at page level
- Added `pt-[73px]` to main element for proper spacing

**Layout Hierarchy:**
```
<div className="flex flex-col min-h-screen">
  <Header />
  <StickyCategorySelector />  <!-- Now sticky between header and content -->
  <main className="pt-[73px]"> <!-- Added spacing for sticky selector -->
    <MainContent />
  </main>
</div>
```

### 4. Component Refactoring

#### Updated MainContent Component (`/components/main-content-with-selector.tsx`)
- **Before:** `MainContentWithSelector` - managed both selector and content
- **After:** `MainContent` - receives contentType as prop
- Removed internal state management
- Cleaner separation of concerns
- Simplified component structure

### 5. Feed Standardization

#### Problem
- Three feeds had inconsistent visual starting positions:
  - **Headlines (TopicsFeed)**: No top padding (0)
  - **News (NewsFeedMasonry)**: `py-6` padding (1.5rem)
  - **Bulletin (GovernmentBulletin)**: Large header section (~4-5rem)

#### Solution
**Standardized Top Padding** - All feeds now start at same visual position

**Changes Made:**
- `components/topics-feed.tsx`: Added `pt-6` to main container
- `components/government-bulletin.tsx`: Added `pt-6` to main container  
- `components/news-feed-masonry.tsx`: Already correct with `py-6`

**Result:** Consistent 1.5rem top padding across all feeds

## Technical Implementation

### Scroll Behavior Logic (Updated January 2025)
```typescript
const handleScroll = () => {
  const currentScrollY = window.scrollY
  
  // Show header only when very close to the top
  if (currentScrollY < 10) {
    setIsVisible(true)
  } 
  // Hide header when scrolling down (only after scrolling past 100px)
  else if (currentScrollY > lastScrollY && currentScrollY > 100) {
    setIsVisible(false)
  }
  // Keep header hidden when scrolling up but not at top
  else if (currentScrollY >= 10) {
    setIsVisible(false)
  }
  
  setLastScrollY(currentScrollY)
}
```

**Key Improvements:**
- Header shows only when `scrollY < 10` (very close to top)
- Header stays hidden when scrolling up but not at top (`scrollY >= 10`)
- Eliminates premature header visibility during upward scroll
- Perfect synchronization between header and sticky selector

### Dynamic Positioning
```tsx
<div className={`sticky z-40 transition-all duration-300 ease-in-out ${
  headerVisible ? 'top-[57px]' : 'top-0'
}`}>
```

### Performance Optimizations
- Throttled scroll handlers using `requestAnimationFrame`
- Shared state to prevent duplicate listeners
- Passive event listeners for better performance

## Visual Design Improvements

### Modern UI Principles Applied
1. **Floating Elements:** Removed background from sticky selector for clean floating appearance
2. **Smooth Transitions:** Consistent 300ms cubic-bezier animations
3. **Dynamic Spacing:** Intelligent positioning based on context
4. **Visual Hierarchy:** Clear separation between navigation and content
5. **Minimalist Design:** Reduced visual clutter while maintaining functionality

### Enhanced User Experience
1. **Persistent Navigation:** Category selector always accessible during scroll
2. **Context Awareness:** Smooth repositioning based on header state
3. **Consistent Starting Points:** All feeds begin at same visual position
4. **Smooth Interactions:** Fluid transitions between states

## Files Modified

### New Files Created
- `/components/sticky-category-selector.tsx` - Sticky wrapper component
- `/hooks/use-header-visibility.ts` - Shared scroll state hook
- `/docs/22-sticky-category-selector-ui-improvements.md` - This documentation

### Files Modified
- `/app/page.tsx` - Layout restructuring and state management, fallback height fix (January 2025)
- `/components/header.tsx` - Updated to use shared hook
- `/components/main-content-with-selector.tsx` - Refactored to accept props
- `/components/content-type-selector.tsx` - Removed bottom margin
- `/components/topics-feed.tsx` - Added standardized top padding
- `/components/government-bulletin.tsx` - Added standardized top padding
- `/components/sticky-category-selector.tsx` - Height fix and background removal (January 2025)
- `/hooks/use-header-visibility.ts` - Refined visibility timing logic (January 2025)

## January 2025 Updates

### Push Effect Layout Compatibility
After implementing side menu functionality across all pages with push effect layouts, synchronization issues were discovered and resolved:

#### Problems Identified
1. **Height Mismatch**: `top-16` (64px) didn't match actual header height (57px)
2. **Premature Header Visibility**: Header showed on any upward scroll, causing gaps
3. **Timing Issues**: Category selector moved before header was actually visible
4. **Background Interference**: Background styling conflicted with floating design

#### Solutions Implemented
1. **Precise Height Matching**: Updated from `top-16` to `top-[57px]` for exact header alignment
2. **Refined Visibility Logic**: Header shows only when `scrollY < 10` (very close to top)
3. **Clean Floating Design**: Removed background for modern, transparent appearance
4. **Perfect Synchronization**: Eliminated gaps between header visibility and selector positioning

#### New Behavior Flow
```
At top (scrollY < 10):        Header visible → Selector at top-[57px]
Scrolling down > 100px:       Header hides → Selector moves to top-0
Scrolling up (scrollY ≥ 10):  Header stays hidden → Selector stays at top-0
Reaching top (scrollY < 10):  Header shows → Selector moves to top-[57px]
```

## Benefits Achieved

### User Experience
- ✅ Persistent category navigation during scroll
- ✅ Consistent visual alignment across all feeds  
- ✅ Smooth, predictable interactions
- ✅ Modern, floating UI aesthetic
- ✅ Maintained scroll performance
- ✅ Perfect header/selector synchronization (January 2025)
- ✅ No gaps or visual glitches during scroll transitions

### Code Quality
- ✅ Shared state management for related components
- ✅ Clean separation of concerns
- ✅ Reusable hook for scroll behavior
- ✅ Consistent component patterns
- ✅ Performance optimized scroll handling

### Maintainability
- ✅ Centralized scroll logic
- ✅ Clear component hierarchy
- ✅ Type-safe prop passing
- ✅ Well-documented changes
- ✅ Future-proof architecture

## Future Considerations

### Potential Enhancements
1. **Animation Refinements:** Consider adding spring physics for more natural movement
2. **Accessibility:** Add focus management for keyboard navigation
3. **Mobile Optimizations:** Fine-tune touch scroll behavior
4. **Theme Integration:** Ensure proper contrast in all theme variants

### Monitoring Points
1. **Performance:** Monitor scroll performance on lower-end devices
2. **Browser Compatibility:** Test sticky positioning across browsers
3. **Mobile Behavior:** Verify smooth operation on mobile devices
4. **State Synchronization:** Ensure header and selector stay synchronized ✅ (Fixed January 2025)
5. **Push Effect Compatibility:** Verify behavior with side menu open/closed ✅ (Fixed January 2025)

## Troubleshooting (January 2025)

### Common Issues and Solutions

#### Gap Above Category Selector
**Symptom:** Space appears above category selector when scrolling up
**Cause:** Header visibility timing mismatch
**Solution:** Updated visibility logic to show header only at `scrollY < 10`

#### Height Misalignment  
**Symptom:** Category selector doesn't align with header properly
**Cause:** `top-16` (64px) vs actual header height (57px)
**Solution:** Changed to `top-[57px]` for precise alignment

#### Background Conflicts
**Symptom:** Category selector background interferes with floating design
**Cause:** Unnecessary background styling
**Solution:** Removed `bg-background/95 backdrop-blur-sm border-b` classes

This implementation successfully modernizes the main page UI while maintaining excellent performance and user experience across all device types and usage patterns. The January 2025 updates ensure perfect synchronization with the push effect layout system.