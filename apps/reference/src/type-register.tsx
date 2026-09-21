// App layer of the type register (spec 06).
//
// Seit 21.09.2026 leer: Das Toolkit liefert alle acht Typen samt Darstellung
// (`statement` eingeschlossen — die Resonanz kommt vollständig aus dem
// Toolkit). Eine App, die eigene Typen führt, komponiert hier ihr Manifest
// und bindet es über `setTypeManifest`, bevor sie Darstellung registriert.
//
// Import this module once, before first render (main.tsx).

import { composeTypeManifest, TOOLKIT_TYPE_LAYER } from "@real-life-stack/data-interface"
import { setTypeManifest } from "@real-life-stack/toolkit"

/** The app's composed manifest — today the toolkit's, unchanged. */
export const TYPE_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER])

setTypeManifest(TYPE_MANIFEST)
