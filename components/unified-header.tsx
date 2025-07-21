"use client"

import Logo from "./logo"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { ContentTypeSelector, ContentType } from "./content-type-selector"
import { cn } from "@/lib/utils"
import { useScrollDirection } from "@/hooks/use-scroll-direction"
import { useRef, useEffect } from "react"

interface UnifiedHeaderProps {
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  contentType: ContentType
  onContentTypeChange: (type: ContentType) => void
  scrollContainerRef?: React.RefObject<HTMLElement>
}

export default function UnifiedHeader({ 
  isMenuOpen, 
  onMenuOpenChange,
  contentType,
  onContentTypeChange,
  scrollContainerRef
}: UnifiedHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const { scrollDirection, isNearTop } = useScrollDirection(
    scrollContainerRef || { current: null }
  )

  const shouldHide = scrollDirection === 'down' && !isNearTop

  return (
    <>
      <header 
        ref={headerRef}
        className={cn(
          "sticky top-0 z-40 bg-background border-b border-border",
          "transition-transform duration-300 ease-out",
          shouldHide && "-translate-y-full"
        )}
      >
        {/* Top section with logo and menu */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="w-11 h-11 p-0 text-foreground hover:bg-muted touch-manipulation"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => onMenuOpenChange?.(!isMenuOpen)}
            >
              <div className="relative w-6 h-6">
                <Menu className={cn(
                  "h-6 w-6 absolute transition-all duration-200",
                  isMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'
                )} />
                <X className={cn(
                  "h-6 w-6 absolute transition-all duration-200",
                  isMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'
                )} />
              </div>
            </Button>
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Logo />
          </div>

          <div className="flex items-center">
            {/* Reserved space for balance */}
            <div className="w-11 h-11" />
          </div>
        </div>
      </header>

      {/* Category selector - separate from header */}
      <div 
        className={cn(
          "sticky top-[57px] z-30 px-2 py-3",
          "transition-transform duration-300 ease-out",
          shouldHide && "-translate-y-full"
        )}
      >
        <ContentTypeSelector value={contentType} onChange={onContentTypeChange} />
      </div>
    </>
  )
}