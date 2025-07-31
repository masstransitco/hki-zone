# Fixing Perplexity Enrichment Issues

## Current Issues

From your logs, I can see two main issues:

1. **Image history table not created**: "Image history table not yet created"
2. **Articles not being enriched**: Articles show status "ready" instead of "pending", so enrichment is skipped

## Solution Steps

### 1. Run Database Migrations

The image history table and contextual enrichment fields need to be created in your database.

#### Option A: Using psql (Recommended)
```bash
# If you have DATABASE_URL environment variable set:
./run-migrations.sh

# Or run individually:
psql $DATABASE_URL -f scripts/add-perplexity-image-tracking.sql
psql $DATABASE_URL -f scripts/add-enhanced-perplexity-fields.sql
psql $DATABASE_URL -f scripts/add-contextual-enrichment-fields.sql
```

#### Option B: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of each SQL file:
   - `scripts/add-perplexity-image-tracking.sql`
   - `scripts/add-enhanced-perplexity-fields.sql`
   - `scripts/add-contextual-enrichment-fields.sql`
4. Execute each script

#### Option C: Check migration status
```bash
node apply-database-migrations.js
```

### 2. Reset Article Status for Re-enrichment

The articles currently have status "ready" which means they won't be processed. You need to reset them to "pending" to trigger the new contextual enrichment.

```bash
# Reset 10 fallback articles (safest option)
node reset-article-status.js --limit 10

# Reset all fallback articles
node reset-article-status.js --all

# Reset specific category
node reset-article-status.js --category business --limit 20

# Include real articles (not just fallbacks)
node reset-article-status.js --include-real --limit 10
```

### 3. Trigger Enrichment

After resetting the status, trigger the enrichment process:

1. **Via Admin Panel**: Click "Force Enrich Articles" button
2. **Via Cron**: Wait for the next scheduled run
3. **Manually**: The enrichment will run automatically

### 4. Verify the System

#### Check Database Tables
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'perplexity%';

-- Check image history
SELECT * FROM perplexity_image_history LIMIT 5;

-- Check articles with contextual data
SELECT id, title, article_status, contextual_data 
FROM perplexity_news 
WHERE contextual_data IS NOT NULL 
LIMIT 5;
```

#### Test Enrichment
```bash
# Test the contextual enrichment system
node test-contextual-enrichment.js

# Test image search with history tracking
node test-enhanced-image-search.js
```

## Expected Behavior After Fixes

### 1. Image Selection
- Images will be tracked in `perplexity_image_history`
- No duplicate images within 7 days
- Better variety through randomization
- Logs will show: "✅ Found X unique images used in last 7 days"

### 2. Article Enrichment
- Articles will get contextual bullets with historical data
- Each article will have 3 structured bullets:
  - Historical context with past data
  - Current facts with numbers
  - Forward-looking insights

### 3. Example Enriched Content
```
Bullet 1 - HISTORICAL PERSPECTIVE
• Historical: "2019年同期增長僅2.3%，2020年因疫情下跌15%"
• Current: "10月份物業價格上升3.2%，為今年最大單月升幅"
• Insight: "市場復甦跡象明顯，預示香港房地產市場重拾動力"
```

## Monitoring Success

### Check Logs for Success Indicators
```
✅ Image history table exists
✅ Loaded X recently used images to avoid
✅ Filtered X images to Y unused images
📊 Creating contextual enrichment for: [headline]
🔍 Searching for historical context: [headline]
✅ Article enriched with enhanced structure
```

### Admin Panel Indicators
- Articles show "pending" → "enriched" → "ready" status progression
- "contextual_data" field populated in database
- Unique images for each article
- Rich content with data points

## Troubleshooting

### If migrations fail
- Check database permissions
- Ensure you're using the service role key
- Try running SQL directly in Supabase dashboard

### If enrichment still doesn't work
- Check API keys are set correctly
- Verify article status is "pending"
- Check Perplexity API quota
- Look for error messages in logs

### If images are still duplicating
- Verify image history table was created
- Check if tracking is working: `SELECT * FROM perplexity_image_history`
- Ensure the enrichment route is using the new code

## Quick Test Sequence

```bash
# 1. Run migrations
./run-migrations.sh

# 2. Reset 5 articles for testing
node reset-article-status.js --limit 5

# 3. Trigger enrichment from admin panel

# 4. Check results
node test-contextual-enrichment.js
```

## Support

If issues persist after following these steps:
1. Check the Vercel function logs for detailed errors
2. Verify all environment variables are set
3. Test individual components with the test scripts
4. Check Supabase logs for database errors