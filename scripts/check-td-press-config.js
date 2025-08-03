const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTDPressConfig() {
  console.log('🔍 Checking TD press scraping configuration...');
  
  try {
    // Check if td_press has scraping configuration
    const { data: tdPressConfig, error } = await supabase
      .from('government_feed_sources')
      .select('feed_group, scraping_config')
      .eq('feed_group', 'td_press')
      .single();
    
    if (error) {
      console.error('❌ Error fetching TD press config:', error);
      return;
    }
    
    console.log('\n📋 Current TD Press Configuration:');
    console.log(JSON.stringify(tdPressConfig.scraping_config, null, 2));
    
    // Check sample TD press signal structure
    const { data: tdPressSignals, error: signalsError } = await supabase
      .from('government_signals')
      .select('source_identifier, content, processing_status')
      .eq('feed_group', 'td_press')
      .eq('processing_status', 'content_partial')
      .limit(2);
    
    if (signalsError) {
      console.error('❌ Error fetching TD press signals:', signalsError);
      return;
    }
    
    console.log('\n📄 Sample TD Press Signals:');
    tdPressSignals.forEach((signal, i) => {
      console.log(`\n${i + 1}. ${signal.source_identifier}`);
      console.log('   Processing Status:', signal.processing_status);
      
      const languages = signal.content?.languages || {};
      console.log('   Languages:', Object.keys(languages));
      
      // Check URLs
      const metaUrls = signal.content?.meta?.urls || {};
      if (Object.keys(metaUrls).length > 0) {
        console.log('   Meta URLs:', metaUrls);
      }
      
      // Check individual language links
      for (const [lang, content] of Object.entries(languages)) {
        console.log(`   ${lang} link:`, content.link || 'Missing');
        console.log(`   ${lang} body length:`, (content.body || '').length);
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking TD press configuration:', error);
  }
}

// Run the script
checkTDPressConfig().catch(console.error);