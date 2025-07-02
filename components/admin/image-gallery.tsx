"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Images, 
  ExternalLink, 
  Download, 
  Eye, 
  X,
  ImageIcon,
  Maximize2
} from "lucide-react"

interface ExtractedImage {
  url: string
  alt?: string
  caption?: string
  source?: string
}

interface ImageGalleryProps {
  images: ExtractedImage[]
  className?: string
}

export default function ImageGallery({ images, className = "" }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ExtractedImage | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  if (!images || images.length === 0) {
    return null
  }

  const handleImageClick = (image: ExtractedImage) => {
    setSelectedImage(image)
    setIsDialogOpen(true)
  }

  const handleDownload = (imageUrl: string, filename?: string) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = filename || 'enhanced-article-image'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenOriginal = (imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Images className="h-5 w-5 text-green-600" />
            Additional Images
            <Badge variant="secondary" className="ml-auto">
              {images.length} images
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <ScrollArea className="h-48">
            <div className="grid grid-cols-2 gap-3">
              {images.map((image, index) => (
                <ImageThumbnail
                  key={`${image.url}-${index}`}
                  image={image}
                  index={index}
                  onClick={() => handleImageClick(image)}
                />
              ))}
            </div>
          </ScrollArea>
          
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Images found during AI enhancement from web sources. 
              Click on any image to view full size.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Image Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Enhanced Article Image</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              {/* Image Display */}
              <div className="relative">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.alt || 'Enhanced article image'}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
                <div className="hidden flex items-center justify-center h-48 bg-muted rounded-lg">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Image failed to load</p>
                  </div>
                </div>
              </div>
              
              {/* Image Details */}
              <div className="space-y-3">
                {selectedImage.caption && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Caption</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedImage.caption}
                    </p>
                  </div>
                )}
                
                {selectedImage.alt && selectedImage.alt !== selectedImage.caption && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Alt Text</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedImage.alt}
                    </p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-sm mb-1">Source</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedImage.source || 'Found during web search enhancement'}
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenOriginal(selectedImage.url)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Original
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedImage.url)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

interface ImageThumbnailProps {
  image: ExtractedImage
  index: number
  onClick: () => void
}

function ImageThumbnail({ image, index, onClick }: ImageThumbnailProps) {
  return (
    <div 
      className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-green-500 transition-all"
      onClick={onClick}
    >
      <img
        src={image.url}
        alt={image.alt || `Enhanced image ${index + 1}`}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextElementSibling?.classList.remove('hidden')
        }}
      />
      
      {/* Fallback for failed images */}
      <div className="hidden absolute inset-0 flex items-center justify-center bg-muted">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              window.open(image.url, '_blank')
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Image Caption Overlay */}
      {image.caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-white text-xs line-clamp-2">
            {image.caption}
          </p>
        </div>
      )}
    </div>
  )
}