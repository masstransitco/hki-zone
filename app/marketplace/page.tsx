"use client"

import { Suspense, useState, useRef } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import SideMenu from "@/components/side-menu-overlay"
import StickyMarketplaceSelector from "@/components/sticky-marketplace-selector"
import MarketplaceContent from "@/components/marketplace-content"
import { MarketplaceCategoryType } from "@/components/marketplace-category-selector"
import { useSwipeGesture } from "@/hooks/use-swipe-gesture"

const categoryTypes: MarketplaceCategoryType[] = ['cars', 'carparks'];

export default function MarketplacePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [category, setCategory] = useState<MarketplaceCategoryType>('cars')
  const mainContentRef = useRef<HTMLDivElement>(null)

  const handleCategoryChange = (newCategory: MarketplaceCategoryType) => {
    setCategory(newCategory)
  }

  // Handle content swipe gestures
  const handleSwipeLeft = () => {
    const currentIndex = categoryTypes.indexOf(category)
    const nextIndex = (currentIndex + 1) % categoryTypes.length
    handleCategoryChange(categoryTypes[nextIndex])
  }

  const handleSwipeRight = () => {
    const currentIndex = categoryTypes.indexOf(category)
    const prevIndex = (currentIndex - 1 + categoryTypes.length) % categoryTypes.length
    handleCategoryChange(categoryTypes[prevIndex])
  }

  // Enable swipe gestures on main content area
  useSwipeGesture(mainContentRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 60,
    enabled: !isMenuOpen
  })

  return (
    <>
      <SideMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
      
      {/* Fixed container - matches main app structure */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Main content area */}
        <main ref={mainContentRef} className="absolute inset-0">
          <MarketplaceContent category={category} />
        </main>

        {/* Fixed header */}
        <Header isMenuOpen={isMenuOpen} onMenuOpenChange={setIsMenuOpen} />

        {/* Sticky category selector */}
        <StickyMarketplaceSelector 
          value={category}
          onChange={handleCategoryChange}
        />
      </div>

      {/* Fixed bottom navigation */}
      <FooterNav />
    </>
  )
}