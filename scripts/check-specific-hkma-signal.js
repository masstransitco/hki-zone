const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecificHKMASignal() {
  console.log('🔍 Checking specific HKMA signal that was processed...');
  
  try {
    // Check the signal that was reported as successful
    const { data: signal, error } = await supabase
      .from('government_signals')
      .select('source_identifier, processing_status, content, updated_at')
      .eq('source_identifier', 'hkma_press_12_2024123110_')
      .single();
    
    if (error) {
      console.error('❌ Error fetching signal:', error);
      return;
    }
    
    console.log('\n📄 Signal Info:');
    console.log('Source Identifier:', signal.source_identifier);
    console.log('Processing Status:', signal.processing_status);
    console.log('Last Updated:', signal.updated_at);
    
    const languages = signal.content?.languages || {};
    console.log('\n🌐 Language Content:');
    
    for (const [lang, content] of Object.entries(languages)) {
      console.log(`\n${lang.toUpperCase()}:`);
      console.log('  Title:', content.title || 'Missing');
      console.log('  Body Length:', (content.body || '').length);
      console.log('  Has Body:', (content.body || '').length > 0 ? '✅' : '❌');
      if (content.body && content.body.length > 0) {
        console.log('  Body Preview:', content.body.substring(0, 100) + '...');
      }
      console.log('  Scraped At:', content.scraped_at || 'Not set');
    }
    
    // Check URLs
    const metaUrls = signal.content?.meta?.urls || {};
    console.log('\n🔗 URLs to scrape:');
    for (const [lang, url] of Object.entries(metaUrls)) {
      console.log(`  ${lang}: ${url}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking specific HKMA signal:', error);
  }
}

// Run the script
checkSpecificHKMASignal().catch(console.error);