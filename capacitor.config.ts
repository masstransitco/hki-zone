import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aircity.hkizone',
  appName: 'HKI',
  webDir: 'out',
  server: {
    url: 'https://hki.zone',
    cleartext: false,
    allowNavigation: ['hki.zone', '*.hki.zone']
  }
};

export default config;