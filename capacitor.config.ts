import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.twowheels.motorcycles',
  appName: 'TwoWheelsMotorcycles',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    minWebViewVersion: 60,
  }
};

export default config;
