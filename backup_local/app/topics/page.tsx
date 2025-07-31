import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import TopicsFeed from "@/components/topics-feed"
import LoadingSkeleton from "@/components/loading-skeleton"

export default function TopicsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-20">
        <Suspense fallback={<LoadingSkeleton />}>
          <TopicsFeed />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}
