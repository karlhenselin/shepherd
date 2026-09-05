import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karlhenselin.shepherd',
  appName: 'Shepherd',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // Full-bleed game: hide clock / status and the nav / back strip.
      hidden: true,
      style: 'DARK'
    }
  }
};

export default config;
