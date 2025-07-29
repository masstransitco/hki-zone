import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { selectArticlesForEnhancement } from './app/api/cron/select-articles/route';
import { enhanceSelectedArticles } from './app/api/cron/enhance-selected/route';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSelection() {
  console.log('Running article selection...');
  
  try {
    const result = await selectArticlesForEnhancement();
    console.log(`Selected ${result.selected} articles:`);
    
    // Get the selected articles
    const { data: selected } = await supabase
      .from('articles')
      .select('id, title, source')
      .eq('is_ai_enhanced', false)
      .order('created_at', { ascending: false })
      .limit(result.selected);
      
    if (selected) {
      selected.forEach((a, i) => {
        console.log(`${i + 1}. ${a.title.substring(0, 60)}... (${a.source})`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('Selection error:', error);
    throw error;
  }
}

async function runEnhancement() {
  console.log('\nRunning article enhancement...');
  
  try {
    const result = await enhanceSelectedArticles();
    console.log(`Enhanced ${result.processed} articles`);
    
    if (result.processed > 0) {
      // Get the enhanced articles
      const { data: enhanced } = await supabase
        .from('articles')
        .select('id, title, language, enhancement_metadata')
        .eq('is_ai_enhanced', true)
        .order('created_at', { ascending: false })
        .limit(result.processed * 3); // 3 languages per article
        
      if (enhanced) {
        console.log('\nEnhanced articles:');
        const grouped = enhanced.reduce((acc, article) => {
          const batchId = article.enhancement_metadata?.trilingual_batch_id;
          if (!acc[batchId]) acc[batchId] = [];
          acc[batchId].push(article);
          return acc;
        }, {} as Record<string, any[]>);
        
        Object.entries(grouped).forEach(([batchId, articles]) => {
          console.log(`\nBatch: ${batchId}`);
          articles.forEach(a => {
            const sources = a.enhancement_metadata?.sources?.length || 0;
            console.log(`  - [${a.language}] ${a.title.substring(0, 50)}... (${sources} sources)`);
          });
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Enhancement error:', error);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'select') {
    await runSelection();
  } else if (command === 'enhance') {
    await runEnhancement();
  } else if (command === 'both') {
    await runSelection();
    console.log('\n' + '='.repeat(80) + '\n');
    await runEnhancement();
  } else {
    console.log('Usage: tsx run-cron.ts [select|enhance|both]');
  }
}

main().catch(console.error);