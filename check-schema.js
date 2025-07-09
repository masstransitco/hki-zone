const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env vars
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
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkActualSchema() {
  console.log('=== Checking Actual Schema ===');
  
  // Check information_schema
  const { data: schemaData, error: schemaError } = await supabase
    .rpc('exec_sql', { 
      sql: `SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'perplexity_news' 
            ORDER BY ordinal_position;`
    });
  
  if (schemaError) {
    console.error('Schema query error:', schemaError);
  } else {
    console.log('Columns in information_schema:');
    if (schemaData && schemaData.length > 0) {
      schemaData.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('  No columns found');
    }
  }
  
  // Check if we can select specific enhanced columns
  console.log('\n=== Testing Enhanced Column Selection ===');
  const enhancedColumns = ['enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources'];
  
  for (const column of enhancedColumns) {
    const { data, error } = await supabase
      .from('perplexity_news')
      .select(column)
      .limit(1);
    
    console.log(`${column}: ${error ? '❌ ' + error.message : '✅ OK'}`);
  }
  
  // Try to refresh the schema cache
  console.log('\n=== Attempting Schema Cache Refresh ===');
  const { data: refreshData, error: refreshError } = await supabase
    .rpc('exec_sql', { 
      sql: `NOTIFY pgrst, 'reload schema';`
    });
  
  if (refreshError) {
    console.error('Schema refresh error:', refreshError);
  } else {
    console.log('Schema refresh command sent');
  }
}

checkActualSchema();