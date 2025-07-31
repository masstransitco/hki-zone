"use client"

import { useEffect } from 'react'

export function ServiceWorkerCleanup() {
  useEffect(() => {
    // Only run in production and in browsers that support service workers
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    async function cleanupOldServiceWorkers() {
      try {
        console.log('Checking for existing service workers to clean up...')
        
        // Get all existing service worker registrations
        const registrations = await navigator.serviceWorker.getRegistrations()
        
        if (registrations.length > 0) {
          console.log(`Found ${registrations.length} service worker(s) to clean up`)
          
          // Unregister all existing service workers
          for (const registration of registrations) {
            const result = await registration.unregister()
            console.log(`Service worker unregistered:`, result)
          }
          
          // Clear all caches that might be associated with old service workers
          if ('caches' in window) {
            const cacheNames = await caches.keys()
            console.log('Cache names found:', cacheNames)
            
            // Delete caches that match known patterns from the old service worker
            const cachesToDelete = cacheNames.filter(name => 
              name.includes('hki-v') || 
              name.includes('workbox') ||
              name.includes('sw-')
            )
            
            for (const cacheName of cachesToDelete) {
              const deleted = await caches.delete(cacheName)
              console.log(`Cache '${cacheName}' deleted:`, deleted)
            }
          }
          
          // Force a page reload if we cleaned up any service workers
          // This ensures the app runs without any old cached resources
          if (registrations.length > 0) {
            console.log('Service worker cleanup completed. Reloading page to ensure fresh resources.')
            // Use replace to avoid adding to browser history
            window.location.replace(window.location.href)
          }
        } else {
          console.log('No existing service workers found')
        }
      } catch (error) {
        console.error('Error during service worker cleanup:', error)
        // Don't throw - this is a best-effort cleanup
      }
    }

    // Run cleanup after a short delay to avoid blocking initial page load
    const timeoutId = setTimeout(cleanupOldServiceWorkers, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [])

  // This component doesn't render anything
  return null
}