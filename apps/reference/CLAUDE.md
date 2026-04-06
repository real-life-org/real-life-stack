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

## OTA Updates (Live Update)

Ermöglicht Web-Bundle-Updates ohne neuen App-Store-Release via `@capawesome/capacitor-live-update`.

### Einrichtung Update-Server

Der Server muss zwei statische Dateien bereitstellen:
- `/latest.json` → `{ "bundleId": "1.0.2", "url": "https://…/bundle-1.0.2.zip" }`
- Die Bundle-Zip-Datei unter der angegebenen URL

Funktioniert mit jedem Static-Host: **GitHub Pages**, Cloudflare Pages, S3, Nginx, …

### Bundle erstellen & deployen

```bash
# .env anlegen (einmalig)
echo "VITE_UPDATE_SERVER_URL=https://real-life-org.github.io/real-life-stack" > .env.local

# OTA-Bundle bauen
cd apps/reference
pnpm build:ota 1.0.2              # erstellt ota-bundles/bundle-1.0.2.zip + latest.json

# Dateien in gh-pages Branch deployen
git checkout gh-pages
cp apps/reference/ota-bundles/* .
git add bundle-1.0.2.zip latest.json
git commit -m "chore: OTA bundle 1.0.2"
git push origin gh-pages
git checkout -
```

### Wie es funktioniert

1. App startet → `checkForLiveUpdate()` in `main.tsx` wird aufgerufen
2. Fetch `$VITE_UPDATE_SERVER_URL/api/latest`
3. Wenn `bundleId` neu: Bundle-Zip herunterladen, entpacken, App neu laden
4. Bei Fehler: App läuft normal weiter (kein Crash)
5. Im Browser/Dev: komplett inaktiv (kein nativer Kontext)

### Apple-Richtlinien
OTA-Updates sind erlaubt für reine Web-Bundle-Änderungen (kein `eval`, keine neuen nativen APIs).