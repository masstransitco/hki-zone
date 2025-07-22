const fs = require('fs');

// Load environment variables from .env.cli
try {
  const envFile = fs.readFileSync('.env.cli', 'utf8');
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
  console.error('Could not load .env.cli:', error.message);
  process.exit(1);
}

async function testCronAuthentication() {
  console.log('🔐 TESTING CRON JOB AUTHENTICATION LOGIC');
  console.log('='.repeat(50));
  
  // Test the exact authentication logic from the cron job
  const testCases = [
    {
      name: 'Vercel Cron Request (Expected)',
      userAgent: 'vercel-cron/1.0',
      authHeader: null,
      expected: 'PASS'
    },
    {
      name: 'Manual Cron with Secret (Backup)',
      userAgent: 'curl/7.68.0',
      authHeader: `Bearer ${process.env.CRON_SECRET || 'missing'}`,
      expected: process.env.CRON_SECRET ? 'PASS' : 'FAIL'
    },
    {
      name: 'Unauthorized Request',
      userAgent: 'Mozilla/5.0',
      authHeader: 'Bearer wrong-secret',
      expected: 'FAIL'
    }
  ];
  
  console.log(`Environment check:`);
  console.log(`  CRON_SECRET set: ${process.env.CRON_SECRET ? 'YES' : 'NO'}`);
  if (process.env.CRON_SECRET) {
    console.log(`  CRON_SECRET value: ${process.env.CRON_SECRET}`);
  }
  
  console.log(`\\nAuthentication Tests:`);
  
  testCases.forEach((testCase, i) => {
    console.log(`\\n${i + 1}. ${testCase.name}`);
    console.log(`   User-Agent: ${testCase.userAgent || 'none'}`);
    console.log(`   Auth Header: ${testCase.authHeader || 'none'}`);
    
    // This is the exact logic from the cron job
    const isValidCron = testCase.userAgent === 'vercel-cron/1.0';
    const isValidAuth = testCase.authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const passes = isValidCron || isValidAuth;
    
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Actual: ${passes ? 'PASS' : 'FAIL'}`);
    console.log(`   Match: ${passes && testCase.expected === 'PASS' ? '✅' : '❌'}`);
  });
}

async function checkProductionIssues() {
  console.log('\\n\\n🔍 LIKELY PRODUCTION ISSUES');
  console.log('='.repeat(50));
  
  console.log('Based on the evidence, the most likely issues are:');
  console.log('\\n1. 🚨 CRON_SECRET Missing in Production');
  console.log('   • Local .env.cli has CRON_SECRET, but Vercel might not');
  console.log('   • Vercel cron jobs need CRON_SECRET environment variable');
  console.log('   • Without it, cron requests get 401 Unauthorized');
  
  console.log('\\n2. 🕐 Vercel Cron Jobs Not Enabled');
  console.log('   • vercel.json has cron config, but jobs might be disabled');
  console.log('   • Check Vercel Dashboard → Functions → Cron');
  console.log('   • Verify cron jobs appear and show as "enabled"');
  
  console.log('\\n3. 🚫 Function Authentication Logic Issue');
  console.log('   • Current logic requires EITHER vercel-cron/1.0 OR valid secret');
  console.log('   • If CRON_SECRET is undefined, the OR condition always fails');
  console.log('   • This breaks Vercel cron requests');
  
  console.log('\\n✅ DEFINITIVE FIX:');
  console.log('   1. Set CRON_SECRET in Vercel environment variables');
  console.log('   2. Modify authentication to handle missing CRON_SECRET');
  console.log('   3. Add fallback authentication for Vercel cron requests');
}

async function generateAuthFix() {
  console.log('\\n\\n🔧 AUTHENTICATION FIX CODE');
  console.log('='.repeat(50));
  
  console.log('Replace the current authentication logic with this:');
  console.log('\\n```typescript');
  console.log(`// Enhanced authentication for cron jobs
const authHeader = request.headers.get('authorization')
const userAgent = request.headers.get('user-agent')

// Allow Vercel cron requests (primary method)
const isVercelCron = userAgent === 'vercel-cron/1.0'

// Allow manual requests with valid secret (backup method)
const isValidSecret = process.env.CRON_SECRET && 
                      authHeader === \`Bearer \${process.env.CRON_SECRET}\`

// Allow either method
if (!isVercelCron && !isValidSecret) {
  console.log(\`❌ UNAUTHORIZED: userAgent=\${userAgent}, hasSecret=\${!!process.env.CRON_SECRET}\`)
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

console.log(\`✅ Authentication: \${isVercelCron ? 'Vercel Cron' : 'Secret Auth'}\`)`);
  console.log('```');
  
  console.log('\\nThis fixes the issue by:');
  console.log('• Clearly separating Vercel cron auth from manual auth');
  console.log('• Handling the case where CRON_SECRET is undefined');
  console.log('• Adding better logging for production debugging');
}

async function main() {
  await testCronAuthentication();
  await checkProductionIssues();
  await generateAuthFix();
  
  console.log('\\n\\n🎯 IMMEDIATE ACTION PLAN:');
  console.log('1. Apply the authentication fix to all cron endpoints');
  console.log('2. Ensure CRON_SECRET is set in Vercel environment variables');
  console.log('3. Deploy the fix and monitor Vercel cron logs');
  console.log('4. Verify new selections appear with "cron_automated" method');
}

main().catch(console.error);