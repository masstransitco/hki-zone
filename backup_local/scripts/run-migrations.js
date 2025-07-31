const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function checkDatabaseStatus() {
  console.log(`${colors.cyan}Checking database status...${colors.reset}`);
  
  const expectedColumns = [
    'id',
    'title',
    'content',
    'summary',
    'ai_summary',
    'url',
    'source',
    'author',
    'published_at',
    'image_url',
    'category',
    'created_at',
    'updated_at',
    'is_ai_enhanced',
    'original_article_id',
    'enhancement_metadata',
    'language',
    'deleted_at'
  ];
  
  try {
    // Check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('articles')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.message.includes('does not exist')) {
      console.log(`${colors.red}❌ Articles table does not exist${colors.reset}`);
      return { tableExists: false, missingColumns: expectedColumns };
    }
    
    console.log(`${colors.green}✓ Articles table exists${colors.reset}`);
    
    // Check each column
    const missingColumns = [];
    const existingColumns = [];
    
    for (const column of expectedColumns) {
      const { error } = await supabase
        .from('articles')
        .select(column)
        .limit(1);
      
      if (error && error.message.includes(`column "${column}"`)) {
        missingColumns.push(column);
        console.log(`${colors.red}  ✗ Missing column: ${column}${colors.reset}`);
      } else {
        existingColumns.push(column);
        console.log(`${colors.green}  ✓ Column exists: ${column}${colors.reset}`);
      }
    }
    
    return { tableExists: true, missingColumns, existingColumns };
    
  } catch (error) {
    console.error(`${colors.red}Error checking database:${colors.reset}`, error.message);
    return { tableExists: false, error: error.message };
  }
}

async function runLanguageMigration() {
  console.log(`\n${colors.blue}Running language field migration...${colors.reset}`);
  
  try {
    // First check if column already exists
    const { error: checkError } = await supabase
      .from('articles')
      .select('language')
      .limit(1);
    
    if (!checkError || !checkError.message.includes('column "language"')) {
      console.log(`${colors.yellow}Language column already exists, skipping migration${colors.reset}`);
      return true;
    }
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', 'add-language-field.sql');
    let migrationSQL;
    
    try {
      migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    } catch (error) {
      // If file doesn't exist, use inline SQL
      migrationSQL = `
        -- Add language field to articles table
        ALTER TABLE articles 
        ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

        -- Create index for language queries
        CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
      `;
    }
    
    console.log('Migration SQL:', migrationSQL);
    console.log(`${colors.yellow}Note: You need to run this SQL directly in Supabase SQL Editor${colors.reset}`);
    console.log(`${colors.cyan}Go to: https://app.supabase.com/project/${supabaseUrl.split('.')[0]}/sql${colors.reset}`);
    
    return false;
    
  } catch (error) {
    console.error(`${colors.red}Error running language migration:${colors.reset}`, error.message);
    return false;
  }
}

async function runDeletedAtMigration() {
  console.log(`\n${colors.blue}Running deleted_at field migration...${colors.reset}`);
  
  try {
    // First check if column already exists
    const { error: checkError } = await supabase
      .from('articles')
      .select('deleted_at')
      .limit(1);
    
    if (!checkError || !checkError.message.includes('column "deleted_at"')) {
      console.log(`${colors.yellow}deleted_at column already exists, skipping migration${colors.reset}`);
      return true;
    }
    
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250105_add_deleted_at_column.sql');
    let migrationSQL;
    
    try {
      migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    } catch (error) {
      // If file doesn't exist, use inline SQL
      migrationSQL = `
        -- Add soft delete support to articles table
        ALTER TABLE articles 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

        -- Create index for efficient filtering of non-deleted articles
        CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);

        -- Add comment for documentation
        COMMENT ON COLUMN articles.deleted_at IS 'Timestamp when the article was soft-deleted. NULL means the article is active.';
      `;
    }
    
    console.log('Migration SQL:', migrationSQL);
    console.log(`${colors.yellow}Note: You need to run this SQL directly in Supabase SQL Editor${colors.reset}`);
    console.log(`${colors.cyan}Go to: https://app.supabase.com/project/${supabaseUrl.split('.')[0]}/sql${colors.reset}`);
    
    return false;
    
  } catch (error) {
    console.error(`${colors.red}Error running deleted_at migration:${colors.reset}`, error.message);
    return false;
  }
}

async function createStorageBucket() {
  console.log(`\n${colors.blue}Checking storage bucket...${colors.reset}`);
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();
    
    if (listError) {
      console.error(`${colors.red}Error listing buckets:${colors.reset}`, listError.message);
      return false;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === 'article-images');
    
    if (bucketExists) {
      console.log(`${colors.green}✓ Storage bucket 'article-images' already exists${colors.reset}`);
      return true;
    }
    
    // Create bucket
    const { data, error } = await supabase
      .storage
      .createBucket('article-images', { 
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      });
    
    if (error) {
      console.error(`${colors.red}Error creating bucket:${colors.reset}`, error.message);
      console.log(`${colors.yellow}Please create the bucket manually in Supabase Dashboard${colors.reset}`);
      console.log(`${colors.cyan}Go to: https://app.supabase.com/project/${supabaseUrl.split('.')[0]}/storage${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✓ Successfully created storage bucket 'article-images'${colors.reset}`);
    return true;
    
  } catch (error) {
    console.error(`${colors.red}Error with storage:${colors.reset}`, error.message);
    return false;
  }
}

async function main() {
  console.log(`${colors.cyan}=== Database Migration Script ===${colors.reset}\n`);
  
  // 1. Check database status
  const status = await checkDatabaseStatus();
  
  if (!status.tableExists) {
    console.log(`\n${colors.red}Articles table does not exist!${colors.reset}`);
    console.log(`${colors.yellow}Please run the setup first:${colors.reset}`);
    console.log(`${colors.cyan}curl -X POST http://localhost:3000/api/setup-database${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`\n${colors.yellow}Summary:${colors.reset}`);
  console.log(`Total columns expected: ${18}`);
  console.log(`Existing columns: ${status.existingColumns.length}`);
  console.log(`Missing columns: ${status.missingColumns.length}`);
  
  if (status.missingColumns.length === 0) {
    console.log(`\n${colors.green}✅ All database columns exist!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}Missing columns: ${status.missingColumns.join(', ')}${colors.reset}`);
    
    // 2. Run migrations for missing columns
    if (status.missingColumns.includes('language')) {
      await runLanguageMigration();
    }
    
    if (status.missingColumns.includes('deleted_at')) {
      await runDeletedAtMigration();
    }
    
    if (status.missingColumns.includes('is_ai_enhanced') || 
        status.missingColumns.includes('original_article_id') || 
        status.missingColumns.includes('enhancement_metadata')) {
      console.log(`\n${colors.yellow}AI enhancement fields missing. Run:${colors.reset}`);
      console.log(`${colors.cyan}curl -X POST http://localhost:3000/api/admin/database/migrate-ai-enhancement${colors.reset}`);
    }
  }
  
  // 3. Check storage bucket
  await createStorageBucket();
  
  console.log(`\n${colors.cyan}=== Migration Check Complete ===${colors.reset}`);
}

// Run the script
main().catch(console.error);