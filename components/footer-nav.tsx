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
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 apple-blur border-t border-[rgb(var(--apple-gray-5))] safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ href, icon: Icon, labelKey }) => {
          const isActive = pathname === href
          const label = t(labelKey)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors apple-focus min-w-[60px]",
                isActive ? "text-[rgb(var(--apple-blue))]" : "text-[rgb(var(--apple-gray-1))] hover:text-foreground",
              )}
              aria-label={label}
            >
              <Icon className="w-5 h-5" />
              <span className="text-caption-2">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
