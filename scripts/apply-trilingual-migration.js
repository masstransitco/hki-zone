const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

async function applyTrilingualMigration() {
  console.log('🚀 Starting trilingual tracking migration...\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing required environment variables!');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'add-trilingual-tracking.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    console.log('📋 Migration script loaded successfully');
    console.log('📊 Applying trilingual tracking columns and indexes...\n');

    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments
        if (statement.startsWith('--')) continue;

        console.log(`\n🔧 Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          // Some errors are expected if columns/indexes already exist
          if (error.message.includes('already exists')) {
            console.log('⚠️  Already exists (skipping)');
          } else {
            throw error;
          }
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    const { data: columns, error: verifyError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name IN ('trilingual_batch_id', 'source_article_id', 'language_variant', 'language_order', 'quality_score')
        ORDER BY column_name;
      `
    });

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
    } else if (columns && columns.length > 0) {
      console.log('\n✅ Migration verified! New columns found:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Successful operations: ${successCount}`);
    console.log(`   ❌ Failed operations: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Trilingual tracking migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please check the output above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Note about manual execution
console.log('⚠️  Note: If the exec_sql RPC function is not available, you may need to run the SQL manually.');
console.log('📄 SQL file location: scripts/add-trilingual-tracking.sql\n');

// Check if Supabase RPC function exists
async function checkRPCFunction() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  
  // Try a simple query instead
  const { data, error } = await supabase
    .from('articles')
    .select('id')
    .limit(1);

  if (!error) {
    console.log('✅ Database connection verified\n');
    return true;
  } else {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Alternative: Direct column check and creation
async function applyMigrationDirect() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log('📋 Applying migration using direct approach...\n');

  // Check if columns exist by attempting to query them
  const { data: testQuery, error: testError } = await supabase
    .from('articles')
    .select('id, trilingual_batch_id, source_article_id, language_variant, language_order, quality_score')
    .limit(1);

  if (testError && testError.message.includes('column')) {
    console.log('❌ New columns not found. Please run the SQL migration manually:');
    console.log('\n1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of: scripts/add-trilingual-tracking.sql');
    console.log('4. Run the SQL script');
    console.log('\n📄 Migration file: scripts/add-trilingual-tracking.sql');
  } else {
    console.log('✅ Trilingual tracking columns already exist!');
    console.log('🎉 No migration needed - your database is up to date.');
  }
}

// Main execution
(async () => {
  const canConnect = await checkRPCFunction();
  
  if (canConnect) {
    // Try direct approach since RPC might not be available
    await applyMigrationDirect();
  } else {
    console.log('\n❌ Cannot connect to database. Please check your environment variables.');
  }
})();