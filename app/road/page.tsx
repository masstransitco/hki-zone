"use client"

import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import JourneyTimeList from "@/components/journey-time-list"
import DatabaseStatus from "@/components/database-status"
import { ClientOnly } from "@/components/client-only"

export default function RoadPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <ClientOnly fallback={
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
      }>
        <Header />
      </ClientOnly>

      <main className="flex-1 pb-20 pt-16 overscroll-contain">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Roads & Traffic</h1>
            <p className="text-muted-foreground">Real-time journey times and traffic information</p>
          </div>
          
          <ClientOnly fallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <JourneyTimeList 
              showFilters={true}
              autoRefresh={true}
              refreshInterval={2 * 60 * 1000}
            />
          </ClientOnly>
        </div>
      </main>

      <ClientOnly fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe h-[76px]" />
      }>
        <FooterNav />
      </ClientOnly>
    </div>
  )
}