import { Suspense } from "react"
import Header from "@/components/header"
import NewsFeedMasonry from "@/components/news-feed-masonry"
import DatabaseStatus from "@/components/database-status"
import LoadingSkeleton from "@/components/loading-skeleton"
import { ClientOnly } from "@/components/client-only"

export const metadata = {
  title: "News | Panora.hk",
  description: "Latest news articles from Hong Kong news sources",
}

export default function NewsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <ClientOnly fallback={
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
      }>
        <Header />
      </ClientOnly>

      <main className="flex-1 pb-4 pt-16 overscroll-contain">
        <div className="px-6 pt-4 pb-2">
          <ClientOnly>
            <DatabaseStatus />
          </ClientOnly>
        </div>

        <ClientOnly fallback={<LoadingSkeleton />}>
          <NewsFeedMasonry />
        </ClientOnly>
      </main>
    </div>
  )
}