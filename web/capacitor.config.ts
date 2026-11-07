import type { CapacitorConfig } from '@capacitor/cli';

// Android app shell for WHATSMORE. The app's pages are bundled into the APK (built by
// scripts/build-app-bundle.mjs into .apk-build/out); live features talk to Supabase over the internet.
const config: CapacitorConfig = {
  appId: 'com.whatsmore.app',
  appName: 'WHATSMORE',
  webDir: '.apk-build/out',
  backgroundColor: '#0b3d91',
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Android 15 edge-to-edge (status bar, gesture bar and keyboard) is handled in MainActivity.java
    adjustMarginsForEdgeToEdge: 'disable',
    webContentsDebuggingEnabled: false,
  },
  server: { androidScheme: 'https' },
};

export default config;
