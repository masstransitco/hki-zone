const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHKMASignalStructure() {
  console.log('🔍 Checking HKMA signal structure...');
  
  try {
    // Get a sample HKMA signal
    const { data: signals, error } = await supabase
      .from('government_signals')
      .select('source_identifier, feed_group, content, processing_status')
      .eq('feed_group', 'hkma_press')
      .eq('processing_status', 'content_partial')
      .limit(1);
    
    if (error) {
      console.error('❌ Error fetching HKMA signals:', error);
      return;
    }
    
    if (signals.length === 0) {
      console.log('ℹ️ No HKMA signals with content_partial status found');
      return;
    }
    
    const signal = signals[0];
    console.log('\n📄 HKMA Signal Structure:');
    console.log('Source Identifier:', signal.source_identifier);
    console.log('Feed Group:', signal.feed_group);
    console.log('Processing Status:', signal.processing_status);
    console.log('\n📝 Content Structure:', JSON.stringify(signal.content, null, 2));
    
    // Check if we have languages structure
    const languages = signal.content?.languages || {};
    console.log('\n🌐 Languages available:', Object.keys(languages));
    
    // Check each language
    for (const [lang, content] of Object.entries(languages)) {
      console.log(`\n${lang.toUpperCase()} Content:`);
      console.log('  Title:', content.title || 'Missing');
      console.log('  Body length:', (content.body || '').length);
      console.log('  Link:', content.link || 'Missing');
    }
    
    // Check meta URLs
    const metaUrls = signal.content?.meta?.urls || {};
    if (Object.keys(metaUrls).length > 0) {
      console.log('\n🔗 Meta URLs:', metaUrls);
    } else {
      console.log('\n🔗 No meta URLs found');
    }
    
  } catch (error) {
    console.error('❌ Error checking HKMA signal structure:', error);
  }
}

// Run the script
checkHKMASignalStructure().catch(console.error);