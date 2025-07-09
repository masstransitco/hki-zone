-- Create headlines table for daily top headlines by category
CREATE TABLE IF NOT EXISTS headlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT,
  author TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_headlines_category ON headlines(category);
CREATE INDEX IF NOT EXISTS idx_headlines_created_at ON headlines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_headlines_published_at ON headlines(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_headlines_source ON headlines(source);

-- Create compound index for efficient category + date queries
CREATE INDEX IF NOT EXISTS idx_headlines_category_created_at ON headlines(category, created_at DESC);

-- Enable Row Level Security
ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON headlines
    FOR SELECT USING (true);

-- Create policy to allow insert/update/delete for service role
CREATE POLICY "Allow full access for service role" ON headlines
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to cleanup old headlines (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_headlines()
RETURNS void AS $$
BEGIN
    DELETE FROM headlines WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ language 'plpgsql';