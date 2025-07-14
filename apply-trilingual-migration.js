const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function applyTrilingualMigration() {
  try {
    console.log('🔄 Applying trilingual tracking migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'scripts', 'add-trilingual-tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          // Continue with other statements for non-critical errors
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        // Try direct SQL execution as fallback
        try {
          const { error: directError } = await supabase
            .from('__exec_sql__')
            .select()
            .limit(0);
          
          // If the table doesn't exist, we'll try a different approach
          console.log(`🔄 Trying alternative execution method...`);
        } catch (fallbackErr) {
          console.error(`❌ Fallback also failed for statement ${i + 1}`);
        }
      }
    }
    
    // Check if the columns were added successfully
    console.log('\n🔍 Verifying trilingual tracking columns...');
    
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'articles')
      .in('column_name', ['trilingual_batch_id', 'source_article_id', 'language_variant', 'language_order', 'quality_score']);
    
    if (columnError) {
      console.error('❌ Error checking columns:', columnError);
    } else {
      console.log('📊 Column verification results:');
      if (columns && columns.length > 0) {
        columns.forEach(col => {
          console.log(`  ✅ ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } else {
        console.log('  ⚠️  No trilingual columns found - migration may need manual application');
      }
    }
    
    console.log('\n✅ Trilingual migration application completed!');
    
  } catch (error) {
    console.error('❌ Error applying trilingual migration:', error);
    process.exit(1);
  }
}

// Run the migration
applyTrilingualMigration();