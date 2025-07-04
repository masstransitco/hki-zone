import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import NewsFeed from "@/components/news-feed"
import TopicChips from "@/components/topic-chips"
import LoadingSkeleton from "@/components/loading-skeleton"
import DatabaseStatus from "@/components/database-status"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-20 pt-16 overscroll-contain">
        {/* Category selector buttons - temporarily disabled for cleaner UI */}
        {/* <div className="sticky top-16 z-10 bg-background/90 backdrop-minimal border-b border-border">
          <TopicChips />
        </div> */}

        <div className="px-6 pt-4 pb-2">
          <Suspense fallback={null}>
            <DatabaseStatus />
          </Suspense>
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <NewsFeed />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}
