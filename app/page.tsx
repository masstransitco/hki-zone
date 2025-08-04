"use client"

import { useRef } from "react"
import UnifiedHeader from "@/components/unified-header"
import FooterNav from "@/components/footer-nav"
import MainContent from "@/components/main-content-with-selector"
import SideMenu from "@/components/side-menu"
import StickyCategorySelector from "@/components/sticky-category-selector"
import { ContentType } from "@/components/content-type-selector"
import { useEdgeSwipe } from "@/hooks/use-swipe-gesture"
import { useUIRedux } from "@/hooks/use-ui-redux"

const contentTypes: ContentType[] = ['headlines', 'finance', 'techScience', 'entertainment', 'international', 'news', 'bulletin'];

export default function HomePage() {
  const mainContentRef = useRef<HTMLDivElement>(null)
  const { 
    contentType, 
    isMenuOpen, 
    setContentType, 
    setMenuOpen 
  } = useUIRedux()

  // Enable edge swipe to open menu
  useEdgeSwipe({
    onSwipeFromLeft: () => setMenuOpen(true),
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

  // Content type change handler (now handled by MainContent carousel)
  // Removed old swipe gesture implementation - now handled by carousel

  return (
    <>
      {/* Side menu as pure overlay */}
      <SideMenu isOpen={isMenuOpen} onOpenChange={setMenuOpen} />
      
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span id="content-change-announcement"></span>
      </div>

      {/* App container - main content takes full viewport */}
      <div className="fixed inset-0 flex flex-col">
        {/* Main content area - full viewport height */}
        <main ref={mainContentRef} className="flex-1 relative">
          <MainContent 
            contentType={contentType}
            onContentTypeChange={handleContentTypeChange}
          />
        </main>

        {/* Unified header - floating overlay */}
        <UnifiedHeader 
          isMenuOpen={isMenuOpen}
          onMenuOpenChange={setMenuOpen}
        />

        {/* Sticky category selector - floating overlay */}
        <StickyCategorySelector 
          value={contentType}
          onChange={handleContentTypeChange}
        />
      </div>

      {/* Fixed bottom navigation */}
      <FooterNav />
    </>
  )
}