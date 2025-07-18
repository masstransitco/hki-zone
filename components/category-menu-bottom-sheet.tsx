"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import Image from "next/image"
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerClose 
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CategoryMenuBottomSheetProps {
  isOpen: boolean
  onClose: () => void
}

const categories = [
  {
    id: "road",
    label: "Roads",
    description: "Traffic & journey times",
    icon: "/menu-icons/road.PNG",
    href: "/road"
  },
  {
    id: "ae",
    label: "A&E",
    description: "Hospital wait times",
    icon: "/menu-icons/ae.PNG",
    href: "/ae"
  },
  {
    id: "weather",
    label: "Weather",
    description: "Current & forecast",
    icon: "/menu-icons/observatory.PNG",
    href: "/weather"
  },
  {
    id: "postbox",
    label: "Postbox",
    description: "Postal services",
    icon: "/menu-icons/postbox.PNG",
    href: "/postbox"
  },
  {
    id: "trashbin",
    label: "Trashbin",
    description: "Waste management",
    icon: "/menu-icons/orangebin.PNG",
    href: "/trashbin"
  }
]

export default function CategoryMenuBottomSheet({ 
  isOpen, 
  onClose 
}: CategoryMenuBottomSheetProps) {
  const router = useRouter()

  React.useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const handleCategoryClick = (href: string) => {
    onClose()
    router.push(href)
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
          maxHeight: "calc(80dvh - env(safe-area-inset-top, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        }}
      >
        <div className="relative px-6 pt-4 pb-2 shrink-0">
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-6 top-4 h-10 w-10 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
          
          <DrawerTitle className="text-lg font-semibold text-center pr-12">
            Select Category
          </DrawerTitle>
        </div>
        
        <DrawerDescription className="sr-only">
          Choose a category to view related information
        </DrawerDescription>

        <div className="flex-1 px-4 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-sm mx-auto">
            {categories.map((category) => {
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.href)}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200",
                    "hover:bg-muted hover:shadow-md active:scale-[0.96]",
                    "bg-background border-border",
                    "min-h-[100px] touch-manipulation",
                    "aspect-square"
                  )}
                >
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