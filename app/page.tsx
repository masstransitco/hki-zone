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

      <main className="flex-1 pb-20">
        <div className="sticky top-16 z-10 bg-background/80 apple-blur border-b border-[rgb(var(--apple-gray-5))]">
          <TopicChips />
        </div>

        <div className="p-4">
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
