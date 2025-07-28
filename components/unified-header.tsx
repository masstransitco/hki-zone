"use client"

import Logo from "./logo"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import AddBoxIcon from '@mui/icons-material/AddBox'
import { cn } from "@/lib/utils"
import { useHeaderVisibility } from "@/contexts/header-visibility"
import { useRef, useState } from "react"
import CategoryMenuBottomSheet from "./category-menu-bottom-sheet"

interface UnifiedHeaderProps {
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

export default function UnifiedHeader({ 
  isMenuOpen, 
  onMenuOpenChange
}: UnifiedHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const { isHeaderVisible } = useHeaderVisibility()
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false)

  const shouldHide = !isHeaderVisible

  return (
    <header 
      ref={headerRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-40 bg-background",
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
          <Button
            variant="ghost"
            size="sm"
            className="w-11 h-11 p-0 text-foreground hover:bg-muted touch-manipulation"
            aria-label="Open category menu"
            onClick={() => setIsBottomSheetOpen(true)}
          >
            <AddBoxIcon className="w-6 h-6" />
          </Button>
        </div>
      </div>
      
      <CategoryMenuBottomSheet 
        isOpen={isBottomSheetOpen} 
        onClose={() => setIsBottomSheetOpen(false)} 
      />
    </header>
  )
}