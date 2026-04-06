import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "org.reallife.reallifestack",
  appName: "Real Life Stack",
  webDir: "dist",
  server: {
    // Enable live-reload during development:
    // url: "http://192.168.x.x:5173",
    // cleartext: true,
  },
  plugins: {
    LiveUpdate: {
      appId: "org.reallife.reallifestack",
    },
  },
}

export default config
