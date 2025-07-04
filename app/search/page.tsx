"use client"

import { Suspense } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import SearchInterface from "@/components/search-interface"

export default function SearchPage() {
  const handleSearch = (query: string) => {
    console.log('Search:', query)
  }

  const handleClear = () => {
    console.log('Clear search')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header showSearch={false} />

      <main className="flex-1 pb-20">
        <Suspense>
          <SearchInterface 
            onSearch={handleSearch}
            onClear={handleClear}
          />
        </Suspense>
      </main>

      <FooterNav />
    </div>
  )
}
