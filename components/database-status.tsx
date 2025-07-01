"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertCircle, CheckCircle, Database, ExternalLink, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useLanguage } from "./language-provider"

async function checkDatabaseStatus() {
  console.log("Checking database status...")
  const response = await fetch("/api/articles?page=0&_t=" + Date.now())
  const data = await response.json()
  console.log("Database status response:", data)
  return data.usingMockData !== undefined ? data.usingMockData : false
}

async function setupDatabase() {
  const response = await fetch("/api/setup-database", { method: "POST" })
  const data = await response.json()
  return data
}

const SQL_SCRIPT = `-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  ai_summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

-- Create full-text search index
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING gin(to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(ai_summary, '')));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON articles
    FOR SELECT USING (true);

-- Create policy to allow insert/update for service role
CREATE POLICY "Allow insert/update for service role" ON articles
    FOR ALL USING (auth.role() = 'service_role');`

export default function DatabaseStatus() {
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)
  const [showManualSetup, setShowManualSetup] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { t } = useLanguage()

  const {
    data: usingMockData,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["databaseStatus"],
    queryFn: checkDatabaseStatus,
    staleTime: 0,
    cacheTime: 0,
  })

  const handleForceRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSetupDatabase = async () => {
    setIsSettingUp(true)
    try {
      const result = await setupDatabase()
      setSetupResult(result)
    } finally {
      setIsSettingUp(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  if (usingMockData === undefined) return null

  if (!usingMockData) {
    return (
      <div className="flex items-center gap-3 text-green-600 text-footnote p-4 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6 border border-green-200 dark:border-green-800">
        <CheckCircle className="w-5 h-5" />
        <span className="text-body font-medium">Database connected - showing real news data</span>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-headline text-yellow-800 dark:text-yellow-200 mb-2">Database Setup Required</h3>
          <p className="text-body text-yellow-700 dark:text-yellow-300 mb-4 leading-relaxed">
            The articles table doesn't exist yet. You can try automatic setup or set up manually.
          </p>

          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              onClick={handleSetupDatabase}
              disabled={isSettingUp}
              className="bg-[rgb(var(--apple-blue))] hover:bg-[rgb(var(--apple-blue))]/90 text-white rounded-lg apple-focus"
            >
              <Database className="w-4 h-4 mr-2" />
              {isSettingUp ? "Setting up..." : "Try Auto Setup"}
            </Button>

            <Button
              onClick={() => setShowManualSetup(!showManualSetup)}
              variant="outline"
              className="rounded-lg apple-focus border-yellow-300 dark:border-yellow-700"
            >
              Manual Setup
            </Button>

            <Button
              onClick={handleForceRefresh}
              disabled={isRefreshing}
              variant="outline"
              className="rounded-lg apple-focus border-yellow-300 dark:border-yellow-700 bg-transparent"
            >
              {isRefreshing ? "Refreshing..." : "Refresh Status"}
            </Button>
          </div>

          {setupResult && !setupResult.success && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-footnote mb-4">
              <p className="text-red-700 dark:text-red-300 font-medium mb-1">Auto setup failed</p>
              <p className="text-red-600 dark:text-red-400">{setupResult.message}</p>
            </div>
          )}

          {setupResult?.success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-footnote mb-4">
              <p className="text-green-700 dark:text-green-300 font-medium mb-1">✅ Setup completed successfully!</p>
              <p className="text-green-600 dark:text-green-400">Refresh the page to see real news data.</p>
            </div>
          )}

          {showManualSetup && (
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <h4 className="text-headline text-blue-800 dark:text-blue-200 mb-4">Manual Setup Instructions</h4>
              <ol className="text-footnote text-blue-700 dark:text-blue-300 space-y-3 list-decimal list-inside mb-4">
                <li>
                  Go to your{" "}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1 text-[rgb(var(--apple-blue))]"
                  >
                    Supabase Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Click on "SQL Editor" in the left sidebar</li>
                <li>Click "New Query" to create a new SQL script</li>
                <li>Copy and paste the SQL script below</li>
                <li>Click "Run" to execute the script</li>
              </ol>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-subhead text-blue-800 dark:text-blue-200">SQL Script:</span>
                  <Button
                    onClick={() => copyToClipboard(SQL_SCRIPT)}
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-caption-2 rounded-lg apple-focus"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-caption-1 overflow-x-auto max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700">
                  <code>{SQL_SCRIPT}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
