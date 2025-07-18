"use client"

import { useState } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import MainContent from "@/components/main-content-with-selector"
import StickyCategorySelector from "@/components/sticky-category-selector"
import DatabaseStatus from "@/components/database-status"
import LoadingSkeleton from "@/components/loading-skeleton"
import { ClientOnly } from "@/components/client-only"
import { ContentType } from "@/components/content-type-selector"

export default function HomePage() {
  const [contentType, setContentType] = useState<ContentType>('headlines')

  return (
    <div className="flex flex-col min-h-screen">
      <ClientOnly fallback={
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
      }>
        <Header />
      </ClientOnly>

      <ClientOnly fallback={
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border h-[73px]" />
      }>
        <StickyCategorySelector value={contentType} onChange={setContentType} />
      </ClientOnly>

      <main className="flex-1 pb-20 pt-[73px] overscroll-contain">
        <ClientOnly fallback={<LoadingSkeleton />}>
          <MainContent contentType={contentType} />
        </ClientOnly>
      </main>

      <ClientOnly fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe h-[76px]" />
      }>
        <FooterNav />
      </ClientOnly>
    </div>
  )
}
