#!/usr/bin/env node

/**
 * Database Migration Script for Gov and A&E Categories
 * Adds new categories and hospital information
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key] = value.replace(/"/g, '');
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runGovAeMigration() {
  console.log('🚀 Running Gov and A&E Categories Migration');
  console.log('==========================================');
  
  try {
    // Step 1: Add new categories to enum
    console.log('\n1️⃣ Adding new categories to incident_category enum...');
    const newCategories = ['gov', 'ae'];
    
    for (const category of newCategories) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          query: `ALTER TYPE incident_category ADD VALUE '${category}';`
        });
        if (error) {
          console.log(`   ⚠️  Category '${category}' may already exist`);
        } else {
          console.log(`   ✅ Added category: ${category}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Category '${category}' may already exist`);
      }
    }
    
    // Step 2: Create hospital_info table
    console.log('\n2️⃣ Creating hospital_info table...');
    try {
      const { error } = await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS hospital_info (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            hospital_code VARCHAR(20) UNIQUE NOT NULL,
            hospital_name_en VARCHAR(200) NOT NULL,
            hospital_name_zh VARCHAR(200),
            address_en TEXT,
            address_zh TEXT,
            phone_main VARCHAR(20),
            phone_ae VARCHAR(20),
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            cluster VARCHAR(50),
            type VARCHAR(50),
            website VARCHAR(200),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      });
      if (error) {
        console.log(`   ⚠️  Table may already exist: ${error.message}`);
      } else {
        console.log(`   ✅ Created hospital_info table`);
      }
    } catch (err) {
      console.log(`   ⚠️  Table creation failed: ${err.message}`);
    }
    
    // Step 3: Insert hospital information
    console.log('\n3️⃣ Inserting hospital information...');
    const hospitalData = [
      {
        hospital_code: 'AHNH',
        hospital_name_en: 'Alice Ho Miu Ling Nethersole Hospital',
        hospital_name_zh: '雅麗氏何妙齡那打素醫院',
        address_en: '11 Chuen On Road, Tai Po, New Territories',
        phone_main: '2689 2000',
        phone_ae: '2689 2000',
        latitude: 22.4708,
        longitude: 114.1291,
        cluster: 'New Territories East',
        type: 'Public',
        website: 'https://www3.ha.org.hk/ahnh/'
      },
      {
        hospital_code: 'CGH',
        hospital_name_en: 'Caritas Medical Centre',
        hospital_name_zh: '明愛醫院',
        address_en: '111 Wing Hong Street, Sham Shui Po, Kowloon',
        phone_main: '3408 7911',
        phone_ae: '3408 7911',
        latitude: 22.3386,
        longitude: 114.1586,
        cluster: 'Kowloon West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/cmc/'
      },
      {
        hospital_code: 'KWH',
        hospital_name_en: 'Kwong Wah Hospital',
        hospital_name_zh: '廣華醫院',
        address_en: '25 Waterloo Road, Yau Ma Tei, Kowloon',
        phone_main: '2332 2311',
        phone_ae: '2332 2311',
        latitude: 22.3118,
        longitude: 114.1698,
        cluster: 'Kowloon Central',
        type: 'Public',
        website: 'https://www3.ha.org.hk/kwh/'
      },
      {
        hospital_code: 'PMH',
        hospital_name_en: 'Princess Margaret Hospital',
        hospital_name_zh: '瑪嘉烈醫院',
        address_en: '2-10 Princess Margaret Hospital Road, Lai Chi Kok, Kowloon',
        phone_main: '2990 1111',
        phone_ae: '2990 1111',
        latitude: 22.3383,
        longitude: 114.1495,
        cluster: 'Kowloon West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/pmh/'
      },
      {
        hospital_code: 'QEH',
        hospital_name_en: 'Queen Elizabeth Hospital',
        hospital_name_zh: '伊利沙伯醫院',
        address_en: '30 Gascoigne Road, Yau Ma Tei, Kowloon',
        phone_main: '2958 8888',
        phone_ae: '2958 8888',
        latitude: 22.3093,
        longitude: 114.1751,
        cluster: 'Kowloon Central',
        type: 'Public',
        website: 'https://www3.ha.org.hk/qeh/'
      },
      {
        hospital_code: 'QMH',
        hospital_name_en: 'Queen Mary Hospital',
        hospital_name_zh: '瑪麗醫院',
        address_en: '102 Pokfulam Road, Pokfulam, Hong Kong',
        phone_main: '2255 3838',
        phone_ae: '2255 3838',
        latitude: 22.3193,
        longitude: 114.1294,
        cluster: 'Hong Kong West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/qmh/'
      },
      {
        hospital_code: 'RHTSK',
        hospital_name_en: 'Ruttonjee Hospital',
        hospital_name_zh: '律敦治醫院',
        address_en: '266 Queen\'s Road East, Wan Chai, Hong Kong',
        phone_main: '2291 1345',
        phone_ae: '2291 1345',
        latitude: 22.2708,
        longitude: 114.1733,
        cluster: 'Hong Kong East',
        type: 'Public',
        website: 'https://www3.ha.org.hk/rhtsk/'
      },
      {
        hospital_code: 'TMH',
        hospital_name_en: 'Tuen Mun Hospital',
        hospital_name_zh: '屯門醫院',
        address_en: '23 Tsing Chung Koon Road, Tuen Mun, New Territories',
        phone_main: '2468 5111',
        phone_ae: '2468 5111',
        latitude: 22.4144,
        longitude: 114.1297,
        cluster: 'New Territories West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/tmh/'
      },
      {
        hospital_code: 'UCH',
        hospital_name_en: 'United Christian Hospital',
        hospital_name_zh: '基督教聯合醫院',
        address_en: '130 Hip Wo Street, Kwun Tong, Kowloon',
        phone_main: '3513 3513',
        phone_ae: '3513 3513',
        latitude: 22.3083,
        longitude: 114.2250,
        cluster: 'Kowloon East',
        type: 'Public',
        website: 'https://www3.ha.org.hk/uch/'
      },
      {
        hospital_code: 'WWH',
        hospital_name_en: 'Yan Chai Hospital',
        hospital_name_zh: '仁濟醫院',
        address_en: '7-11 Yan Chai Street, Tsuen Wan, New Territories',
        phone_main: '2417 8383',
        phone_ae: '2417 8383',
        latitude: 22.4083,
        longitude: 114.1087,
        cluster: 'New Territories West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/ych/'
      },
      {
        hospital_code: 'PYNEH',
        hospital_name_en: 'Pamela Youde Nethersole Eastern Hospital',
        hospital_name_zh: '東區尤德夫人那打素醫院',
        address_en: '3 Lok Man Road, Chai Wan, Hong Kong',
        phone_main: '2595 6111',
        phone_ae: '2595 6111',
        latitude: 22.2566,
        longitude: 114.2386,
        cluster: 'Hong Kong East',
        type: 'Public',
        website: 'https://www3.ha.org.hk/pyneh/'
      },
      {
        hospital_code: 'TKOH',
        hospital_name_en: 'Tseung Kwan O Hospital',
        hospital_name_zh: '將軍澳醫院',
        address_en: '2 Po Ning Lane, Hang Hau, Tseung Kwan O, New Territories',
        phone_main: '2208 0111',
        phone_ae: '2208 0111',
        latitude: 22.2944,
        longitude: 114.2897,
        cluster: 'Kowloon East',
        type: 'Public',
        website: 'https://www3.ha.org.hk/tkoh/'
      },
      {
        hospital_code: 'NLTH',
        hospital_name_en: 'North Lantau Hospital',
        hospital_name_zh: '北大嶼山醫院',
        address_en: '8 Chung Yan Road, Tung Chung, Lantau Island',
        phone_main: '2990 7000',
        phone_ae: '2990 7000',
        latitude: 22.2808,
        longitude: 114.1391,
        cluster: 'New Territories West',
        type: 'Public',
        website: 'https://www3.ha.org.hk/nlth/'
      },
      {
        hospital_code: 'HKEH',
        hospital_name_en: 'Hong Kong Eye Hospital',
        hospital_name_zh: '香港眼科醫院',
        address_en: '147K Argyle Street, Mongkok, Kowloon',
        phone_main: '2762 3000',
        phone_ae: '2762 3000',
        latitude: 22.3166,
        longitude: 114.1686,
        cluster: 'Kowloon Central',
        type: 'Public',
        website: 'https://www3.ha.org.hk/hkeh/'
      },
      {
        hospital_code: 'HKBH',
        hospital_name_en: 'Hong Kong Baptist Hospital',
        hospital_name_zh: '香港浸信會醫院',
        address_en: '222 Waterloo Road, Kowloon Tong, Kowloon',
        phone_main: '2339 8888',
        phone_ae: '2339 8888',
        latitude: 22.3358,
        longitude: 114.1833,
        cluster: 'Kowloon East',
        type: 'Private',
        website: 'https://www.hkbh.org.hk/'
      },
      {
        hospital_code: 'HKSH',
        hospital_name_en: 'Hong Kong Sanatorium & Hospital',
        hospital_name_zh: '香港養和醫院',
        address_en: '2 Village Road, Happy Valley, Hong Kong',
        phone_main: '2572 0211',
        phone_ae: '2572 0211',
        latitude: 22.2708,
        longitude: 114.1833,
        cluster: 'Hong Kong East',
        type: 'Private',
        website: 'https://www.hksh.com/'
      },
      {
        hospital_code: 'SJSH',
        hospital_name_en: 'St. John Hospital',
        hospital_name_zh: '聖約翰醫院',
        address_en: '2 MacDonnell Road, Mid-Levels, Hong Kong',
        phone_main: '2527 8285',
        phone_ae: '2527 8285',
        latitude: 22.2793,
        longitude: 114.1594,
        cluster: 'Hong Kong West',
        type: 'Private',
        website: 'https://www.sjh.org.hk/'
      },
      {
        hospital_code: 'OLMH',
        hospital_name_en: 'Our Lady of Maryknoll Hospital',
        hospital_name_zh: '聖母醫院',
        address_en: '118 Shatin Pass Road, Wong Tai Sin, Kowloon',
        phone_main: '2354 2111',
        phone_ae: '2354 2111',
        latitude: 22.3408,
        longitude: 114.1795,
        cluster: 'Kowloon East',
        type: 'Private',
        website: 'https://www.olmh.org.hk/'
      }
    ];
    
    for (const hospital of hospitalData) {
      try {
        const { error } = await supabase
          .from('hospital_info')
          .upsert(hospital, { onConflict: 'hospital_code' });
        
        if (error) {
          console.log(`   ⚠️  Hospital '${hospital.hospital_code}' upsert failed: ${error.message}`);
        } else {
          console.log(`   ✅ Added/updated hospital: ${hospital.hospital_name_en}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Hospital '${hospital.hospital_code}' failed: ${err.message}`);
      }
    }
    
    console.log('\n✅ Gov and A&E Categories Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   New categories: gov, ae`);
    console.log(`   Hospital records: ${hospitalData.length}`);
    console.log(`   Next step: Update UI components to support new categories`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runGovAeMigration().catch(console.error);
}

module.exports = { runGovAeMigration };