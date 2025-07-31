import imageCompression from "browser-image-compression"

export interface CompressionOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  useWebWorker?: boolean
  maxIteration?: number
  fileType?: string
}

const defaultOptions: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  maxIteration: 10,
  fileType: "image/jpeg"
}

export async function compressImage(
  imageFile: File,
  options: CompressionOptions = {}
): Promise<File> {
  const mergedOptions = { ...defaultOptions, ...options }
  
  try {
    console.log(`Original file size: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB`)
    
    const compressedFile = await imageCompression(imageFile, mergedOptions)
    
    console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
    console.log(`Compression ratio: ${((1 - compressedFile.size / imageFile.size) * 100).toFixed(1)}%`)
    
    return compressedFile
  } catch (error) {
    console.error("Error compressing image:", error)
    throw error
  }
}

export async function compressForSocialMedia(imageFile: File): Promise<{
  standard: File
  whatsapp: File
}> {
  const standardOptions: CompressionOptions = {
    maxSizeMB: 0.8,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: "image/jpeg"
  }
  
  const whatsappOptions: CompressionOptions = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/jpeg"
  }
  
  const [standard, whatsapp] = await Promise.all([
    compressImage(imageFile, standardOptions),
    compressImage(imageFile, whatsappOptions)
  ])
  
  return { standard, whatsapp }
}