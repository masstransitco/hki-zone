"use client"

import Logo from "./logo"
import SideMenu from "./side-menu"
import { useHeaderVisibility } from "@/hooks/use-header-visibility"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

interface HeaderProps {
  isMenuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
}

export default function Header({ isMenuOpen = false, onMenuOpenChange }: HeaderProps) {
  const { isVisible } = useHeaderVisibility()

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-sm border-b border-border transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)'
      }}
    >
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
              <Menu className={`h-6 w-6 absolute transition-all duration-200 ${isMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`} />
              <X className={`h-6 w-6 absolute transition-all duration-200 ${isMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`} />
            </div>
          </Button>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2">
          <Logo />
        </div>

        <div className="flex items-center">
          {/* Reserved space for potential future controls */}
        </div>
      </div>
    </header>
  )
}
