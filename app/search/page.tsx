import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import SearchInterface from "@/components/search-interface"

export default function SearchPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header showSearch={false} />

      <main className="flex-1 pb-20">
        <Suspense>
          <SearchInterface 
            onSearch={(query) => console.log('Search:', query)}
            onClear={() => console.log('Clear search')}
          />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}
