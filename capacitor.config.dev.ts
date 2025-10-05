import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aircity.hki',
  appName: 'HKI',
  webDir: 'out',
  server: {
    url: 'http://192.168.0.116:3000',
    cleartext: true
  }
};

export default config;