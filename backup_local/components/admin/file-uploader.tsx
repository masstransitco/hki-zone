"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { compressImage } from "@/lib/image-compression"

interface FileUploaderProps {
  articleId: string
  onUpload: (url: string) => void
  disabled?: boolean
}

export default function FileUploader({ articleId, onUpload, disabled }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB")
      return
    }
    
    setIsUploading(true)
    
    try {
      // Compress the image before upload
      toast.info("Compressing image...")
      const compressedFile = await compressImage(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        fileType: "image/jpeg"
      })
      
      const originalSize = (file.size / 1024 / 1024).toFixed(2)
      const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2)
      console.log(`Image compressed from ${originalSize}MB to ${compressedSize}MB`)
      
      // Get upload URL from API
      const response = await fetch(`/api/admin/articles/${articleId}/upload-image`, {
        method: "POST",
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to get upload URL")
      }
      
      const { uploadUrl, publicUrl, needsProcessing } = await response.json()
      
      // Upload compressed file directly to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: compressedFile,
        headers: {
          "Content-Type": compressedFile.type,
          "x-upsert": "true",
        },
      })
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file")
      }
      
      // Process the image for social media optimization
      if (needsProcessing) {
        toast.info("Optimizing image for social media...")
        const processResponse = await fetch(`/api/admin/articles/${articleId}/process-image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl: publicUrl }),
        })
        
        if (processResponse.ok) {
          const { images } = await processResponse.json()
          // Use the optimized URL
          onUpload(images.optimized)
          toast.success("Image uploaded and optimized successfully")
        } else {
          // Fallback to original URL if processing fails
          onUpload(publicUrl)
          toast.warning("Image uploaded but optimization failed")
        }
      } else {
        // Call the onUpload callback with the public URL
        onUpload(publicUrl)
        toast.success("Image uploaded successfully")
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload image", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      })
    } finally {
      setIsUploading(false)
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
        id="file-upload"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload Image
          </>
        )}
      </Button>
      <div className="text-xs text-muted-foreground">
        Max 10MB, images only
      </div>
    </div>
  )
}