"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import LiveNewsIndicator from "./live-news-indicator"
import LanguageSelector from "./language-selector"
import ThemeToggle from "./theme-toggle"
import { cn } from "@/lib/utils"

interface SideMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function SideMenu({ isOpen, onOpenChange }: SideMenuProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onOpenChange])

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300" 
          onClick={() => onOpenChange(false)}
        />
      )}
      
      {/* Side Menu */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-80 max-w-[80vw] z-50 bg-background border-r border-border shadow-lg",
          "flex flex-col gap-6 p-6 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">Menu</h2>
            <p className="text-sm text-muted-foreground">Settings and information</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0 text-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
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