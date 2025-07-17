import { Suspense } from "react"
import { Metadata } from "next"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import CarsPageWithSelector from "@/components/cars-page-with-selector"
import LoadingSkeleton from "@/components/loading-skeleton"

export const metadata: Metadata = {
  title: "Cars | Panora",
  description: "Latest car listings and automotive news from Hong Kong. Find your perfect vehicle from trusted dealers.",
  keywords: ["Hong Kong cars", "car listings", "automotive", "vehicles", "28car"],
  openGraph: {
    title: "Cars | Panora",
    description: "Latest car listings and automotive news from Hong Kong",
    type: "website",
    siteName: "Panora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cars | Panora",
    description: "Latest car listings and automotive news from Hong Kong",
  },
}

export default function CarsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 pb-20">
        <div className="py-6">
          <Suspense fallback={<CarsLoadingSkeleton />}>
            <CarsPageWithSelector />
          </Suspense>
        </div>
      </main>
      <FooterNav />
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