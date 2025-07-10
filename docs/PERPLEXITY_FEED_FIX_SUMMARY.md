# Perplexity Feed Fix Summary

## Problem
The perplexity feed was displaying the same 6 headlines repeatedly because:
1. JSON parsing was failing due to explanatory text in API responses
2. The system immediately fell back to hardcoded headlines
3. No deduplication check before saving
4. Cron job running hourly created duplicates

## Solution Implemented

### 1. **Improved JSON Extraction** (`/lib/perplexity-hk-news.ts`)
- Added multiple extraction methods to handle various response formats
- Better error handling with detailed logging
- Removed immediate fallback to hardcoded headlines
- Returns empty array instead of fallback on parse failure

### 2. **Enhanced API Prompt**
- Changed temperature from 0.3 to 0.2 for consistent formatting
- Increased frequency penalty from 0.5 to 0.8 to avoid repetition
- Made prompt extremely explicit about JSON-only output
- Added "CRITICAL" instructions about response format
- Reduced from 10 to 6 headlines for better quality

### 3. **Added Deduplication**
- Checks recent 24 hours of headlines before saving
- Filters out duplicates based on title (case-insensitive)
- Logs skipped duplicates for transparency

### 4. **Database Cleanup Script** (`/sql/cleanup-duplicate-headlines.sql`)
- Removes duplicate fallback articles
- Keeps only the most recent of each title
- Provides verification queries

## Files Modified

1. `/lib/perplexity-hk-news.ts`
   - Updated `fetchHKHeadlines()` with robust JSON extraction
   - Modified `processHeadlines()` to add deduplication
   - Changed prompt for cleaner API responses
   - Removed fallback to hardcoded headlines

2. `/sql/cleanup-duplicate-headlines.sql`
   - SQL script to clean existing duplicates

3. Test scripts created:
   - `/scripts/test-headline-generation-fixed.js`
   - `/scripts/check-recent-headlines.js`
   - `/scripts/examine-perplexity-feed.js`

## Deployment Steps

1. **Deploy the updated code**:
   ```bash
   git add lib/perplexity-hk-news.ts
   git commit -m "Fix perplexity feed duplicate headlines issue"
   git push
   ```

2. **Run the cleanup SQL** in Supabase SQL editor:
   ```sql
   -- First check what will be deleted
   SELECT title, COUNT(*) as count 
   FROM articles_unified 
   WHERE source = 'Perplexity AI (Fallback)' 
   GROUP BY title;

   -- Then run the cleanup script
   -- (copy from /sql/cleanup-duplicate-headlines.sql)
   ```

3. **Monitor the results**:
   - Check logs for successful headline generation
   - Verify no more fallback headlines
   - Confirm unique headlines in feed

## Expected Results

- ✅ No more repeating 6 headlines
- ✅ Fresh, unique content generated each hour
- ✅ Better JSON parsing success rate
- ✅ Cleaner logs with detailed debugging
- ✅ No duplicate headlines saved

## Future Improvements

1. Consider reducing cron frequency from hourly to every 2-4 hours
2. Add metrics tracking for parse success rate
3. Implement partial success handling
4. Add URL validation before saving