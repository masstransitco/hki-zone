/**
 * Utility functions for selecting appropriate carpark images
 * while avoiding agent profile pictures
 */

// Common patterns in agent profile picture URLs
const AGENT_PROFILE_PATTERNS = [
  /profile/i,
  /avatar/i,
  /agent/i,
  /broker/i,
  /headshot/i,
  /portrait/i,
  /staff/i,
  /person/i,
  /face/i,
  /user/i,
  // Common agent photo dimensions that are typically square
  /\d+x\d+/i,
  // Desktop images are often agent photos in 28hse
  /_desktop\./i,
  // Short random strings are often agent photos
  /[a-zA-Z0-9]{8,12}_desktop/i,
  // Common agent photo naming patterns
  /headshot/i,
  /staff/i,
  /realtor/i,
];

// Image size patterns that suggest property photos vs agent photos
const PROPERTY_IMAGE_PATTERNS = [
  /_large\./i,
  /_thumb\./i,
  /\d{13,}/i, // Long timestamp patterns common in property photos
];

/**
 * Checks if an image URL is likely an agent profile picture
 */
function isLikelyAgentPhoto(url: string): boolean {
  if (!url) return false;
  
  // Check for agent profile patterns
  const hasAgentPattern = AGENT_PROFILE_PATTERNS.some(pattern => pattern.test(url));
  
  // Check for property image patterns (these are good)
  const hasPropertyPattern = PROPERTY_IMAGE_PATTERNS.some(pattern => pattern.test(url));
  
  // If it has property patterns, it's likely not an agent photo
  if (hasPropertyPattern) return false;
  
  // If it has agent patterns, it's likely an agent photo
  return hasAgentPattern;
}

/**
 * Scores an image URL based on likelihood of being a good property image
 * Higher score = better image
 */
function scoreImageUrl(url: string): number {
  if (!url) return 0;
  
  let score = 1; // Base score
  
  // Boost for property image patterns
  if (/_large\./i.test(url)) score += 3;
  if (/_thumb\./i.test(url)) score += 1;
  if (/\d{13,}/i.test(url)) score += 2; // Long timestamp
  
  // Heavy penalty for agent photo patterns
  if (isLikelyAgentPhoto(url)) score -= 10;
  
  // Additional penalty for desktop images (often agent photos)
  if (/_desktop\./i.test(url)) score -= 3;
  
  return score;
}

/**
 * Selects the best image URL from available options
 */
export function selectBestCarparkImage(row: any): string | null {
  const images: string[] = [];
  
  // Collect all available images
  if (row.cover_image_url) {
    images.push(row.cover_image_url);
  }
  
  if (row.payload?.imageFull) {
    images.push(...row.payload.imageFull);
  }
  
  if (row.payload?.photos) {
    images.push(...row.payload.photos);
  }
  
  if (row.payload?.coverImage) {
    images.push(row.payload.coverImage);
  }
  
  // Remove duplicates
  const uniqueImages = [...new Set(images)];
  
  if (uniqueImages.length === 0) {
    return null;
  }
  
  // Score and sort images
  const scoredImages = uniqueImages
    .map(url => ({ url, score: scoreImageUrl(url) }))
    .sort((a, b) => b.score - a.score);
  
  // Return the best scoring image
  return scoredImages[0]?.url || null;
}

/**
 * Gets multiple images for a carpark, filtered to avoid agent photos
 */
export function getCarparkImages(row: any): string[] {
  const images: string[] = [];
  
  // Collect all available images
  if (row.payload?.imageFull) {
    images.push(...row.payload.imageFull);
  }
  
  if (row.payload?.photos) {
    images.push(...row.payload.photos);
  }
  
  if (row.cover_image_url) {
    images.push(row.cover_image_url);
  }
  
  // Remove duplicates and filter out agent photos
  const uniqueImages = [...new Set(images)];
  const filteredImages = uniqueImages.filter(url => {
    // More aggressive filtering for desktop images
    if (/_desktop\./i.test(url)) return false;
    return !isLikelyAgentPhoto(url);
  });
  
  // If no images pass the filter, fall back to original cover image
  if (filteredImages.length === 0 && row.cover_image_url) {
    return [row.cover_image_url];
  }
  
  // Sort by score (best first)
  return filteredImages
    .map(url => ({ url, score: scoreImageUrl(url) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.url);
}