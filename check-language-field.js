const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkLanguageField() {
  try {
    console.log('🔍 Checking if language field exists in articles table...');
    
    // Try to select the language field
    const { data, error } = await supabase
      .from('articles')
      .select('id, language')
      .limit(1);
    
    if (error) {
      if (error.message.includes('column "language"')) {
        console.log('❌ Language column does NOT exist in the database');
        console.log('Error:', error.message);
        return false;
      } else {
        console.log('❌ Other error checking language field:', error);
        return false;
      }
    } else {
      console.log('✅ Language column EXISTS in the database');
      console.log('Sample data:', data);
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error checking language field:', error);
    return false;
  }
}

checkLanguageField();