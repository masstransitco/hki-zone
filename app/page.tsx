"use client"

import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import NewsFeed from "@/components/news-feed"
import DatabaseStatus from "@/components/database-status"
import LoadingSkeleton from "@/components/loading-skeleton"
import { ClientOnly } from "@/components/client-only"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <ClientOnly fallback={
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
      }>
        <Header />
      </ClientOnly>

      <main className="flex-1 pb-20 pt-16 overscroll-contain">
        {/* Category selector buttons - temporarily disabled for cleaner UI */}
        {/* <div className="sticky top-16 z-10 bg-background/90 backdrop-minimal border-b border-border">
          <TopicChips />
        </div> */}

        <div className="px-6 pt-4 pb-2">
          <ClientOnly>
            <DatabaseStatus />
          </ClientOnly>
        </div>

        <ClientOnly fallback={<LoadingSkeleton />}>
          <NewsFeed />
        </ClientOnly>
      </main>

      <ClientOnly fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe h-[76px]" />
      }>
        <FooterNav />
      </ClientOnly>
    </div>
  )
}
