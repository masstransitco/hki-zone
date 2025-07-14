const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkDatabaseFields() {
  try {
    console.log('🔍 Checking articles table schema...');
    
    // Get all columns in articles table
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'articles')
      .order('ordinal_position');
    
    if (error) {
      console.error('❌ Error checking schema:', error);
      return;
    }
    
    console.log('\n📊 Current articles table schema:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check for required fields for trilingual enhancement
    const requiredFields = [
      'trilingual_batch_id',
      'source_article_id', 
      'language_variant',
      'language_order',
      'quality_score',
      'is_ai_enhanced',
      'enhancement_metadata',
      'language',
      'key_points',
      'why_it_matters',
      'structured_sources'
    ];
    
    console.log('\n🔍 Checking required fields for trilingual enhancement:');
    const existingFields = columns.map(col => col.column_name);
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (existingFields.includes(field)) {
        console.log(`  ✅ ${field}`);
      } else {
        console.log(`  ❌ ${field} - MISSING`);
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      console.log(`\n⚠️  Found ${missingFields.length} missing fields:`);
      missingFields.forEach(field => console.log(`    - ${field}`));
    } else {
      console.log('\n✅ All required fields are present!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDatabaseFields();