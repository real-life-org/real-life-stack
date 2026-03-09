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
}

export default config
