import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import HeadlinesFeed from "@/components/headlines-feed"
import LoadingSkeleton from "@/components/loading-skeleton"

export const metadata = {
  title: "Headlines | Panora.hk",
  description: "Top 10 headlines by category from Hong Kong news sources",
}

export default function HeadlinesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-20">
        <div className="py-6">
          <div className="px-6 mb-6">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
              Today's Headlines
            </h1>
            <p className="text-stone-600 dark:text-stone-400">
              Top stories by category from Hong Kong news sources
            </p>
          </div>
          
          <Suspense fallback={<LoadingSkeleton />}>
            <HeadlinesFeed />
          </Suspense>
        </div>
      </main>

      <FooterNav />
    </div>
  )
}