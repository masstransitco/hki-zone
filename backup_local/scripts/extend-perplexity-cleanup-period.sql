-- Migration script to extend Perplexity news cleanup period from 24 hours to 7 days
-- This prevents articles from being deleted and re-fetched with new timestamps

-- First, remove the existing cron job
SELECT cron.unschedule('cleanup_old_perplexity_news');

-- Then create a new cron job with a 7-day retention period
-- This will run once per day at 3 AM to clean up articles older than 7 days
SELECT cron.schedule(
  'cleanup_old_perplexity_news', 
  '0 3 * * *',  -- Run at 3 AM daily instead of every 30 minutes
  $$ DELETE FROM perplexity_news WHERE inserted_at < NOW() - INTERVAL '7 days' $$
);

-- Optional: Add a comment to explain the change
COMMENT ON TABLE perplexity_news IS 'Stores Perplexity AI generated Hong Kong news articles with a 7-day retention period to prevent timestamp confusion';