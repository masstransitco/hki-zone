"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, Hash, Search, User, Newspaper, Sparkles, Car, Hospital } from "lucide-react"
import SellTwoToneIcon from '@mui/icons-material/SellTwoTone'
import AddBoxIcon from '@mui/icons-material/AddBox'
import NewspaperTwoToneIcon from '@mui/icons-material/NewspaperTwoTone'
import LocalHospitalTwoToneIcon from '@mui/icons-material/LocalHospitalTwoTone'
import { cn } from "@/lib/utils"
import CategoryMenuBottomSheet from "./category-menu-bottom-sheet"

const navItems = [
  { href: "/", icon: NewspaperTwoToneIcon, label: "Topics", labelKey: "nav.topics" },
]

export default function FooterNav() {
  const pathname = usePathname()
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)
  const [pressedItem, setPressedItem] = useState<string | null>(null)

  const handlePress = (itemId: string) => {
    setPressedItem(itemId)
    // Haptic-style visual feedback
    setTimeout(() => setPressedItem(null), 150)
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href
            const isPressed = pressedItem === href

            return (
              <Link
                key={href}
                href={href}
                onMouseDown={() => handlePress(href)}
                onTouchStart={() => handlePress(href)}
                className={cn(
                  "relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-[52px] min-h-[52px] group touch-manipulation",
                  "before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300",
                  isActive 
                    ? "text-stone-800 dark:text-stone-200 before:bg-stone-200/80 dark:before:bg-stone-700/80 before:scale-100" 
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 before:bg-stone-100 dark:before:bg-stone-800 before:scale-0 hover:before:scale-100",
                  isPressed && "scale-95"
                )}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={cn(
                  "relative z-10 flex flex-col items-center gap-1",
                  "transition-transform duration-200",
                  isActive ? "translate-y-[-2px]" : ""
                )}>
                  <Icon className={cn(
                    "w-6 h-6 transition-all duration-300",
                    isActive ? "scale-110 drop-shadow-sm" : "group-hover:scale-105"
                  )} />
                  {isActive && (
                    <span className="absolute -bottom-2 w-1 h-1 bg-stone-600 dark:bg-stone-300 rounded-full animate-pulse" />
                  )}
                </span>
              </Link>
            )
          })}
          
          <button
            onClick={() => setIsBottomSheetOpen(true)}
            onMouseDown={() => handlePress('menu')}
            onTouchStart={() => handlePress('menu')}
            className={cn(
              "relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-[52px] min-h-[52px] group touch-manipulation",
              "before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300",
              "text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-stone-100",
              "before:bg-stone-100 dark:before:bg-stone-800 before:scale-0 hover:before:scale-100",
              pressedItem === 'menu' && "scale-95"
            )}
            aria-label="Open category menu"
          >
            <span className="relative z-10">
              <AddBoxIcon className={cn(
                "w-6 h-6 transition-all duration-300",
                "group-hover:scale-110 group-hover:rotate-90"
              )} />
            </span>
          </button>

          <Link
            href="/cars"
            onMouseDown={() => handlePress('/cars')}
            onTouchStart={() => handlePress('/cars')}
            className={cn(
              "relative flex items-center justify-center p-3 rounded-xl transition-all duration-200 min-w-[52px] min-h-[52px] group touch-manipulation",
              "before:absolute before:inset-0 before:rounded-xl before:transition-all before:duration-300",
              pathname === "/cars" 
                ? "text-stone-800 dark:text-stone-200 before:bg-stone-200/80 dark:before:bg-stone-700/80 before:scale-100" 
                : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 before:bg-stone-100 dark:before:bg-stone-800 before:scale-0 hover:before:scale-100",
              pressedItem === '/cars' && "scale-95"
            )}
            aria-label="Cars"
            aria-current={pathname === "/cars" ? "page" : undefined}
          >
            <span className={cn(
              "relative z-10 flex flex-col items-center gap-1",
              "transition-transform duration-200",
              pathname === "/cars" ? "translate-y-[-2px]" : ""
            )}>
              <SellTwoToneIcon className={cn(
                "w-6 h-6 transition-all duration-300",
                pathname === "/cars" ? "scale-110 drop-shadow-sm" : "group-hover:scale-105"
              )} />
              {pathname === "/cars" && (
                <span className="absolute -bottom-2 w-1 h-1 bg-stone-600 dark:bg-stone-300 rounded-full animate-pulse" />
              )}
            </span>
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
