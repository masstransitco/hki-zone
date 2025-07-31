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
  console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
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

async function checkImageMetadataColumn() {
  console.log(`${colors.cyan}Checking if image_metadata column exists...${colors.reset}`);
  
  try {
    // Try to select the image_metadata column
    const { error } = await supabase
      .from('articles')
      .select('image_metadata')
      .limit(1);
    
    if (error && error.message.includes('column "image_metadata"')) {
      console.log(`${colors.yellow}Column 'image_metadata' does not exist${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✓ Column 'image_metadata' already exists${colors.reset}`);
    return true;
    
  } catch (error) {
    console.error(`${colors.red}Error checking column:${colors.reset}`, error.message);
    return false;
  }
}

async function showMigrationInstructions() {
  console.log(`\n${colors.blue}=== Migration Instructions ===${colors.reset}`);
  
  // Read the migration SQL file
  const migrationPath = path.join(__dirname, 'add-image-metadata.sql');
  let migrationSQL;
  
  try {
    migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`\n${colors.green}Found migration file: ${migrationPath}${colors.reset}`);
  } catch (error) {
    // If file doesn't exist, use inline SQL
    migrationSQL = `-- Add image_metadata column to store different image versions
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';`;
    console.log(`\n${colors.yellow}Migration file not found, using inline SQL${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}SQL to execute:${colors.reset}`);
  console.log('----------------------------------------');
  console.log(migrationSQL);
  console.log('----------------------------------------');
  
  console.log(`\n${colors.yellow}To run this migration:${colors.reset}`);
  console.log(`1. Go to your Supabase SQL Editor:`);
  console.log(`   ${colors.cyan}https://app.supabase.com/project/${supabaseUrl.split('.')[0]}/sql${colors.reset}`);
  console.log(`2. Copy and paste the SQL above`);
  console.log(`3. Click "Run" to execute the migration`);
  
  console.log(`\n${colors.blue}Alternative: Using psql command line${colors.reset}`);
  console.log(`If you have psql installed and your DATABASE_URL, you can run:`);
  console.log(`${colors.cyan}psql $DATABASE_URL < scripts/add-image-metadata.sql${colors.reset}`);
}

async function testImageMetadataUsage() {
  console.log(`\n${colors.blue}=== Testing image_metadata Usage ===${colors.reset}`);
  
  try {
    // Get a sample article
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, image_url, image_metadata')
      .limit(5);
    
    if (error) {
      console.error(`${colors.red}Error fetching articles:${colors.reset}`, error.message);
      return;
    }
    
    console.log(`\n${colors.green}Sample articles with image data:${colors.reset}`);
    articles.forEach((article, index) => {
      console.log(`\n${index + 1}. ${article.title.substring(0, 50)}...`);
      console.log(`   ID: ${article.id}`);
      console.log(`   Image URL: ${article.image_url ? 'Yes' : 'No'}`);
      console.log(`   Image Metadata: ${article.image_metadata ? JSON.stringify(article.image_metadata) : 'None'}`);
    });
    
  } catch (error) {
    console.error(`${colors.red}Error testing usage:${colors.reset}`, error.message);
  }
}

async function main() {
  console.log(`${colors.cyan}=== Image Metadata Column Migration ===${colors.reset}\n`);
  
  // Check if column exists
  const columnExists = await checkImageMetadataColumn();
  
  if (!columnExists) {
    // Show migration instructions
    await showMigrationInstructions();
    
    console.log(`\n${colors.yellow}After running the migration, you can re-run this script to verify.${colors.reset}`);
  } else {
    // Column exists, show current usage
    await testImageMetadataUsage();
    
    console.log(`\n${colors.green}✅ Migration complete! The image_metadata column is ready to use.${colors.reset}`);
    console.log(`\n${colors.cyan}How it works:${colors.reset}`);
    console.log(`- When uploading images, they will be compressed and optimized`);
    console.log(`- Multiple versions will be stored in image_metadata:`);
    console.log(`  • original: The originally uploaded image`);
    console.log(`  • optimized: 1200x630px version for social media`);
    console.log(`  • whatsapp: 800x800px version for WhatsApp`);
    console.log(`- The optimized version will be used for Open Graph tags`);
  }
  
  console.log(`\n${colors.cyan}=== Complete ===${colors.reset}`);
}

// Run the script
main().catch(console.error);