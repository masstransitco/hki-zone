#!/usr/bin/env node

/**
 * Debug script to check existing enhanced articles
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function debugEnhancedArticles() {
  try {
    console.log('🔍 Checking existing enhanced articles...');
    
    // Get recently enhanced articles
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const { data: enhancedArticles, error } = await supabase
      .from('articles')
      .select('id, title, summary, created_at, is_ai_enhanced')
      .eq('is_ai_enhanced', true)
      .gte('created_at', twoDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching enhanced articles:', error);
      return;
    }

    console.log(`📊 Found ${enhancedArticles?.length || 0} enhanced articles in last 2 days:`);
    
    enhancedArticles?.forEach((article, index) => {
      console.log(`${index + 1}. "${article.title?.substring(0, 80)}..."`);
      console.log(`   Created: ${new Date(article.created_at).toLocaleString()}`);
      console.log(`   Enhanced: ${article.is_ai_enhanced}`);
      if (article.summary) {
        console.log(`   Summary: ${article.summary.substring(0, 100)}...`);
      }
      console.log('   ---');
    });

    // Check specifically for typhoon-related articles
    console.log('\n🌪️ Checking for typhoon-related enhanced articles...');
    
    const { data: typhoonArticles, error: typhoonError } = await supabase
      .from('articles')
      .select('id, title, summary, created_at, is_ai_enhanced')
      .eq('is_ai_enhanced', true)
      .or('title.ilike.%typhoon%,title.ilike.%風球%,title.ilike.%颱風%,title.ilike.%台风%,title.ilike.%signal%,title.ilike.%韋帕%,title.ilike.%wipha%')
      .gte('created_at', twoDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (typhoonError) {
      console.error('❌ Error fetching typhoon articles:', error);
      return;
    }

    console.log(`🌪️ Found ${typhoonArticles?.length || 0} typhoon-related enhanced articles:`);
    
    typhoonArticles?.forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}"`);
      console.log(`   Created: ${new Date(article.created_at).toLocaleString()}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('💥 Error in debug script:', error);
  }
}

debugEnhancedArticles();