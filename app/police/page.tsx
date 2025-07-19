"use client"

import { useState } from "react"
import Header from "@/components/header"
import FooterNav from "@/components/footer-nav"
import SideMenu from "@/components/side-menu"
import PoliceStationsList from "@/components/police-stations-list"
import { ClientOnly } from "@/components/client-only"
import { useLanguage } from "@/components/language-provider"

export default function PolicePage() {
  const { language } = useLanguage()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen">
      <SideMenu isOpen={isMenuOpen} onOpenChange={setIsMenuOpen} />
      
      {/* Main App Content with Push Effect */}
      <div 
        className={`flex flex-col min-h-screen transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-80 max-sm:translate-x-[80vw]' : 'translate-x-0'
        }`}
      >
        <ClientOnly fallback={
          <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border h-[57px]" />
        }>
          <Header isMenuOpen={isMenuOpen} onMenuOpenChange={setIsMenuOpen} />
        </ClientOnly>

        <main className="flex-1 pb-20 pt-16 overscroll-contain">
          <div className="container mx-auto px-4 py-6">
            <ClientOnly fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            }>
              <PoliceStationsList 
                showFilters={true}
                autoRefresh={false}
                refreshInterval={30 * 60 * 1000}
              />
            </ClientOnly>
          </div>
        </main>
      </div>

      {/* Footer Nav - Fixed and outside push effect */}
      <ClientOnly fallback={
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe h-[76px]" />
      }>
        <FooterNav />
      </ClientOnly>
    </div>
  )
}