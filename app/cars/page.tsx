"use client"

import { Suspense, useState } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import SideMenu from "@/components/side-menu"
import CarsPageWithSelector from "@/components/cars-page-with-selector"
import LoadingSkeleton from "@/components/loading-skeleton"
import { ClientOnly } from "@/components/client-only"

export default function CarsPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen">
      <SideMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
      
      {/* Main App Content with Push Effect */}
      <div 
        className={`flex flex-col min-h-screen bg-background transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-80 max-sm:translate-x-[80vw]' : 'translate-x-0'
        }`}
      >
        <ClientOnly fallback={
          <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
        }>
          <Header isMenuOpen={isMenuOpen} onMenuOpenChange={setIsMenuOpen} />
        </ClientOnly>

        <main className="flex-1 pb-20 pt-16">
          <div className="py-6">
            <ClientOnly fallback={<CarsLoadingSkeleton />}>
              <Suspense fallback={<CarsLoadingSkeleton />}>
                <CarsPageWithSelector />
              </Suspense>
            </ClientOnly>
          </div>
        </main>
      </div>

      {/* Footer Nav - Fixed and outside push effect */}
      <ClientOnly fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe h-[76px]" />
      }>
        <FooterNav />
      </ClientOnly>
    </div>
  )
}

function CarsLoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6">
      <div className="py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          <div className="h-10 w-24 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
        
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="border border-stone-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
              {/* Image skeleton */}
              <div className="aspect-[4/3] bg-stone-200 dark:bg-neutral-700 animate-pulse" />
              
              {/* Content skeleton */}
              <div className="p-5 space-y-4">
                {/* Title and price */}
                <div className="space-y-2">
                  <div className="h-6 w-4/5 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                </div>
                
                {/* Specs */}
                <div className="space-y-2">
                  <div className="h-4 w-1/3 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-4 w-full bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                    <div className="h-4 w-full bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                    <div className="h-4 w-full bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                    <div className="h-4 w-full bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                  </div>
                </div>
                
                {/* Footer */}
                <div className="flex justify-between items-center pt-2">
                  <div className="h-4 w-20 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-stone-200 dark:bg-neutral-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}