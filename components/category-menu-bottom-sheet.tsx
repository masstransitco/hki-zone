"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useLanguage } from "@/components/language-provider"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription 
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface CategoryMenuBottomSheetProps {
  isOpen: boolean
  onClose: () => void
}


export default function CategoryMenuBottomSheet({ 
  isOpen, 
  onClose 
}: CategoryMenuBottomSheetProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const categories = [
    {
      id: "drive",
      label: "Drive",
      description: "Car sharing service",
      icon: "/menu-icons/drive.PNG",
      href: "https://www.masstransitcar.com/",
      isPlaceholder: false,
      isNewFeature: true,
      isExternal: true
    },
    {
      id: "road",
      label: t("categories.roads.label"),
      description: t("categories.roads.description"),
      icon: "/menu-icons/road.PNG",
      href: "/road",
      isPlaceholder: false
    },
    {
      id: "park",
      label: t("categories.park.label"),
      description: t("categories.park.description"),
      icon: "/menu-icons/park.PNG",
      href: "/parks",
      isPlaceholder: false
    },
    {
      id: "police",
      label: t("categories.police.label"),
      description: t("categories.police.description"),
      icon: "/menu-icons/police.PNG",
      href: "/police",
      isPlaceholder: false
    },
    {
      id: "ae",
      label: t("categories.ae.label"),
      description: t("categories.ae.description"),
      icon: "/menu-icons/ae.PNG",
      href: "/ae",
      isPlaceholder: false
    },
    {
      id: "weather",
      label: t("categories.weather.label"),
      description: t("categories.weather.description"),
      icon: "/menu-icons/observatory.PNG",
      href: "/weather",
      isPlaceholder: false
    },
    {
      id: "postbox",
      label: t("categories.postbox.label"),
      description: t("categories.postbox.description"),
      icon: "/menu-icons/postbox.PNG",
      href: "/postbox",
      isPlaceholder: true
    },
    {
      id: "trashbin",
      label: t("categories.trashbin.label"),
      description: t("categories.trashbin.description"),
      icon: "/menu-icons/orangebin.PNG",
      href: "/trashbin",
      isPlaceholder: true
    }
  ]

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      // iOS Safari specific fixes
      document.body.style.position = "fixed"
      document.body.style.width = "100%"
      document.body.style.height = "100%"
    } else {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.width = ""
      document.body.style.height = ""
    }
    
    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.width = ""
      document.body.style.height = ""
    }
  }, [isOpen])

  // Handle iOS Safari viewport changes
  React.useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      // Force a repaint to handle iOS Safari address bar changes
      if (window.visualViewport) {
        const height = window.visualViewport.height
        document.documentElement.style.setProperty('--vh', `${height * 0.01}px`)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      handleResize() // Initial call
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen])

  const handleCategoryClick = (href: string, isPlaceholder: boolean, isExternal?: boolean) => {
    if (isPlaceholder) {
      // Do nothing for placeholder cards
      return
    }
    onClose()
    
    if (isExternal) {
      // Open external link in new window
      window.open(href, '_blank', 'noopener,noreferrer')
    } else {
      router.push(href)
    }
  }

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose}
      shouldScaleBackground={true}
    >
      <DrawerContent 
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[16px] border bg-background",
          "focus:outline-none [&>div:first-child]:mt-2"
        )}
        style={{
          maxHeight: "calc(85vh - env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          marginBottom: "env(safe-area-inset-bottom, 0px)",
          // iOS Safari specific fixes
          WebkitTransform: "translateZ(0)",
          transform: "translateZ(0)",
          // Ensure proper viewport handling
          minHeight: "auto",
          height: "auto"
        }}
      >
        <div className="relative px-6 pt-4 pb-2 shrink-0">
          
        </div>
        
        <DrawerDescription className="sr-only">
          Choose a category to view related information
        </DrawerDescription>

        <div className="flex-1 px-4 pb-6 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-sm mx-auto">
            {categories.map((category) => {
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.href, category.isPlaceholder, category.isExternal)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 relative",
                    category.isPlaceholder ? "cursor-default" : "hover:bg-muted hover:shadow-md active:scale-[0.96]",
                    "bg-background border-border",
                    "min-h-[100px] touch-manipulation",
                    "aspect-square"
                  )}
                >
                  {category.isPlaceholder && (
                    <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full z-10">
                      {t("categories.comingSoon")}
                    </div>
                  )}
                  {category.isNewFeature && (
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full z-10">
                      New
                    </div>
                  )}
                  <div className="mb-3 w-10 h-10 flex items-center justify-center">
                    <Image
                      src={category.icon}
                      alt={category.label}
                      width={40}
                      height={40}
                      className="max-w-10 max-h-10 object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-foreground text-sm leading-tight">{category.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{category.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}