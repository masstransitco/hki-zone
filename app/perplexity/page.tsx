import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import PerplexityFeed from "@/components/perplexity-feed"
import LoadingSkeleton from "@/components/loading-skeleton"

export const metadata = {
  title: "AI News | Panora.hk",
  description: "AI-generated Hong Kong news powered by Perplexity, featuring fresh content across politics, business, technology, health, lifestyle, and entertainment",
}

export default function PerplexityPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 pb-20">
        <Suspense fallback={<LoadingSkeleton />}>
          <PerplexityFeed />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}