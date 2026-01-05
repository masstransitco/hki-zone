"use client"

import Logo from "./logo"
import { Button } from "@/components/ui/button"
import { Menu, X, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { useRef } from "react"

interface UnifiedHeaderProps {
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  showBackButton?: boolean
  onBackClick?: () => void
  backButtonLabel?: string
}

export default function UnifiedHeader({
  isMenuOpen,
  onMenuOpenChange,
  showBackButton = false,
  onBackClick,
  backButtonLabel = "Back"
}: UnifiedHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const { isHeaderVisible } = useHeaderVisibility()

  const shouldHide = !isHeaderVisible

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-40 bg-background",
        "transition-transform duration-300 ease-out",
        shouldHide && "-translate-y-full"
      )}
      style={{
        overscrollBehavior: 'none',
        touchAction: 'pan-x pinch-zoom'
      }}
    >
      {/* Top section with logo and menu */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center w-11">
          {showBackButton ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-11 h-11 p-0 text-foreground hover:bg-muted touch-manipulation"
              aria-label={backButtonLabel}
              onClick={onBackClick}
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          ) : (
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
          )}
        </div>

        <div className="flex-1 flex justify-center">
          <Logo />
        </div>

        {/* Empty spacer to balance the layout */}
        <div className="w-11" />
      </div>
    </header>
  )
}