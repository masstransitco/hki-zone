// Debug script to examine incident IDs
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugIncidentIds() {
  console.log('🔍 Examining incident IDs in database...\n')
  
  try {
    // Get recent incidents
    const { data: incidents, error } = await supabase
      .from('incidents')
      .select('id, title, source_slug, created_at, source_updated_at')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (error) {
      console.error('Error fetching incidents:', error)
      return
    }
    
    console.log(`Found ${incidents.length} recent incidents:\n`)
    
    incidents.forEach((incident, index) => {
      console.log(`${index + 1}. ID: ${incident.id}`)
      console.log(`   Title: ${incident.title}`)
      console.log(`   Source: ${incident.source_slug}`)
      console.log(`   Created: ${incident.created_at}`)
      console.log(`   Updated: ${incident.source_updated_at}`)
      
      // Analyze ID pattern
      if (incident.id.includes('_')) {
        const parts = incident.id.split('_')
        console.log(`   ID Parts: ${parts.length} parts - [${parts.join(', ')}]`)
        
        // Check if it matches timestamp pattern
        const timestampPattern = /\d{8}_\d{6}_/
        if (timestampPattern.test(incident.id)) {
          console.log(`   ⚠️  Contains timestamp pattern!`)
        }
      }
      console.log('')
    })
    
    // Check for duplicates based on content
    console.log('\n🔍 Checking for potential duplicates...\n')
    
    const { data: duplicates, error: dupError } = await supabase
      .from('incidents')
      .select('id, title, source_slug, created_at')
      .order('title')
    
    if (dupError) {
      console.error('Error checking duplicates:', dupError)
      return
    }
    
    const titleMap = new Map()
    duplicates.forEach(incident => {
      const key = `${incident.source_slug}:${incident.title.toLowerCase().trim()}`
      if (titleMap.has(key)) {
        titleMap.get(key).push(incident)
      } else {
        titleMap.set(key, [incident])
      }
    })
    
    const duplicateGroups = Array.from(titleMap.values()).filter(group => group.length > 1)
    
    if (duplicateGroups.length > 0) {
      console.log(`Found ${duplicateGroups.length} groups of potential duplicates:`)
      
      duplicateGroups.slice(0, 5).forEach((group, index) => {
        console.log(`\nGroup ${index + 1}:`)
        group.forEach(incident => {
          console.log(`  - ID: ${incident.id}`)
          console.log(`    Title: ${incident.title}`)
          console.log(`    Created: ${incident.created_at}`)
        })
      })
    } else {
      console.log('No duplicate titles found.')
    }
    
  } catch (error) {
    console.error('Error in debug script:', error)
  }
}

debugIncidentIds()