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

### Channels (3 Targets)

| Channel | Target |
|---|---|
| `ios` | Apple App Store |
| `android` | Google Play Store |
| `android-foss` | F-Droid / ohne Google Services |

Jeder Channel hat eine eigene `latest.json`, wird aber mit demselben Web-Bundle gebaut (sofern keine FOSS-spezifischen Env-Vars nötig sind).

### Einrichtung Update-Server

Statische Dateien auf GitHub Pages (`real-life-stack.de`), Zips in GitHub Releases:
- `real-life-stack.de/updates/ios/latest.json`
- `real-life-stack.de/updates/android/latest.json`
- `real-life-stack.de/updates/android-foss/latest.json`

### Bundle erstellen & deployen

```bash
cd apps/reference

# 1. Web-Bundle für den jeweiligen Channel bauen
VITE_UPDATE_CHANNEL=ios pnpm build

# 2. OTA-Bundle + latest.json erstellen
./scripts/bundle-ota.sh 1.0.2 ios
# → ota-bundles/ios/bundle-ios-1.0.2.zip
# → ota-bundles/ios/latest.json

# 3. Zip als GitHub Release hochladen
gh release create ota-1.0.2 ota-bundles/ios/bundle-ios-1.0.2.zip --title "OTA 1.0.2"
# Weitere Channels anhängen:
gh release upload ota-1.0.2 ota-bundles/android/bundle-android-1.0.2.zip

# 4. latest.json in gh-pages Branch committen (Pfad: updates/<channel>/latest.json)
```

### Wie es funktioniert

1. App startet → `checkForLiveUpdate()` in `main.tsx` wird aufgerufen
2. Fetch `https://real-life-stack.de/updates/<channel>/latest.json`
3. Wenn `bundleId` neu: Bundle-Zip herunterladen, entpacken, App neu laden
4. Bei Fehler: App läuft normal weiter (kein Crash)
5. Im Browser/Dev: komplett inaktiv (kein nativer Kontext)

Der `VITE_UPDATE_CHANNEL` wird beim nativen App-Build gesetzt (lokal / Xcode / Android Studio).
Im CI-Workflow spielt er keine Rolle — dort läuft die OTA-Logik nie (kein nativer Kontext).

### Apple-Richtlinien
OTA-Updates sind erlaubt für reine Web-Bundle-Änderungen (kein `eval`, keine neuen nativen APIs).