import { Suspense } from "react"
import Header from "@/components/header"
import TopicsFeed from "@/components/topics-feed"
import LoadingSkeleton from "@/components/loading-skeleton"

export default function TopicsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-4">
        <Suspense fallback={<LoadingSkeleton />}>
          <TopicsFeed />
        </Suspense>
      </main>
    </div>
  )
}
