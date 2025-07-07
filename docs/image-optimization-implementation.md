# Image Optimization Implementation

## Overview

This document describes the image optimization system implemented to fix social media preview issues, particularly for WhatsApp link sharing. The system automatically compresses and creates multiple optimized versions of uploaded images for better compatibility across different platforms.

## Problem Statement

- Articles with uploaded images were not showing previews when shared on WhatsApp and other social media platforms
- Large image file sizes exceeded undocumented platform limits
- No optimization for different platform requirements (aspect ratios, file sizes)

## Solution Architecture

### 1. Client-Side Compression

**Library**: `browser-image-compression`

**Implementation**: `/lib/image-compression.ts`

- Compresses images before upload to reduce bandwidth usage
- Target: 1MB max size, 1200px max width
- Maintains aspect ratio and quality

```typescript
// Default compression options
const defaultOptions: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  maxIteration: 10,
  fileType: "image/jpeg"
}
```

### 2. Server-Side Processing

**Library**: `sharp`

**Implementation**: `/app/api/admin/articles/[id]/process-image/route.ts`

Creates optimized versions:
- **Optimized** (1200×630px): For Facebook, LinkedIn, Twitter
- **WhatsApp** (800×800px): Specifically sized for WhatsApp previews

### 3. Database Schema

**New Column**: `image_metadata` (JSONB)

Stores URLs for different image versions:
```json
{
  "original": "https://...",
  "optimized": "https://...", 
  "whatsapp": "https://..."
}
```

## Implementation Details

### File Upload Component

**Location**: `/components/admin/file-uploader.tsx`

Key features:
- Compresses image before upload
- Shows compression progress
- Calls image processing endpoint after upload
- Graceful fallback if optimization fails

### Image Processing Flow

1. User selects image file
2. Client-side compression reduces file size
3. Compressed image uploads to Supabase Storage
4. Server downloads and processes image with Sharp
5. Multiple versions created and stored
6. Metadata saved to database

### Metadata Generation

**Location**: `/app/article/[id]/page.tsx`

Enhanced Open Graph implementation:
- Uses optimized image version from `image_metadata`
- Falls back to original `image_url` if needed
- Includes platform-specific meta tags
- Proper image dimensions declared

```typescript
// Priority order for image selection
imageUrl = article.image_metadata?.optimized 
  || article.image_metadata?.original 
  || article.image_url 
  || "/hki-logo-black.png"
```

## Platform Requirements

### Image Size Limits

| Platform | Recommended Size | Max File Size | Aspect Ratio |
|----------|-----------------|---------------|--------------|
| Facebook | 1200×630px | 8MB | 1.91:1 |
| LinkedIn | 1200×627px | 8MB | 1.91:1 |
| Twitter/X | 1200×675px | 5MB | 16:9 |
| WhatsApp | 400-800px | ~1MB* | Square preferred |

*WhatsApp limits are undocumented but testing shows better results with smaller files

### Meta Tags Added

```html
<!-- WhatsApp specific optimizations -->
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:alt" content="{title}" />
```

## API Endpoints

### Upload Image
`POST /api/admin/articles/[id]/upload-image`
- Creates signed upload URL
- Returns public URL for uploaded image

### Process Image
`POST /api/admin/articles/[id]/process-image`
- Downloads uploaded image
- Creates optimized versions
- Stores URLs in `image_metadata`

### Debug Open Graph
`GET /debug/og-tags/[id]`
- Shows current meta tags
- Displays all image versions
- Links to social media validators

## Database Migration

To add the `image_metadata` column:

```sql
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

COMMENT ON COLUMN articles.image_metadata IS 
'Stores URLs for different image versions: {original, optimized, whatsapp}';
```

## Testing

### Debug Page
Access `/debug/og-tags/[article-id]` to:
- View generated Open Graph tags
- See all image versions
- Test with platform validators

### Platform Validators
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

### WhatsApp Testing
Share article URL in WhatsApp to test preview. Note: WhatsApp caches previews aggressively.

## Error Handling

### Schema Cache Issues
If Supabase doesn't recognize `image_metadata` column:
1. Run migration directly in SQL Editor
2. Wait 60 seconds for cache refresh
3. Or restart Supabase project

### Fallback Strategy
- If optimization fails, original image URL is used
- If `image_metadata` update fails, only `image_url` is updated
- All errors logged but don't break upload flow

## Performance Considerations

- Client-side compression reduces upload time
- Web Workers used for non-blocking compression
- Server processes images asynchronously
- Optimized images cached by Supabase CDN

## Future Improvements

1. **Additional Formats**
   - WebP support for modern browsers
   - AVIF for even better compression

2. **Smart Cropping**
   - Face detection for better crops
   - Important content preservation

3. **Batch Processing**
   - Process multiple articles at once
   - Background job queue for large imports

4. **Analytics**
   - Track which versions are most used
   - Monitor compression ratios

## Troubleshooting

### Images Not Compressing
- Check browser console for errors
- Verify `browser-image-compression` is installed
- Ensure file is actually an image

### Optimization Failing
- Check server logs for Sharp errors
- Verify Supabase storage bucket exists
- Ensure sufficient memory for Sharp

### Previews Not Showing
- Use debug page to verify correct meta tags
- Check image file size (<1MB for WhatsApp)
- Clear platform caches or wait
- Verify image URLs are publicly accessible

## Dependencies

```json
{
  "browser-image-compression": "^2.0.2",
  "sharp": "^0.33.0"
}
```

## Code References

- Image compression utils: `/lib/image-compression.ts`
- File upload component: `/components/admin/file-uploader.tsx:41-50`
- Process image API: `/app/api/admin/articles/[id]/process-image/route.ts:42-54`
- Metadata generation: `/app/article/[id]/page.tsx:31-36`
- Debug page: `/app/debug/og-tags/[id]/page.tsx`