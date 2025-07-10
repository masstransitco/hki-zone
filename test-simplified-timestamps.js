// Test script to verify simplified timestamp approach
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

function formatTimestamp(timestamp) {
  if (!timestamp) return 'NULL';
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

async function testSimplifiedTimestamps() {
  try {
    console.log('\n=== Testing Simplified Timestamp Approach ===');
    console.log('Current time:', formatTimestamp(new Date()));
    
    // Test inserting a new article with simplified timestamp approach
    const testArticle = {
      category: 'tech',
      title: 'Test Article - Simplified Timestamps',
      url: `https://test.example.com/test-${Date.now()}`,
      published_at: new Date().toISOString(), // Current time as published_at
      article_status: 'pending',
      image_status: 'pending',
      source: 'Test Source',
      author: 'Test Author'
    };
    
    console.log('\n📝 Inserting test article with simplified timestamp approach...');
    console.log(`   published_at: ${formatTimestamp(testArticle.published_at)}`);
    
    const { data: inserted, error: insertError } = await supabase
      .from('perplexity_news')
      .insert(testArticle)
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return;
    }
    
    console.log('\n✅ Article inserted successfully!');
    console.log(`   ID: ${inserted.id}`);
    console.log(`   published_at: ${formatTimestamp(inserted.published_at)}`);
    console.log(`   created_at:   ${formatTimestamp(inserted.created_at)}`);
    console.log(`   updated_at:   ${formatTimestamp(inserted.updated_at)}`);
    
    // Test that database triggers are working
    const publishedTime = new Date(inserted.published_at);
    const createdTime = new Date(inserted.created_at);
    const updatedTime = new Date(inserted.updated_at);
    
    console.log('\n🔍 Timestamp Analysis:');
    
    // Check if created_at and updated_at are close to published_at (should be within seconds)
    const createdDiff = Math.abs(createdTime - publishedTime) / 1000; // seconds
    const updatedDiff = Math.abs(updatedTime - publishedTime) / 1000; // seconds
    
    if (createdDiff < 5) {
      console.log(`   ✅ created_at is properly auto-generated (${createdDiff.toFixed(2)}s difference)`);
    } else {
      console.log(`   ⚠️  created_at seems off (${createdDiff.toFixed(2)}s difference)`);
    }
    
    if (updatedDiff < 5) {
      console.log(`   ✅ updated_at is properly auto-generated (${updatedDiff.toFixed(2)}s difference)`);
    } else {
      console.log(`   ⚠️  updated_at seems off (${updatedDiff.toFixed(2)}s difference)`);
    }
    
    // Test that updates trigger updated_at change
    console.log('\n🔄 Testing update trigger...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    const { data: updated, error: updateError } = await supabase
      .from('perplexity_news')
      .update({ article_status: 'enriched' })
      .eq('id', inserted.id)
      .select()
      .single();
      
    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      const newUpdatedTime = new Date(updated.updated_at);
      const updateDiff = (newUpdatedTime - updatedTime) / 1000; // seconds
      
      console.log(`   updated_at after change: ${formatTimestamp(updated.updated_at)}`);
      if (updateDiff > 0.5) {
        console.log(`   ✅ updated_at trigger working (${updateDiff.toFixed(2)}s later)`);
      } else {
        console.log(`   ⚠️  updated_at trigger may not be working (only ${updateDiff.toFixed(2)}s difference)`);
      }
    }
    
    // Clean up test article
    console.log('\n🧹 Cleaning up test article...');
    const { error: deleteError } = await supabase
      .from('perplexity_news')
      .delete()
      .eq('id', inserted.id);
      
    if (deleteError) {
      console.error('❌ Cleanup failed:', deleteError);
    } else {
      console.log('   ✅ Test article deleted');
    }
    
    console.log('\n📋 Summary:');
    console.log('   • Database automatically manages created_at and updated_at');
    console.log('   • Application only needs to set published_at to current time');
    console.log('   • This matches the simplified approach used by the articles table');
    console.log('   • Feed ordering by updated_at will work correctly');
    
  } catch (err) {
    console.error('Error during test:', err.message);
  }
}

testSimplifiedTimestamps();