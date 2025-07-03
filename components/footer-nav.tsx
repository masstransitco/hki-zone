"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Hash, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "./language-provider"

const navItems = [
  { href: "/", icon: Home, labelKey: "nav.home" },
  { href: "/topics", icon: Hash, labelKey: "nav.topics" },
  { href: "/search", icon: Search, labelKey: "nav.search" },
  { href: "/profile", icon: User, labelKey: "nav.profile" },
]

export default function FooterNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-stone-200/60 dark:border-neutral-700/60 pb-safe">
      <div className="flex items-center justify-around py-3 px-2">
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const isActive = pathname === href
          const label = t(labelKey)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 min-w-[64px] group",
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
              <span className={cn(
                "text-xs font-medium transition-colors duration-200",
                isActive ? "text-stone-800 dark:text-stone-200" : "text-stone-500 dark:text-stone-400"
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
