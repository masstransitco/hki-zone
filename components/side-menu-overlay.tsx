"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import LiveNewsIndicator from "./live-news-indicator"
import LanguageSelector from "./language-selector"
import ThemeToggle from "./theme-toggle"
import { cn } from "@/lib/utils"
import { useSwipeGesture } from "@/hooks/use-swipe-gesture"

interface SideMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function SideMenu({ isOpen, onOpenChange }: SideMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Use swipe gesture for menu dismissal
  useSwipeGesture(menuRef, {
    onSwipeLeft: () => onOpenChange(false),
    threshold: 30,
    enabled: isOpen
  })

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onOpenChange])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      
      {/* Side Menu */}
      <div
        ref={menuRef}
        className={cn(
          "fixed left-0 top-0 h-full w-80 max-w-[85vw] z-50",
          "bg-background border-r border-border shadow-2xl",
          "flex flex-col gap-6 p-6",
          "animate-in slide-in-from-left-full duration-200"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">Menu</h2>
            <p className="text-sm text-muted-foreground">Settings and information</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-11 h-11 p-0 text-foreground hover:bg-muted touch-manipulation"
            onClick={() => onOpenChange(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">System Status</h3>
            <div className="pl-2">
              <LiveNewsIndicator />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Language</h3>
            <div className="pl-2">
              <LanguageSelector />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-foreground">Theme</h3>
            <div className="pl-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}