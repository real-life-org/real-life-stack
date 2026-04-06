import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "org.reallifestack.reference",
  appName: "Real Life Stack",
  webDir: "dist",
  server: {
    // Enable live-reload during development:
    // url: "http://192.168.x.x:5173",
    // cleartext: true,
  },
  plugins: {
    LiveUpdate: {
      // URL to your update server — replace with actual deployment URL
      // The server must expose: GET /api/latest → { "bundleId": "1.0.1", "url": "https://.../bundle-1.0.1.zip" }
      appId: "org.reallifestack.reference",
      publicKey: undefined, // optional: RSA public key for bundle signature verification
    },
  },
}

export default config
