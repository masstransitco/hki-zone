"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import SellTwoToneIcon from '@mui/icons-material/SellTwoTone'
import AddBoxIcon from '@mui/icons-material/AddBox'
import NewspaperTwoToneIcon from '@mui/icons-material/NewspaperTwoTone'
import TurnedInIcon from '@mui/icons-material/TurnedIn'
import { cn } from "@/lib/utils"
import CategoryMenuBottomSheet from "./category-menu-bottom-sheet"

const navItems = [
  { href: "/", icon: NewspaperTwoToneIcon, label: "Topics", labelKey: "nav.topics" },
  { href: "/bookmarks", icon: TurnedInIcon, label: "Bookmarks", labelKey: "nav.bookmarks" },
]

export default function FooterNav() {
  const pathname = usePathname()
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl min-w-[52px] min-h-[52px] touch-manipulation",
                  "transition-colors duration-150",
                  isActive 
                    ? "text-stone-800 dark:text-stone-200 bg-stone-200/60 dark:bg-stone-700/60" 
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100/60 dark:hover:bg-stone-800/60",
                  "active:scale-95 active:transition-transform active:duration-100"
                )}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-6 h-6" />
              </Link>
            )
          })}
          
          <button
            onClick={() => setIsBottomSheetOpen(true)}
            className={cn(
              "flex items-center justify-center p-3 rounded-xl min-w-[52px] min-h-[52px] touch-manipulation",
              "transition-colors duration-150",
              "text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-stone-100",
              "hover:bg-stone-100/60 dark:hover:bg-stone-800/60",
              "active:scale-95 active:transition-transform active:duration-100"
            )}
            aria-label="Open category menu"
          >
            <AddBoxIcon className="w-6 h-6" />
          </button>

          <Link
            href="/marketplace"
            className={cn(
              "flex items-center justify-center p-3 rounded-xl min-w-[52px] min-h-[52px] touch-manipulation",
              "transition-colors duration-150",
              pathname === "/marketplace" 
                ? "text-stone-800 dark:text-stone-200 bg-stone-200/60 dark:bg-stone-700/60" 
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100/60 dark:hover:bg-stone-800/60",
              "active:scale-95 active:transition-transform active:duration-100"
            )}
            aria-label="Marketplace"
            aria-current={pathname === "/marketplace" ? "page" : undefined}
          >
            <SellTwoToneIcon className="w-6 h-6" />
          </Link>
        </div>
      </nav>
      
      <CategoryMenuBottomSheet 
        isOpen={isBottomSheetOpen} 
        onClose={() => setIsBottomSheetOpen(false)} 
      />
    </>
  )
}
