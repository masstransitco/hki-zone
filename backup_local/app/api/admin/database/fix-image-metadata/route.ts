import { NextResponse } from "next/server"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '')
  
  const sql = `-- Add image_metadata column to store different image versions
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'articles' AND column_name = 'image_metadata';`

  const sqlEditorUrl = `https://app.supabase.com/project/${projectRef}/sql/new`
  
  // Create an HTML page with instructions and a button
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Fix image_metadata Column</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 1rem;
        }
        .sql-box {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 1rem;
            margin: 1rem 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            margin: 1rem 0;
        }
        .button:hover {
            background: #2563eb;
        }
        .steps {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            padding: 1rem;
            margin: 1rem 0;
        }
        .step {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
        }
        .success {
            background: #d1fae5;
            border: 1px solid #6ee7b7;
            color: #065f46;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
        }
        .copy-button {
            background: #6b7280;
            color: white;
            border: none;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            float: right;
        }
        .copy-button:hover {
            background: #4b5563;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Fix image_metadata Column</h1>
        
        <p>The <code>image_metadata</code> column needs to be added to your articles table to support image optimization.</p>
        
        <div class="steps">
            <h3>Steps to fix:</h3>
            <div class="step">1. Click the button below to open Supabase SQL Editor</div>
            <div class="step">2. The SQL code will be ready - just click "Run"</div>
            <div class="step">3. You should see a success message</div>
            <div class="step">4. Return to your app and try uploading an image again</div>
        </div>
        
        <a href="${sqlEditorUrl}" target="_blank" class="button">
            Open Supabase SQL Editor →
        </a>
        
        <h3>SQL to run:</h3>
        <div class="sql-box">
            <button class="copy-button" onclick="copySQL()">Copy SQL</button>
            <pre id="sql-content">${sql}</pre>
        </div>
        
        <div class="success">
            <strong>After running the SQL:</strong><br>
            • The column will be added immediately<br>
            • Image uploads will be compressed and optimized<br>
            • Social media previews will work better
        </div>
    </div>
    
    <script>
        function copySQL() {
            const sqlContent = document.getElementById('sql-content').textContent;
            navigator.clipboard.writeText(sqlContent).then(() => {
                const button = document.querySelector('.copy-button');
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = 'Copy SQL';
                }, 2000);
            });
        }
    </script>
</body>
</html>
  `
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}