-- Add language field to articles table
-- This field will store the language of the article content
-- Values: 'en' (English), 'zh-TW' (Traditional Chinese), 'zh-CN' (Simplified Chinese)

-- Add language column to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Add index for language field for efficient filtering
CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);

-- Update existing articles to have 'en' as default language
UPDATE articles 
SET language = 'en' 
WHERE language IS NULL;

-- Add comment to the language column
COMMENT ON COLUMN articles.language IS 'Language of the article content: en, zh-TW, zh-CN';