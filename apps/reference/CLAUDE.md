# Reference App

## Mobile Deployment (Capacitor)

### Prerequisites
- Xcode installed with command line tools (`xcode-select -s /Applications/Xcode.app/Contents/Developer`)
- iPhone connected via USB with Developer Mode enabled
- For Android: device connected via USB with USB debugging enabled, `adb` available
- Find your iOS device target ID: `npx cap run ios --list`

### Build & Deploy iOS

```bash
# 1. Build web assets (skip tsc if there are TS errors, vite build alone is fine)
cd apps/reference
npx vite build

# 2. Sync web assets to iOS project
npx cap sync ios

# 3. Deploy to device (replace <target-id> with your device ID from --list)
npx cap run ios --target <target-id>
```

### Build & Deploy Android

```bash
# 1. Build web assets
cd apps/reference
npx vite build

# 2. Sync web assets to Android project
npx cap sync android

# 3. Build APK (needs Gradle 8.14+, JAVA_HOME and ANDROID_HOME)
JAVA_HOME=$(/usr/libexec/java_home) \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
gradle assembleDebug -p android

# 4. Install & launch
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.reallifestack.reference/.MainActivity
```

### Key Notes
- Base path defaults to `/` in `vite.config.ts` — no `VITE_BASE_PATH` env var needed
- `tsc -b` may fail with unused-import errors; `npx vite build` works fine standalone
- iOS signing uses Development Team `R8QCRG95T6` (configured in `project.pbxproj`)
- `viewport-fit=cover` in `index.html` is required for `env()` safe area variables to work
- Android needs Gradle 8.14+ on PATH (no local Gradle wrapper in this project)