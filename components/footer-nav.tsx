"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import TurnedInIcon from '@mui/icons-material/TurnedIn'
import TurnedInNotIcon from '@mui/icons-material/TurnedInNot'
import { cn } from "@/lib/utils"

// Custom newsfeed icon component
const NewsfeedIcon = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <div className="relative flex items-center justify-center">
    {isActive && (
      <div className="absolute inset-0 bg-blue-500 scale-75" />
    )}
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" className={cn(className, "relative z-10")}>
      <path d="M120-120v-720h720v720H120Zm600-160H240v60h480v-60Zm-480-60h480v-60H240v60Zm0-140h480v-240H240v240Zm0 200v60-60Zm0-60v-60 60Zm0-140v-240 240Zm0 80v-80 80Zm0 120v-60 60Z"/>
    </svg>
  </div>
)

// Custom bookmark icon component
const BookmarkIcon = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <div className="relative flex items-center justify-center">
    {isActive && (
      <TurnedInIcon className={cn(className, "absolute text-blue-500")} />
    )}
    <TurnedInNotIcon className={cn(className, "relative z-10", isActive ? "text-white" : "text-current")} />
  </div>
)

// Custom marketplace icon component - price tag icons
const MarketplaceIcon = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <div className="relative flex items-center justify-center">
    {isActive && (
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" className={cn(className, "absolute text-blue-500")}>
        <path d="M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Z"/>
      </svg>
    )}
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" className={cn(className, "relative z-10", isActive ? "text-white" : "text-current")}>
      <path d="M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM513-160l286-286-353-354H160v286l353 354ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm220 160Z"/>
    </svg>
  </div>
)

const navItems = [
  { 
    href: "/", 
    icon: NewsfeedIcon, 
    label: "Topics", 
    labelKey: "nav.topics" 
  },
  { 
    href: "/marketplace", 
    icon: MarketplaceIcon, 
    label: "Marketplace", 
    labelKey: "nav.marketplace" 
  },
  { 
    href: "/bookmarks", 
    icon: BookmarkIcon, 
    label: "Bookmarks", 
    labelKey: "nav.bookmarks" 
  },
]

export default function FooterNav() {
  const pathname = usePathname()

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map(({ href, icon, label }) => {
            const isActive = pathname === href
            const IconComponent = icon
            
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center justify-center p-3 rounded-xl min-w-[52px] min-h-[52px] touch-manipulation",
                  "transition-colors duration-150",
                  // Special color handling for newsfeed (white text when active)
                  href === "/" && isActive 
                    ? "text-white" 
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300",
                  "active:scale-95 active:transition-transform active:duration-100"
                )}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <IconComponent className="w-6 h-6" isActive={isActive} />
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
