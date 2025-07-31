const https = require('https');

// Production debugging script
async function checkProductionEndpoint(url, description) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Checking ${description}...`);
    console.log(`   URL: ${url}`);
    
    const startTime = Date.now();
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response Time: ${responseTime}ms`);
        console.log(`   Headers:`, res.headers);
        
        try {
          const json = JSON.parse(data);
          console.log(`   Response:`, JSON.stringify(json, null, 4));
          resolve({ success: true, status: res.statusCode, data: json, responseTime });
        } catch (error) {
          console.log(`   Raw Response: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
          resolve({ success: false, status: res.statusCode, error: 'Invalid JSON', responseTime });
        }
      });
    }).on('error', (err) => {
      const responseTime = Date.now() - startTime;
      console.log(`   ❌ Error: ${err.message}`);
      resolve({ success: false, error: err.message, responseTime });
    });
  });
}

async function testCronEndpoint(url, description, cronSecret) {
  return new Promise((resolve) => {
    console.log(`\n🤖 Testing ${description} (simulating Vercel cron)...`);
    console.log(`   URL: ${url}`);
    
    const postData = JSON.stringify({});
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'vercel-cron/1.0',
        'Authorization': `Bearer ${cronSecret}`
      }
    };
    
    const startTime = Date.now();
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Response Time: ${responseTime}ms`);
        
        try {
          const json = JSON.parse(data);
          console.log(`   Response:`, JSON.stringify(json, null, 4));
          resolve({ success: true, status: res.statusCode, data: json, responseTime });
        } catch (error) {
          console.log(`   Raw Response: ${data.substring(0, 500)}${data.length > 500 ? '...' : ''}`);
          resolve({ success: false, status: res.statusCode, error: 'Invalid JSON', responseTime });
        }
      });
    });
    
    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      console.log(`   ❌ Error: ${err.message}`);
      resolve({ success: false, error: err.message, responseTime });
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  // You'll need to replace these with your actual production URLs
  const PRODUCTION_DOMAIN = 'your-app.vercel.app'; // Replace with actual domain
  const CRON_SECRET = 'your-cron-secret'; // Replace with actual secret
  
  console.log('🚀 PRODUCTION CRON JOB DEBUG');
  console.log('='.repeat(60));
  console.log(`⏰ Check time: ${new Date().toISOString()}`);
  
  if (PRODUCTION_DOMAIN === 'your-app.vercel.app') {
    console.log('❌ Please update the PRODUCTION_DOMAIN in this script with your actual Vercel domain');
    console.log('   Find it in your Vercel dashboard or deployment URL');
    return;
  }
  
  if (CRON_SECRET === 'your-cron-secret') {
    console.log('❌ Please update the CRON_SECRET in this script with your actual cron secret');
    console.log('   Find it in your Vercel environment variables (CRON_SECRET)');
    return;
  }
  
  // Test endpoints
  const baseUrl = `https://${PRODUCTION_DOMAIN}`;
  
  // 1. Check selection endpoint status (GET)
  await checkProductionEndpoint(
    `${baseUrl}/api/cron/select-article`,
    'Selection Endpoint Status'
  );
  
  // 2. Check enhancement endpoint status (GET)
  await checkProductionEndpoint(
    `${baseUrl}/api/cron/enhance-selected`,
    'Enhancement Endpoint Status'
  );
  
  // 3. Check cleanup endpoint status (GET)
  await checkProductionEndpoint(
    `${baseUrl}/api/cron/cleanup-stuck-selections`,
    'Cleanup Endpoint Status'
  );
  
  // 4. Test selection cron job (POST - simulating Vercel)
  await testCronEndpoint(
    `${baseUrl}/api/cron/select-article`,
    'Selection Cron Job',
    CRON_SECRET
  );
  
  // 5. Test enhancement cron job (POST - simulating Vercel)
  await testCronEndpoint(
    `${baseUrl}/api/cron/enhance-selected`,
    'Enhancement Cron Job',
    CRON_SECRET
  );
  
  // 6. Test cleanup cron job (POST - simulating Vercel)
  await testCronEndpoint(
    `${baseUrl}/api/cron/cleanup-stuck-selections`,
    'Cleanup Cron Job',
    CRON_SECRET
  );
  
  console.log('\\n\\n🎯 DEBUGGING RECOMMENDATIONS:');
  console.log('1. Check Vercel Function Logs for actual cron execution');
  console.log('2. Verify CRON_SECRET environment variable is set correctly');
  console.log('3. Confirm cron jobs are enabled in vercel.json');
  console.log('4. Check if Vercel cron jobs are running on schedule in dashboard');
  console.log('5. Look for any deployment errors that might disable cron jobs');
  
  console.log('\\n📋 NEXT STEPS:');
  console.log('• Go to Vercel Dashboard → Your Project → Functions → Cron');
  console.log('• Check the logs for /api/cron/select-article around :00, :15, :30, :45');
  console.log('• Look for the enhanced logging we just added');
  console.log('• If no logs appear, the cron job is not running at all');
}

main().catch(console.error);