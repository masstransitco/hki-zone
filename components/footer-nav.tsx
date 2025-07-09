"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Hash, Search, User, Newspaper, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: Home, label: "Home", labelKey: "nav.home" },
  // { href: "/headlines", icon: Newspaper, label: "Headlines", labelKey: "nav.headlines" },
  { href: "/perplexity", icon: Sparkles, label: "AI News", labelKey: "nav.perplexity" },
  { href: "/topics", icon: Hash, label: "Topics", labelKey: "nav.topics" },
  // { href: "/search", icon: Search, label: "Search", labelKey: "nav.search" },
  // { href: "/profile", icon: User, label: "Profile", labelKey: "nav.profile" },
]

export default function FooterNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe">
      <div className="flex items-center justify-around py-3 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-center p-3 rounded-lg transition-all duration-200 min-w-[48px] min-h-[48px] group",
                isActive 
                  ? "text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800" 
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900"
              )}
              aria-label={label}
            >
              <Icon className={cn(
                "w-5 h-5 transition-transform duration-200",
                isActive ? "scale-110" : "group-hover:scale-105"
              )} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
