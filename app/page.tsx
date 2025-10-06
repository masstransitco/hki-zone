"use client"

import { useRef, useState, useEffect } from "react"
import UnifiedHeader from "@/components/unified-header"
import FooterNav from "@/components/footer-nav"
import MainContent from "@/components/main-content-with-selector"
import AboutUs from "@/components/about-us"
import SideMenu from "@/components/side-menu"
import StickyCategorySelector from "@/components/sticky-category-selector"
import { ContentType } from "@/components/content-type-selector"
import { useEdgeSwipe } from "@/hooks/use-swipe-gesture"
import { useUIRedux } from "@/hooks/use-ui-redux"

type ViewType = 'main' | 'about'

const contentTypes: ContentType[] = ['headlines', 'finance', 'techScience', 'entertainment', 'international', 'news', 'bulletin'];

export default function HomePage() {
  const mainContentRef = useRef<HTMLDivElement>(null)
  const [currentView, setCurrentView] = useState<ViewType>('main')
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

  // Handle hash navigation for direct links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#about') {
        setCurrentView('about')
      } else {
        setCurrentView('main')
      }
    }

    // Check initial hash on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleContentTypeChange = (newType: ContentType) => {
    setContentType(newType)
    // Announce content change to screen readers
    const announcement = `Now showing ${newType} content`
    const liveRegion = document.getElementById('content-change-announcement')
    if (liveRegion) {
      liveRegion.textContent = announcement
    }
  }

  const handleNavigation = (view: ViewType) => {
    setCurrentView(view)
    // Update URL hash to make it shareable
    if (view === 'about') {
      window.history.pushState(null, '', '#about')
    } else {
      window.history.pushState(null, '', '#')
    }
  }

  // Content type change handler (now handled by MainContent carousel)
  // Removed old swipe gesture implementation - now handled by carousel

  return (
    <>
      {/* Side menu as pure overlay */}
      <SideMenu 
        isOpen={isMenuOpen} 
        onOpenChange={setMenuOpen}
        onNavigate={handleNavigation}
      />
      
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span id="content-change-announcement"></span>
      </div>

      {/* App container - main content takes full viewport */}
      <div className="fixed inset-0 flex flex-col">
        {/* Main content area - full viewport height */}
        <main ref={mainContentRef} className="flex-1 relative overflow-hidden">
          {currentView === 'main' ? (
            <MainContent 
              contentType={contentType}
              onContentTypeChange={handleContentTypeChange}
            />
          ) : currentView === 'about' ? (
            <div className="h-full overflow-auto bg-background">
              <AboutUs />
            </div>
          ) : null}
        </main>

        {/* Unified header - floating overlay */}
        <UnifiedHeader
          isMenuOpen={isMenuOpen}
          onMenuOpenChange={setMenuOpen}
          showBackButton={currentView !== 'main'}
          onBackClick={() => handleNavigation('main')}
          backButtonLabel="Back to Home"
        />

        {/* Sticky category selector - floating overlay - only show on main view */}
        {currentView === 'main' && (
          <StickyCategorySelector 
            value={contentType}
            onChange={handleContentTypeChange}
          />
        )}
      </div>

      {/* Fixed bottom navigation */}
      <FooterNav />
    </>
  )
}