import type { CapacitorConfig } from '@capacitor/cli'

function normalizeRemoteUrl(rawValue: string | undefined) {
  const value = rawValue?.trim()
  if (!value) return 'https://kinloop-api-production.up.railway.app'
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const config: CapacitorConfig = {
  appId: 'com.kinloop.app',
  appName: 'Kinloop',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    url: normalizeRemoteUrl(
      process.env.KINLOOP_APP_URL
        ?? process.env.CAPACITOR_SERVER_URL
        ?? process.env.VITE_CAPACITOR_SERVER_URL,
    ),
    androidScheme: 'https',
    cleartext: false,
    errorPath: 'offline.html',
  },
}

export default config
