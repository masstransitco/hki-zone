const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkSchema() {
  try {
    console.log('🔍 Testing article save with a sample record...');
    
    // Create a test article using simplified schema (only existing fields)
    const testArticle = {
      title: 'TEST - Schema Check Article',
      content: 'This is a test article to check schema compatibility',
      summary: 'Test summary',
      url: 'https://test-schema-check-' + Date.now() + '.com',
      source: 'TEST',
      category: 'Test',
      is_ai_enhanced: true,
      image_url: null,
      published_at: new Date().toISOString(),
      
      // Store all additional fields in enhancement_metadata
      enhancement_metadata: {
        test: true,
        // Trilingual tracking
        trilingual_batch_id: 'test_batch_123',
        source_article_id: 'test_source_456',
        language_variant: 'en',
        language_order: 1,
        quality_score: 85,
        language: 'en',
        // Additional enhanced fields
        key_points: ['Test point 1', 'Test point 2'],
        why_it_matters: 'This is a test significance statement',
        structured_sources: { test: 'sources' }
      }
    };
    
    console.log('📝 Attempting to insert test article...');
    
    const { data, error } = await supabase
      .from('articles')
      .insert(testArticle)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Insert failed - this reveals missing fields:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      // If it's a column doesn't exist error, we know what's missing
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        const match = error.message.match(/column "([^"]+)" of relation "articles" does not exist/);
        if (match) {
          console.log(`\n🎯 Missing field identified: ${match[1]}`);
        }
      }
    } else {
      console.log('✅ Test article saved successfully!');
      console.log('Article ID:', data.id);
      
      // Clean up the test article
      console.log('🧹 Cleaning up test article...');
      await supabase
        .from('articles')
        .delete()
        .eq('id', data.id);
      console.log('✅ Test article deleted');
    }
    
  } catch (error) {
    console.error('❌ Error during schema check:', error);
  }
}

checkSchema();