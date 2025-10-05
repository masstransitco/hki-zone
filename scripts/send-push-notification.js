#!/usr/bin/env node

/**
 * APNs Push Notification Sender
 *
 * Setup:
 * 1. Download your .p8 key from Apple Developer portal
 * 2. Get your Key ID and Team ID from the portal
 * 3. Install dependencies: npm install node-apn
 * 4. Run: node scripts/send-push-notification.js
 */

const apn = require('apn');
const fs = require('fs');
const path = require('path');

// Configuration - replace with your actual values
const config = {
  // Path to your .p8 key file (download from Apple Developer portal)
  keyPath: path.join(__dirname, 'AuthKey_XXXXXXXXXX.p8'),

  // Key ID from Apple Developer portal (10 characters)
  keyId: 'XXXXXXXXXX',

  // Team ID from Apple Developer portal (10 characters)
  teamId: 'XXXXXXXXXX',

  // Your app's bundle identifier
  bundleId: 'com.aircity.hki',

  // Device token (you'll get this from the app when it registers)
  deviceToken: 'DEVICE_TOKEN_HERE',

  // Environment: 'production' or 'sandbox'
  production: false
};

async function sendPushNotification() {
  // Validate config
  if (!fs.existsSync(config.keyPath)) {
    console.error('❌ .p8 key file not found at:', config.keyPath);
    console.log('📝 Download your .p8 key from Apple Developer portal and update the keyPath');
    return;
  }

  if (config.keyId === 'XXXXXXXXXX' || config.teamId === 'XXXXXXXXXX') {
    console.error('❌ Please update keyId and teamId with your actual values');
    return;
  }

  if (config.deviceToken === 'DEVICE_TOKEN_HERE') {
    console.error('❌ Please update deviceToken with a real device token from your app');
    return;
  }

  // Create APNs provider
  const provider = new apn.Provider({
    token: {
      key: config.keyPath,
      keyId: config.keyId,
      teamId: config.teamId
    },
    production: config.production
  });

  // Create notification
  const notification = new apn.Notification({
    alert: {
      title: 'HKI App',
      body: 'Hello from your HKI app! 🚀'
    },
    topic: config.bundleId,
    payload: {
      route: '/notifications', // Custom data for deep linking
      timestamp: Date.now()
    },
    sound: 'default',
    badge: 1
  });

  try {
    console.log('📤 Sending push notification...');
    const result = await provider.send(notification, config.deviceToken);

    if (result.sent.length > 0) {
      console.log('✅ Push notification sent successfully!');
      console.log('📱 Sent to devices:', result.sent.length);
    }

    if (result.failed.length > 0) {
      console.log('❌ Failed to send to some devices:');
      result.failed.forEach(failure => {
        console.log(`   Device: ${failure.device}`);
        console.log(`   Error: ${failure.error || failure.status}`);
        console.log(`   Response: ${failure.response?.reason || 'No reason provided'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
  } finally {
    provider.shutdown();
  }
}

// CLI usage
if (require.main === module) {
  // Allow overriding config via command line
  const args = process.argv.slice(2);
  if (args.length >= 1) config.deviceToken = args[0];
  if (args.length >= 2) config.keyId = args[1];
  if (args.length >= 3) config.teamId = args[2];
  if (args.includes('--production')) config.production = true;

  sendPushNotification().catch(console.error);
}

module.exports = { sendPushNotification, config };

/*
Usage examples:

1. Basic usage (update config object above):
   node scripts/send-push-notification.js

2. With command line arguments:
   node scripts/send-push-notification.js DEVICE_TOKEN KEY_ID TEAM_ID

3. Production mode:
   node scripts/send-push-notification.js DEVICE_TOKEN KEY_ID TEAM_ID --production

4. Install required dependency:
   npm install node-apn

Setup steps:
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Create a new key with "Apple Push Notifications service (APNs)" enabled
3. Download the .p8 file and note the Key ID
4. Find your Team ID in the top-right corner of the page
5. Update the config object above with your values
6. Get a device token by running your app and checking the console logs
7. Run this script to send a test notification
*/