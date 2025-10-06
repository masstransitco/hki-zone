import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aircity.hkizone',
  appName: 'HKI',
  webDir: 'public',
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile'
  }
};

export default config;