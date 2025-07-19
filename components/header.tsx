"use client"

import Logo from "./logo"
import SideMenu from "./side-menu"
import { useHeaderVisibility } from "@/hooks/use-header-visibility"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

interface HeaderProps {
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export default function Header({ isMenuOpen, onMenuOpenChange }: HeaderProps) {
  const { isVisible } = useHeaderVisibility()

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-minimal border-b border-border transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="w-9 h-9 p-0 text-foreground hover:bg-muted"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => onMenuOpenChange(!isMenuOpen)}
          >
            <div className="relative w-5 h-5">
              <Menu className={`h-5 w-5 absolute transition-all duration-200 ${isMenuOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`} />
              <X className={`h-5 w-5 absolute transition-all duration-200 ${isMenuOpen ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`} />
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
