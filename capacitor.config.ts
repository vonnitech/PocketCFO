import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.pocketcfo.mobile',
  appName: 'Pocket CFO',
  webDir: 'dist-native',
  backgroundColor: '#101214',
  server: { androidScheme: 'https' },
  // Bundled assets only. Never ship a development server URL in a phone build.
};

export default config;
