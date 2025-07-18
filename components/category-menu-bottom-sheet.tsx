"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import CloudIcon from '@mui/icons-material/Cloud'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
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
    icon: DirectionsCarIcon,
    href: "/road",
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    id: "weather",
    label: "Weather",
    description: "Current & forecast",
    icon: CloudIcon,
    href: "/weather",
    color: "text-green-600 dark:text-green-400"
  },
  {
    id: "ae",
    label: "A&E",
    description: "Hospital wait times",
    icon: LocalHospitalIcon,
    href: "/ae",
    color: "text-red-600 dark:text-red-400"
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
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[12px] border bg-background",
          "focus:outline-none [&>div:first-child]:mt-2"
        )}
        style={{
          maxHeight: "calc(50dvh - env(safe-area-inset-top, 0px) - 8px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          marginTop: "8px"
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

        <div className="flex-1 px-6 pb-6">
          <div className="grid gap-3">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.href)}
                  className={cn(
                    "flex items-center p-4 rounded-lg border transition-all duration-200",
                    "hover:bg-muted hover:shadow-sm active:scale-[0.98]",
                    "bg-background border-border"
                  )}
                >
                  <div className={cn("mr-4", category.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-foreground">{category.label}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
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