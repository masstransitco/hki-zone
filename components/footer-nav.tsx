"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Hash, Search, User, Newspaper, Sparkles, Car, Hospital } from "lucide-react"
import RssFeedTwoToneIcon from '@mui/icons-material/RssFeedTwoTone'
import SellTwoToneIcon from '@mui/icons-material/SellTwoTone'
import OnlinePredictionTwoToneIcon from '@mui/icons-material/OnlinePredictionTwoTone'
import NewspaperTwoToneIcon from '@mui/icons-material/NewspaperTwoTone'
import LocalHospitalTwoToneIcon from '@mui/icons-material/LocalHospitalTwoTone'
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", icon: NewspaperTwoToneIcon, label: "Topics", labelKey: "nav.topics" },
  { href: "/signals", icon: OnlinePredictionTwoToneIcon, label: "Signals", labelKey: "nav.signals" },
  { href: "/headlines", icon: RssFeedTwoToneIcon, label: "News", labelKey: "nav.news" },
  { href: "/cars", icon: SellTwoToneIcon, label: "Cars", labelKey: "nav.cars" },
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
