const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function addMissingFields() {
  try {
    console.log('🔧 Adding missing fields to articles table...');
    
    // List of SQL commands to add missing fields
    const alterCommands = [
      // Trilingual tracking fields
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS trilingual_batch_id TEXT;",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_article_id TEXT;", 
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS language_variant VARCHAR(10);",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS language_order INTEGER;",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS quality_score INTEGER;",
      
      // Enhanced content fields
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS key_points TEXT[];",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS why_it_matters TEXT;",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS structured_sources JSONB;",
      
      // Add constraint for language variants
      "ALTER TABLE articles DROP CONSTRAINT IF EXISTS check_language_variant;",
      "ALTER TABLE articles ADD CONSTRAINT check_language_variant CHECK (language_variant IN ('en', 'zh-TW', 'zh-CN') OR language_variant IS NULL);",
      
      // Add constraint for language order
      "ALTER TABLE articles DROP CONSTRAINT IF EXISTS check_language_order;", 
      "ALTER TABLE articles ADD CONSTRAINT check_language_order CHECK (language_order IN (1, 2, 3) OR language_order IS NULL);"
    ];
    
    // Create indexes
    const indexCommands = [
      "CREATE INDEX IF NOT EXISTS idx_articles_trilingual_batch ON articles(trilingual_batch_id);",
      "CREATE INDEX IF NOT EXISTS idx_articles_source_article ON articles(source_article_id);",
      "CREATE INDEX IF NOT EXISTS idx_articles_language_variant ON articles(language_variant);",
      "CREATE INDEX IF NOT EXISTS idx_articles_quality_score ON articles(quality_score);"
    ];
    
    console.log('📝 Adding columns...');
    for (let i = 0; i < alterCommands.length; i++) {
      const command = alterCommands[i];
      console.log(`⚡ Executing: ${command.substring(0, 50)}...`);
      
      try {
        // Use raw SQL execution
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: command 
        });
        
        if (error) {
          console.error(`❌ Error in command ${i + 1}:`, error);
        } else {
          console.log(`✅ Command ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in command ${i + 1}:`, err);
      }
    }
    
    console.log('\n📇 Adding indexes...');
    for (let i = 0; i < indexCommands.length; i++) {
      const command = indexCommands[i];
      console.log(`⚡ Executing: ${command.substring(0, 50)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: command 
        });
        
        if (error) {
          console.error(`❌ Error in index ${i + 1}:`, error);
        } else {
          console.log(`✅ Index ${i + 1} created successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in index ${i + 1}:`, err);
      }
    }
    
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Error adding missing fields:', error);
  }
}

addMissingFields();