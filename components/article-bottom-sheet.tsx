"use client"

import * as React from "react"
import { X } from "lucide-react"
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
import ArticleDetailSheet from "./article-detail-sheet"
import ShareButton from "./share-button"

interface ArticleBottomSheetProps {
  articleId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ArticleBottomSheet({ 
  articleId, 
  open, 
  onOpenChange 
}: ArticleBottomSheetProps) {
  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      shouldScaleBackground={true}
    >
      <DrawerContent 
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[10px] border bg-background",
          "h-[90dvh] max-h-[90dvh]",
          "focus:outline-none [&>div:first-child]:mt-2"
        )}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        }}
      >
        {/* Header with close button and share button below drag handle */}
        <div className="relative px-6 pt-4 pb-8 shrink-0">
          {/* Close button positioned with proper spacing from drag handle */}
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-6 top-4 h-10 w-10 p-0 hover:bg-muted"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
          
          {/* Share button positioned on the right with proper spacing */}
          {articleId && (
            <div className="absolute right-6 top-4">
              <ShareButton 
                articleId={articleId} 
                compact={true}
              />
            </div>
          )}
        </div>
        
        {/* Hidden accessibility elements */}
        <DrawerTitle className="sr-only">Article Details</DrawerTitle>
        <DrawerDescription className="sr-only">
          Full article content and details
        </DrawerDescription>

        {/* Article content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {articleId && (
            <ArticleDetailSheet articleId={articleId} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}