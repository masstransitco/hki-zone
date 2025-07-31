/**
 * Simple utility to get all available carpark images
 * Last image is typically the most recent/relevant one
 */

/**
 * Gets all available images for a carpark listing
 * Returns them in order, with the last one being the default (most recent)
 */
export function getAllCarparkImages(row: any): string[] {
  const images: string[] = [];
  
  // Collect all available images from various sources
  if (row.cover_image_url) {
    images.push(row.cover_image_url);
  }
  
  if (row.payload?.imageFull) {
    images.push(...row.payload.imageFull);
  }
  
  if (row.payload?.photos) {
    images.push(...row.payload.photos);
  }
  
  if (row.payload?.coverImage && row.payload.coverImage !== row.cover_image_url) {
    images.push(row.payload.coverImage);
  }
  
  // Remove duplicates while preserving order
  const uniqueImages = [...new Set(images)];
  
  return uniqueImages;
}

/**
 * Gets the default image (last image) for a carpark listing
 */
export function getDefaultCarparkImage(row: any): string | null {
  const images = getAllCarparkImages(row);
  
  if (images.length === 0) {
    return null;
  }
  
  // Return the last image (most recent/relevant)
  return images[images.length - 1];
}