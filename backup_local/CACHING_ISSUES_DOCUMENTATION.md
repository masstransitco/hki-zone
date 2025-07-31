# Caching and Hydration Issues Documentation

## Overview

This document outlines the caching and hydration issues encountered in the Panora.hk Next.js application, their root causes, applied solutions, and remaining concerns.

## Problem Description

### 1. Development Environment Issues
- **404 Errors**: Static assets returning 404 with version query parameters (e.g., `?v=1751607457430`)
- **Cache Persistence**: Browser cache serving old versions after dev server restart
- **Hydration Errors**: "Hydration failed because the initial UI does not match what was rendered on the server"

### 2. Production/User Issues
- Users experience homepage loading failures after using the app for a while
- Page refresh results in blank screens or errors
- Service Worker interfering with content updates

## Root Causes Identified

### 1. Service Worker Caching (Primary Cause)
The service worker was caching ALL requests, including Next.js development assets:
```javascript
// Problem: This cached everything, including versioned assets
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
```

### 2. SSR/Client Hydration Mismatches
Multiple components rendered differently on server vs client:
- **Date/Time Values**: `new Date().toLocaleString()`, `formatDistanceToNow()`
- **Browser APIs**: `window.location`, `localStorage`, `window.scrollY`
- **Dynamic State**: Theme preferences, language settings, pathname-based styling

### 3. Next.js Version Query Parameters
Next.js adds version numbers to static assets in development that change with each build, causing cache mismatches.

## Solutions Applied

### 1. Service Worker Modifications

**File: `/components/service-worker-register.tsx`**
```javascript
// Only register in production, unregister in development
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
} else if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
  // Unregister any existing service worker
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}
```

**File: `/public/sw.js`**
```javascript
// Skip caching development assets
if (url.pathname.startsWith('/_next/') || 
    url.pathname.startsWith('/api/') ||
    url.search.includes('?v=') ||
    url.hostname === 'localhost') {
  event.respondWith(fetch(event.request));
  return;
}
```

### 2. ClientOnly Wrapper Implementation

**File: `/components/client-only.tsx`**
```javascript
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)
  
  useEffect(() => {
    setHasMounted(true)
  }, [])
  
  if (!hasMounted) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
```

### 3. Hydration-Safe Components

**Modified Components:**
- `/components/language-provider.tsx` - Added mounted state check
- `/components/theme-toggle.tsx` - Added mounted state check
- `/components/header.tsx` - Guards for window.scrollY
- `/components/share-button.tsx` - Guards for window.location
- `/components/database-status.tsx` - Removed dynamic time display during SSR
- `/components/analytics-provider.tsx` - Added mounted checks
- `/hooks/use-hydration-safe-date.ts` - Created for safe date formatting

**File: `/app/page.tsx`**
```javascript
// Wrapped dynamic components with ClientOnly
<ClientOnly fallback={<header className="..." />}>
  <Header />
</ClientOnly>

<ClientOnly>
  <DatabaseStatus />
</ClientOnly>

<ClientOnly fallback={<LoadingSkeleton />}>
  <NewsFeed />
</ClientOnly>

<ClientOnly fallback={<nav className="..." />}>
  <FooterNav />
</ClientOnly>
```

## Files to Review

### Critical Files for Caching Issues:
1. **Service Worker**
   - `/public/sw.js` - Main service worker logic
   - `/components/service-worker-register.tsx` - Registration component
   - `/public/manifest.json` - PWA manifest

2. **Layout and Providers**
   - `/app/layout.tsx` - Root layout with providers
   - `/components/theme-provider.tsx` - Theme management
   - `/components/language-provider.tsx` - Language/locale management
   - `/components/query-provider.tsx` - React Query configuration

3. **Components with Dynamic Content**
   - `/components/header.tsx` - Navigation with scroll behavior
   - `/components/footer-nav.tsx` - Active route highlighting
   - `/components/database-status.tsx` - Live connection status
   - `/components/news-feed.tsx` - Article listings
   - `/components/article-card.tsx` - Time displays

4. **Hooks and Utilities**
   - `/hooks/use-hydration-safe-date.ts` - Date formatting
   - `/lib/analytics.ts` - Analytics tracking

## Remaining Issues and Concerns

### 1. Service Worker Cache Persistence
Even with fixes, users may still have the old service worker cached:
- Old SW continues to serve stale content
- Browser doesn't immediately use updated SW
- Cache invalidation can take time

### 2. PWA Installation
If users have installed the app as a PWA:
- Updates may not propagate immediately
- Cached app shell persists
- Manual refresh might be required

### 3. React Query Cache
The app uses React Query which has its own caching:
- Stale data might be served
- Background refetches might fail
- Cache persistence across sessions

## Recommended Actions

### For Development:
1. **Always clear cache** when switching between branches
2. **Use incognito mode** for testing clean states
3. **Disable cache** in DevTools Network tab
4. **Check for SW** in Application tab and unregister if needed

### For Production Deployment:
1. **Implement SW versioning**:
   ```javascript
   const CACHE_VERSION = 'v2'; // Increment on deploy
   const CACHE_NAME = `hki-${CACHE_VERSION}`;
   ```

2. **Add update prompts**:
   ```javascript
   // Detect SW updates and prompt user
   registration.addEventListener('updatefound', () => {
     // Show "Update available" banner
   });
   ```

3. **Configure cache headers**:
   ```javascript
   // In next.config.mjs
   async headers() {
     return [
       {
         source: '/:path*',
         headers: [
           {
             key: 'Cache-Control',
             value: 'public, max-age=3600, must-revalidate',
           },
         ],
       },
     ]
   }
   ```

### For Users Experiencing Issues:
1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear site data**: 
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Or: DevTools → Application → Storage → Clear site data
3. **Unregister service worker**:
   - DevTools → Application → Service Workers → Unregister
4. **Reinstall PWA** if installed as an app

## Future Improvements

1. **Implement proper cache strategies**:
   - Network-first for API calls
   - Cache-first for static assets
   - Stale-while-revalidate for content

2. **Add cache busting**:
   - Version all static assets
   - Implement proper cache invalidation
   - Use unique build IDs

3. **Improve error handling**:
   - Detect hydration errors
   - Provide user-friendly error messages
   - Implement automatic recovery

4. **Monitor performance**:
   - Track hydration failures
   - Monitor SW cache hit rates
   - Alert on high error rates

## Testing Checklist

- [ ] Clear all browser data
- [ ] Load homepage fresh
- [ ] Navigate between pages
- [ ] Refresh multiple times
- [ ] Check DevTools for errors
- [ ] Verify SW registration status
- [ ] Test with slow network
- [ ] Test offline functionality
- [ ] Check for hydration warnings
- [ ] Verify all content loads

## Conclusion

The caching issues stem from the interaction between:
1. Service Worker aggressive caching
2. Next.js development asset versioning
3. SSR/Client hydration mismatches

While the implemented fixes address the immediate issues, users with cached service workers may continue to experience problems until their browsers update the SW or they manually clear their cache.