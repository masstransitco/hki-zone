const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const envVars = {};
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  Object.assign(process.env, envVars);
} catch (error) {
  console.error('Could not load .env.local:', error.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateLangaugeField() {
  try {
    console.log('Starting language field migration...');
    
    // First check if the language column already exists
    console.log('Checking if language column exists...');
    const { data: testQuery, error: testError } = await supabase
      .from('articles')
      .select('language')
      .limit(1);
    
    if (!testError) {
      console.log('Language column already exists! Migration not needed.');
      return;
    }
    
    console.log('Language column does not exist. Adding it now...');
    
    // Read the migration SQL from the file
    const migrationSQL = fs.readFileSync('scripts/add-language-field.sql', 'utf8');
    console.log('Migration SQL:');
    console.log(migrationSQL);
    
    // Execute the migration using SQL
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('exec', {
      query: migrationSQL
    });
    
    if (error) {
      console.error('Migration failed with RPC method:', error);
      
      // Try alternative approach - execute each statement separately
      console.log('Trying alternative approach...');
      
      const statements = [
        `ALTER TABLE articles ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';`,
        `CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);`,
        `UPDATE articles SET language = 'en' WHERE language IS NULL;`
      ];
      
      for (const statement of statements) {
        console.log(`Executing: ${statement}`);
        const { error: stmtError } = await supabase.rpc('exec', { query: statement });
        if (stmtError) {
          console.error('Statement failed:', stmtError);
        } else {
          console.log('Statement succeeded');
        }
      }
    } else {
      console.log('Migration executed successfully with RPC method');
    }
    
    // Test if migration was successful
    console.log('Testing migration...');
    const { data: articles, error: finalError } = await supabase
      .from('articles')
      .select('id, title, language')
      .limit(3);
    
    if (finalError) {
      console.error('Migration verification failed:', finalError);
    } else {
      console.log('Migration successful! Sample articles:');
      articles.forEach(article => {
        console.log(`  - ${article.title} (language: ${article.language})`);
      });
    }
    
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

migrateLangaugeField();