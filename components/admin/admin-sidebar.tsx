"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  Database,
  LayoutDashboard,
  FileText,
  Settings,
  Activity,
  Car,
  Radio,
  Mic,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Create context for sidebar state
const SidebarContext = React.createContext<{
  isMinimized: boolean
  setIsMinimized: (value: boolean) => void
}>({
  isMinimized: false,
  setIsMinimized: () => {}
})

const navigationItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    description: "Pipeline metrics & system controls",
  },
  {
    title: "Articles",
    url: "/admin/articles",
    icon: FileText,
    description: "Review & manage content",
  },
  {
    title: "News Briefs",
    url: "/admin/news-briefs",
    icon: Mic,
    description: "TTS news brief management",
  },
  {
    title: "Cars",
    url: "/admin/cars",
    icon: Car,
    description: "Vehicle listings management",
  },
  {
    title: "Signals",
    url: "/admin/signals",
    icon: Radio,
    description: "Government feeds & alerts",
  },
  {
    title: "Chat",
    url: "/admin/chat",
    icon: MessageSquare,
    description: "Article chat monitoring",
  },
  {
    title: "Database",
    url: "/admin/database",
    icon: Database,
    description: "Data management & setup",
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    description: "System configuration",
  },
]

// Desktop Sidebar Component
function DesktopSidebar() {
  const pathname = usePathname()
  const { isMinimized, setIsMinimized } = useSidebar()

  const handleNavigation = () => {
    setIsMinimized(true)
  }

  return (
    <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:bg-gray-900 lg:border-r lg:border-gray-800 transition-all duration-300 ${
      isMinimized ? 'lg:w-16' : 'lg:w-64'
    }`}>
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-3" onClick={handleNavigation}>
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image
              src="/logos/hki-logomark.svg"
              alt="HKI"
              width={32}
              height={32}
              className="w-full h-full brightness-0 invert"
            />
          </div>
          {!isMinimized && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white">Admin</span>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMinimized(!isMinimized)}
          className={`ml-auto text-gray-400 hover:text-white hover:bg-gray-800 ${isMinimized ? 'w-8 h-8 p-0' : ''}`}
        >
          {isMinimized ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.url || 
            (item.url !== "/admin" && pathname.startsWith(item.url))
          
          return (
            <Link
              key={item.title}
              href={item.url}
              onClick={handleNavigation}
              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              title={isMinimized ? item.title : undefined}
            >
              <item.icon className={`flex-shrink-0 h-5 w-5 ${
                isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
              } ${isMinimized ? '' : 'mr-3'}`} />
              {!isMinimized && (
                <span className="truncate">{item.title}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className={`flex items-center gap-3 px-3 py-2 ${isMinimized ? 'justify-center' : ''}`}>
          <div className="flex-shrink-0">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
          {!isMinimized && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300">System Online</p>
              <p className="text-xs text-gray-500">All services operational</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Mobile Sidebar Component
function MobileSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="fixed top-4 left-4 z-40 bg-gray-800/90 backdrop-blur-sm border border-gray-700 shadow-sm text-white hover:bg-gray-700"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-gray-900 border-gray-800">
          <div className="flex flex-col h-full bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
              <Link href="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <div className="relative w-8 h-8">
                  <Image
                    src="/logos/hki-logomark.svg"
                    alt="HKI"
                    width={32}
                    height={32}
                    className="w-full h-full brightness-0 invert"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">Admin</span>
                </div>
              </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {navigationItems.map((item) => {
                const isActive = pathname === item.url || 
                  (item.url !== "/admin" && pathname.startsWith(item.url))
                
                return (
                  <Link
                    key={item.title}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                    }`} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-300">System Online</p>
                  <p className="text-xs text-gray-500">All services operational</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMinimized, setIsMinimized] = React.useState(false)

  return (
    <SidebarContext.Provider value={{ isMinimized, setIsMinimized }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return React.useContext(SidebarContext)
}

export default function AdminSidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  )
}