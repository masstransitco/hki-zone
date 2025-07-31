import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAllFeeds() {
  const { data: feeds } = await supabase
    .from('gov_feeds_unified')
    .select('base_slug, name_en, department, active, last_fetch_en')
    .order('department', { ascending: true })
  
  console.log('All Government Feeds Status:')
  console.log('==============================')
  
  const byDept: Record<string, any[]> = {}
  feeds?.forEach(f => {
    if (!byDept[f.department]) byDept[f.department] = []
    byDept[f.department].push(f)
  })
  
  Object.entries(byDept).forEach(([dept, deptFeeds]) => {
    console.log(`\n${dept.toUpperCase()}:`)
    deptFeeds.forEach(f => {
      const status = f.active ? '✓' : '✗'
      const lastFetch = f.last_fetch_en ? new Date(f.last_fetch_en).toLocaleDateString() : 'Never'
      console.log(`  ${status} ${f.base_slug} - ${f.name_en} (Last: ${lastFetch})`)
    })
  })
  
  // Count active vs inactive
  const activeCount = feeds?.filter(f => f.active).length || 0
  const totalCount = feeds?.length || 0
  
  console.log(`\n\nSummary: ${activeCount} active feeds out of ${totalCount} total`)
}

checkAllFeeds().catch(console.error)