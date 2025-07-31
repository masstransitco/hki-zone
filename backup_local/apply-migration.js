// Apply database migration to remove published_at column
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

async function applyMigration() {
  try {
    console.log('\n=== Applying Database Migration ===');
    console.log('Removing published_at column from perplexity_news table...');
    
    // Check if column exists first
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'perplexity_news' 
            AND column_name = 'published_at'
        `
      });
      
    if (columnsError) {
      console.error('❌ Error checking for published_at column:', columnsError);
      return;
    }
    
    if (!columns || columns.length === 0) {
      console.log('✅ published_at column does not exist - migration not needed');
      return;
    }
    
    console.log('📋 published_at column found, proceeding with removal...');
    
    // Drop the column
    const { error: dropError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE perplexity_news DROP COLUMN IF EXISTS published_at'
      });
      
    if (dropError) {
      console.error('❌ Error dropping published_at column:', dropError);
      return;
    }
    
    console.log('✅ published_at column removed successfully');
    
    // Drop the index if it exists
    const { error: indexError } = await supabase
      .rpc('exec_sql', { 
        sql: 'DROP INDEX IF EXISTS idx_perplexity_news_published_at'
      });
      
    if (indexError) {
      console.error('❌ Error dropping published_at index:', indexError);
    } else {
      console.log('✅ published_at index removed successfully');
    }
    
    console.log('\n📋 Migration Summary:');
    console.log('   • published_at column dropped from perplexity_news table');
    console.log('   • published_at index removed');
    console.log('   • Schema simplified to use only created_at/updated_at');
    console.log('   • Feed will now display accurate timestamps based on created_at');
    
  } catch (err) {
    console.error('Error during migration:', err.message);
  }
}

applyMigration();