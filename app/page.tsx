"use client"

import { useState, useRef } from "react"
import UnifiedHeader from "@/components/unified-header"
import FooterNav from "@/components/footer-nav"
import MainContent from "@/components/main-content-with-selector"
import SideMenu from "@/components/side-menu-overlay"
import { ContentType } from "@/components/content-type-selector"
import { useEdgeSwipe, useSwipeGesture } from "@/hooks/use-swipe-gesture"

const contentTypes: ContentType[] = ['headlines', 'news', 'bulletin'];

export default function HomePage() {
  const [contentType, setContentType] = useState<ContentType>('headlines')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Enable edge swipe to open menu
  useEdgeSwipe({
    onSwipeFromLeft: () => setIsMenuOpen(true),
    edgeWidth: 30,
    enabled: !isMenuOpen
  })

  const handleContentTypeChange = (newType: ContentType) => {
    setContentType(newType)
    // Announce content change to screen readers
    const announcement = `Now showing ${newType} content`
    const liveRegion = document.getElementById('content-change-announcement')
    if (liveRegion) {
      liveRegion.textContent = announcement
    }
  }

  // Handle content swipe gestures
  const handleSwipeLeft = () => {
    const currentIndex = contentTypes.indexOf(contentType)
    const nextIndex = (currentIndex + 1) % contentTypes.length
    handleContentTypeChange(contentTypes[nextIndex])
  }

  const handleSwipeRight = () => {
    const currentIndex = contentTypes.indexOf(contentType)
    const prevIndex = (currentIndex - 1 + contentTypes.length) % contentTypes.length
    handleContentTypeChange(contentTypes[prevIndex])
  }

  // Enable swipe gestures on scroll container
  useSwipeGesture(scrollContainerRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 60,
    enabled: !isMenuOpen
  })

  return (
    <>
      {/* Side menu as pure overlay */}
      <SideMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
      
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span id="content-change-announcement"></span>
      </div>

      {/* Single scroll container for entire app */}
      <div 
        ref={scrollContainerRef}
        className="fixed inset-0 flex flex-col overflow-y-auto overflow-x-hidden"
      >
        {/* Unified sticky header with category selector */}
        <UnifiedHeader 
          isMenuOpen={isMenuOpen}
          onMenuOpenChange={setIsMenuOpen}
          contentType={contentType}
          onContentTypeChange={handleContentTypeChange}
          scrollContainerRef={scrollContainerRef}
        />

        {/* Main content area */}
        <main className="flex-1 pb-24">
          <MainContent contentType={contentType} />
        </main>
      </div>

      {/* Fixed bottom navigation */}
      <FooterNav />
    </>
  )
}