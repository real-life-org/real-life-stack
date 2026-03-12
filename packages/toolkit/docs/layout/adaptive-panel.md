# AdaptivePanel — Anforderungsdokument

## 1. Ueberblick

**AdaptivePanel** ist eine universelle, inhaltsagnostische Layout-Komponente fuer das Toolkit. Sie stellt beliebigen Inhalt (`children`) in verschiedenen Layout-Modi dar: **Modal**, **Sidebar** und **Drawer** (Bottom-Sheet).

Die Komponente kuemmert sich ausschliesslich um:
- Positionierung und Layout
- Modus-Auswahl basierend auf Viewport
- Animationen (Oeffnen, Schliessen, Moduswechsel)
- Drag-Gesten im Drawer-Modus
- Sidebar-Resize per Drag-Handle
- Manuellen Moduswechsel zwischen Sidebar/Modal bzw. Drawer/Modal
- Groessen-Wiederherstellung nach Moduswechsel-Roundtrip
- Pinned-Modus: Panel bleibt offen bis zum expliziten Schliessen
- Scroll-Management: Inhalt scrollbar, Reset beim Oeffnen

Sie weiss nichts ueber den dargestellten Inhalt — kein Profil, kein Detail-View, keine Business-Logik.

### Herkunft

Abgeleitet aus `apps/prototype/src/components/profile/ProfileView.tsx`, die drei Modi (overlay, sidebar, draggable) mit Profil-Logik verwoben implementiert. Bekannte Probleme der Vorlage:
- Framer Motion verursacht Performance-Probleme auf Mobile
- `@use-gesture/react` als zusaetzliche Dependency fuer Drag
- Layout-Logik und Inhalt nicht trennbar

---

## 2. User Stories

### Oeffnen und Schliessen

- **US-1**: Als Nutzer kann ich ein Panel oeffnen und es zeigt meinen Inhalt im passenden Modus fuer mein Geraet.
- **US-2**: Als Nutzer kann ich ein Panel ueber einen Close-Button, Backdrop-Klick (Modal) oder Escape-Taste schliessen.
- **US-3**: Als Nutzer sehe ich eine sanfte Animation beim Oeffnen und Schliessen.

### Automatischer Moduswechsel

- **US-4**: Als Nutzer auf einem Smartphone sehe ich das Panel automatisch als Drawer (Bottom-Sheet).
- **US-5**: Als Nutzer auf einem Desktop (>= 1024px) sehe ich das Panel als Sidebar.
- **US-6**: Wenn ich mein Browserfenster verkleinere, wechselt das Panel automatisch von Sidebar zu Drawer — mein Inhalt bleibt erhalten.
- **US-7**: Als Entwickler kann ich einschraenken, welche Modi erlaubt sind (z.B. nur `["modal", "drawer"]`).

### Manueller Moduswechsel

- **US-8**: Als Nutzer sehe ich in der Sidebar einen Button (neben dem X-Button), mit dem ich in den Modal-Modus wechseln kann.
- **US-9**: Als Nutzer sehe ich im Modal einen Button, mit dem ich zurueck in den Sidebar-Modus wechseln kann (nur auf Desktop, wenn `sidebar` in `allowedModes`).
- **US-10**: Als Nutzer auf Mobile sehe ich im Drawer einen Button, mit dem ich in den Modal-Modus wechseln kann und umgekehrt (sofern beide in `allowedModes`).
- **US-11**: Der manuelle Moduswechsel ist nur moeglich, wenn der Zielmodus in `allowedModes` enthalten ist. Ist nur ein Modus erlaubt, wird kein Wechsel-Button angezeigt.
- **US-28**: Wenn ich von Sidebar/Drawer zu Modal und zurueck wechsle, wird die vorherige Groesse (Sidebar-Breite bzw. Drawer-Hoehe) wiederhergestellt.

### Drawer-Interaktion

- **US-12**: Als Nutzer kann ich den Drawer per Drag nach oben ziehen, um ihn zu vergroessern — bis ganz nach oben (100% Viewport).
- **US-13**: Als Nutzer kann ich den Drawer per Drag nach unten ziehen, um ihn zu verkleinern oder zu schliessen.
- **US-14**: Der Drawer hat zwei Snap-Zonen: eine untere (default 20%) und eine obere (default 80%). Dazwischen ist freies Ziehen moeglich.
- **US-15**: Bei schnellem Wischen in der Naehe einer Snap-Zone springt der Drawer zum naechsten Snap-Punkt (Velocity-Snapping).
- **US-16**: Wenn ich ueber den oberen Rand (100%) hinaus ziehe, spuere ich einen elastischen Widerstand (Rubber-Band-Effekt).
- **US-17**: Wenn ich den Drawer unter die untere Snap-Zone ziehe, schliesst er sich.
- **US-18**: Der Drawer liegt visuell UEBER der BottomNav und der Navbar — bei maximaler Hoehe ueberdeckt er den gesamten Viewport.
- **US-27**: Wenn ich den Drawer in den Schliess-Bereich ziehe (unterhalb der unteren Snap-Zone), wird das Panel transparent — als visuelles Feedback, dass es sich gleich schliesst.

### Sidebar-Interaktion

- **US-19**: Als Nutzer sehe ich die Sidebar von rechts hereingleiten.
- **US-20**: Die Sidebar hat eine konfigurierbare Anfangsbreite.
- **US-21**: Die Sidebar verdraengt den Hauptinhalt — der Seiteninhalt wird schmaler, nicht ueberlagert. Die Zentrierung des Contents bleibt erhalten.
- **US-22**: Am linken Rand der Sidebar (bei `side="right"`) befindet sich ein vertikaler Resize-Handle. Durch Ziehen kann ich die Sidebar-Breite stufenlos aendern.
- **US-23**: Die Sidebar-Breite hat ein Minimum (z.B. 280px) und ein Maximum (z.B. 60% des Viewports).
- **US-24**: Ein Doppelklick auf den Resize-Handle setzt die Sidebar auf die Default-Breite zurueck.
- **US-29**: Die Sidebar dockt unterhalb der Navbar an (`top-14`). Die Navbar bleibt immer sichtbar ueber der Sidebar.

### Modal-Interaktion

- **US-25**: Als Nutzer sehe ich ein zentriertes Overlay mit abgedunkeltem Hintergrund.
- **US-26**: Ein Klick auf den Backdrop schliesst das Modal.
- **US-30**: Die Modal-Groesse ist konfigurierbar via `modalClassName` (z.B. `"max-w-2xl max-h-[80vh]"`).

### Pinned-Modus

- **US-31**: Als Nutzer sehe ich ein Pin-Icon in der Sidebar und im Drawer (neben dem Mode-Switch-Button), mit dem ich das Panel anheften kann.
- **US-32**: Wenn das Panel angeheftet ist, bleibt es offen — automatisches Schliessen (z.B. nach Speichern/Abbrechen im Consumer) wird unterdrueckt. Nur explizites Schliessen (X-Button, Drawer-Herunterziehen) schliesst das Panel.
- **US-33**: Im angehefteten Drawer-Modus wird der Backdrop entfernt und die Seite bleibt interaktiv.
- **US-34**: Im angehefteten Modus wird Escape nicht zum Schliessen verwendet.
- **US-35**: Das Pin-Icon wird nur angezeigt, wenn `onPinnedChange` uebergeben wird.
- **US-36**: Im Modal-Modus wird kein Pin-Icon angezeigt (Modals sind immer blockierend).

### Scroll-Verhalten

- **US-37**: Als Nutzer kann ich den Panelinhalt in allen drei Modi vertikal scrollen, wenn er die verfuegbare Hoehe ueberschreitet.
- **US-38**: Wenn ich ein Panel oeffne (frischer Open, nicht Moduswechsel), wird die Scrollposition auf den Anfang zurueckgesetzt.

### Velocity-Snapping (Drawer)

- **US-39**: Schnelles Wischen nach unten schliesst den Drawer nur, wenn er sich in der unteren Haelfte befindet — versehentliches Schliessen aus der oberen Haelfte wird verhindert.
- **US-40**: Schnelles Wischen nach oben maximiert den Drawer nur, wenn er sich in der oberen Haelfte befindet.

---

## 3. Modi-Definition

### `modal`

Zentriertes Overlay mit Backdrop.

| Eigenschaft | Wert |
|---|---|
| Position | Zentriert (horizontal + vertikal) |
| Z-Index | `z-[60]` — ueber Navbar und Sidebar |
| Backdrop | `bg-black/50`, klickbar zum Schliessen |
| Groesse | Konfigurierbar via `modalClassName`, Default: `max-w-lg max-h-[90vh]` |
| Escape | Schliesst das Panel |
| Animation | Fade-in + Scale (200ms) |
| Header-Buttons | X (Schliessen) + Sidebar-Icon (wechselt zu Sidebar, nur Desktop + wenn erlaubt) |

### `sidebar`

Seitliches Panel, das den Hauptinhalt verdraengt (kein Overlay). Der Content-Bereich wird schmaler, die Sidebar nimmt den freigewordenen Platz ein.

| Eigenschaft | Wert |
|---|---|
| Position | Seitlich fixed, Default: rechts, unterhalb der Navbar (`top-14`) |
| Z-Index | `z-40` — unter der Navbar (`z-50`) |
| Seite | Konfigurierbar: `"left"` oder `"right"` |
| Breite | Konfigurierbar, Default: `400px`, stufenlos resize-bar |
| Min-Breite | `280px` |
| Max-Breite | `60vw` |
| Hoehe | Volle verfuegbare Hoehe unterhalb der Navbar |
| Backdrop | Keiner — Sidebar verdraengt den Content |
| Content-Verdraengung | Via CSS-Variablen (`--adaptive-panel-margin-right/left`) als `paddingRight/Left` auf `AppShellMain` |
| Resize-Handle | Vertikaler Griff am inneren Rand (links bei `side="right"`) |
| Animation | Width-Transition (300ms ease-out), Content-Padding animiert synchron |
| Header-Buttons | Pin-Icon (wenn `onPinnedChange`) + Expand-Icon (wechselt zu Modal, wenn erlaubt) + X (Schliessen) |

### `drawer`

Bottom-Sheet mit Drag-Gesten und Snap-Zonen. Kein externer Gesture-Handler — reine Pointer Events. Liegt ueber allem inkl. Navbar und BottomNav.

| Eigenschaft | Wert |
|---|---|
| Position | Unten, volle Breite, volle Viewport-Hoehe bei Maximierung |
| Z-Index | `z-[60]` — ueber Navbar (`z-50`) und BottomNav (`z-50`) |
| Snap-Zonen | 2 Zonen: untere (default 0.2) und obere (default 0.8) mit konfigurierbarer Zone-Breite (default 0.05) |
| Initiale Hoehe | Konfigurierbar via `drawerInitialHeight`, Default: `0.55` (55% Viewport) |
| Freies Ziehen | Zwischen den Snap-Zonen frei positionierbar |
| Maximierung | Ab oberer Snap-Zone → Snap auf 100% (voller Viewport, ueberdeckt Navbar) |
| Schliessen | Unterhalb der unteren Snap-Zone → Panel schliesst |
| Fade-Out | Panel wird transparent wenn unter die untere Snap-Zone gezogen |
| Drag-Handle | Visueller Griff oben, Touch-Area mindestens 44px |
| Rubber-Band | Elastischer Widerstand ueber 100% (oberhalb des Viewports) |
| Animation | `height` + `opacity` (300ms, spring-like cubic-bezier) |
| Backdrop | Nur wenn nicht pinned — wird entfernt wenn Panel angeheftet ist |
| Header-Buttons | Pin-Icon (wenn `onPinnedChange`) + Expand-Icon (wechselt zu Modal, wenn erlaubt) — kein X noetig, Drag-Dismiss genuegt |

---

## 4. Konfiguration

### `allowedModes`

Array der erlaubten Modi. Die Komponente waehlt automatisch den besten Modus basierend auf Viewport-Groesse.

```typescript
allowedModes?: Array<"modal" | "sidebar" | "drawer">
// Default: ["modal", "sidebar", "drawer"]
```

Beispiele:
- `["modal", "drawer"]` — Kein Sidebar-Modus (z.B. fuer einfache Dialoge)
- `["sidebar", "drawer"]` — Kein Modal (z.B. fuer Detail-Panels)
- `["drawer"]` — Immer Drawer (z.B. fuer Map-Overlays)

### Responsive Regeln (Default-Mapping)

| Viewport | Bevorzugter Modus | Fallback |
|---|---|---|
| `< 1024px` | `drawer` | `modal` |
| `>= 1024px` | `sidebar` | `modal` |

Die Komponente waehlt den bevorzugten Modus, falls er in `allowedModes` enthalten ist. Sonst den Fallback. Falls auch der Fallback nicht erlaubt ist, wird der erste erlaubte Modus verwendet.

### Drawer Snap-Konfiguration

```typescript
interface DrawerSnapConfig {
  /** Unterer Snap-Point (Anteil Viewport-Hoehe). Default: 0.2
   *  Unterhalb dieses Punkts minus Zone → Panel schliesst */
  lower?: number

  /** Oberer Snap-Point (Anteil Viewport-Hoehe). Default: 0.8
   *  Oberhalb dieses Punkts → Panel maximiert auf 100% */
  upper?: number

  /** Breite der Snap-Zone. Default: 0.05
   *  Innerhalb der Zone wird zum Snap-Point eingerastet */
  zone?: number
}

drawerSnap?: DrawerSnapConfig
```

**Verhalten der Snap-Zonen:**

```
100% ─────── Maximiert (voller Viewport)
            ↑ Snap nach oben
 80% ─────── Obere Snap-Zone (upper ± zone)
            │ Freies Ziehen
 20% ─────── Untere Snap-Zone (lower ± zone)
            ↓ Fade-Out + Schliessen
  0% ─────── Geschlossen
```

- **Unterhalb lower - zone**: Panel schliesst
- **In unterer Snap-Zone (lower ± zone)**: Einrasten auf lower
- **Zwischen den Zonen**: Freies Positionieren, Panel bleibt wo es losgelassen wird
- **Ab upper**: Snap auf 100% (voller Viewport)
- **Fade-Out**: Unterhalb der unteren Snap-Zone (lower - zone) wird das Panel transparent

### Initiale Drawer-Hoehe

```typescript
drawerInitialHeight?: number
// Default: 0.55 (55% Viewport)
// Unabhaengig von den Snap-Points — bestimmt die Hoehe beim ersten Oeffnen
```

### Sidebar-Breite

```typescript
sidebarWidth?: string
// Default: "400px"
// Akzeptiert CSS-Werte: "400px", "30vw", "25rem"
// Kann vom Nutzer stufenlos per Resize-Handle geaendert werden

sidebarMinWidth?: string
// Default: "280px"

sidebarMaxWidth?: string
// Default: "60vw"
```

### Modal-Groesse

```typescript
modalClassName?: string
// Tailwind-Klassen fuer die Modal-Groesse
// Ueberschreibt die Defaults (max-w-lg max-h-[90vh])
// Beispiel: "max-w-2xl max-h-[80vh]"
```

---

## 5. Automatischer und manueller Moduswechsel

### Automatischer Moduswechsel (Viewport)

Die Komponente ueberwacht Viewport-Aenderungen via `matchMedia` und wechselt den Modus automatisch:

1. Breakpoint: **1024px** — unter 1024px wird Drawer bevorzugt, darueber Sidebar
2. Falls der bevorzugte Modus nicht in `allowedModes` ist, wird der Fallback (modal) gewaehlt
3. Der Wechsel geschieht mit Animation — kein harter Schnitt
4. Der Inhalt (`children`) bleibt vollstaendig erhalten, kein Re-Mount

### Manueller Moduswechsel (Button)

Jeder Modus hat einen Wechsel-Button im Header (neben dem X-Button):

| Aktueller Modus | Viewport | Ziel-Modus | Button-Icon | Bedingung |
|---|---|---|---|---|
| `sidebar` | Desktop | `modal` | `Maximize2` / Expand | `modal` in `allowedModes` |
| `modal` | Desktop | `sidebar` | `PanelRight` / Sidebar | `sidebar` in `allowedModes` |
| `drawer` | Mobile | `modal` | `Maximize2` / Expand | `modal` in `allowedModes` |
| `modal` | Mobile | `drawer` | `GripHorizontal` / Drawer | `drawer` in `allowedModes` |

### Groessen-Wiederherstellung

Beim Moduswechsel werden die aktuellen Groessen gespeichert und beim Zurueckwechseln wiederhergestellt:

- **Drawer → Modal → Drawer**: Die letzte Drawer-Hoehe wird wiederhergestellt
- **Sidebar → Modal → Sidebar**: Die letzte Sidebar-Breite wird wiederhergestellt
- Beim erstmaligen Oeffnen wird `drawerInitialHeight` bzw. `sidebarWidth` verwendet

Technisch: `lastDrawerYRef` und `lastSidebarWidthRef` speichern die Werte. Ein `prevOpenRef` unterscheidet zwischen frischem Oeffnen und Moduswechsel bei offenem Panel.

### Callback

```typescript
onModeChange?: (mode: "modal" | "sidebar" | "drawer") => void
```

Wird bei jedem Moduswechsel aufgerufen — egal ob automatisch oder manuell.

---

## 6. Sidebar-Layout: Content-Verdraengung

### Grundprinzip

Die Sidebar ueberlagert den Content NICHT. Stattdessen wird der Content-Bereich schmaler — die Sidebar und der Content teilen sich den verfuegbaren Platz. Die Zentrierung des Contents (z.B. `container mx-auto`) bleibt erhalten.

### Technische Umsetzung

Das Panel setzt CSS-Variablen auf `document.documentElement`, die `AppShellMain` als Padding ausliest:

```css
/* Vom AdaptivePanel gesetzt */
:root {
  --adaptive-panel-margin-right: 0px;   /* fuer side="right" */
  --adaptive-panel-margin-left: 0px;    /* fuer side="left" */
}
```

```tsx
/* In AppShellMain */
<main style={{
  paddingRight: "var(--adaptive-panel-margin-right, 0px)",
  paddingLeft: "var(--adaptive-panel-margin-left, 0px)",
}}>
```

**Warum Padding statt Margin:** In einer `flex-col`-AppShell reduziert `margin` nicht die Content-Breite eines gestretchten Flex-Items. `padding` hingegen reduziert den verfuegbaren Innenraum, sodass `container mx-auto` korrekt zentriert.

### Transition-Steuerung

- Content-Padding animiert mit `transition-[padding] duration-300 ease-out`
- Waehrend Sidebar-Resize wird die Transition deaktiviert via CSS-Klasse `adaptive-panel-resizing` auf `<html>`: `[.adaptive-panel-resizing_&]:transition-none`

### Resize-Handle

Am inneren Rand der Sidebar befindet sich ein vertikaler Resize-Handle:

- **Visuelles Erscheinungsbild**: Schmale vertikale Linie (2px), wird bei Hover breiter/farbig
- **Hit-Area**: 12px breit fuer einfaches Greifen
- **Cursor**: `col-resize`
- **Drag**: Native Pointer Events mit `setPointerCapture()`, CSS-Variable wird direkt im rAF aktualisiert
- **Doppelklick**: Reset auf `sidebarWidth` (Default-Breite)

```typescript
onSidebarResize?: (width: number) => void
```

---

## 7. Animations-Konzept

### Grundprinzip: Kein Framer Motion

Framer Motion wird **nicht** verwendet. Gruende:
- Bundle-Size (~30kB minified)
- Performance-Probleme auf Mobile (JS-getriebene Animationen)
- Nicht noetig fuer die benoetigten Uebergaenge

### Technologie-Stack

| Technik | Einsatz |
|---|---|
| CSS `transition` + `transform` | Alle Slide/Fade-Uebergaenge (GPU-beschleunigt) |
| Native Pointer Events | Drag-Erkennung im Drawer + Sidebar-Resize |
| `requestAnimationFrame` | Smooth Drag-Tracking |
| CSS `height` | Drawer-Position (`height: (100-Y)vh`, Bottom-Anchored fuer korrektes Scrolling) |
| CSS `opacity` | Drawer Fade-Out in der Schliess-Zone |
| CSS `padding` Transition | Content-Verdraengung durch Sidebar (300ms) |

### Animationen pro Modus

**Modal:**
```
Oeffnen: opacity 0→1 + scale 0.95→1.0 (200ms, ease-out)
Schliessen: opacity 1→0 + scale 1.0→0.95 (200ms, ease-in)
Backdrop: opacity 0→1 / 1→0 (200ms)
```

**Sidebar:**
```
Oeffnen: width 0→target (300ms, ease-out), Content-Padding animiert synchron
Schliessen: width target→0 (300ms, ease-out)
Resize: Keine Transition waehrend Drag (instant via rAF)
Inner Content: minWidth auf aktuelle Breite, overflow-hidden auf Container — verhindert Text-Reflow
```

**Drawer:**
```
Oeffnen: height 0vh → height (target)vh (300ms, spring-like cubic-bezier)
Schliessen: height (current)vh → height 0vh + opacity 1→0 (300ms)
Snap: height (current)vh → height (target)vh (300ms, spring-like cubic-bezier)
Fade-Out: opacity berechnet aus Position relativ zur unteren Snap-Zone
Scroll-Reset: Beim frischen Oeffnen wird scrollTop auf 0 gesetzt
```

**Hinweis zum Drawer-Sizing:** Der Drawer nutzt `height: (100-Y)vh` statt `translateY(Y%)`. Der Grund: bei `translateY` mit `height: 100vh` denkt der Browser, der Container habe die volle Hoehe. Das verhindert korrektes internes Scrolling. Mit dynamischer Hoehe und `bottom: 0` (via `inset-x-0 bottom-0`) waechst der Drawer von unten und der Inhalt scrollt korrekt.

### Spring-Easing via CSS

```css
cubic-bezier(0.32, 0.72, 0, 1)
```

---

## 8. Drag-Verhalten (Drawer-Modus)

### Z-Index-Hierarchie

| Element | Z-Index |
|---|---|
| Sidebar | `z-40` |
| Navbar | `z-50` |
| BottomNav | `z-50` |
| Modal | `z-[60]` |
| Drawer | `z-[60]` |

Der Drawer ueberdeckt bei maximaler Hoehe den gesamten Viewport inkl. Navbar.

### Pointer-Event-Handling

Kein `@use-gesture/react` — native Pointer Events:

```
pointerdown → Drag-Start (Position merken, setPointerCapture)
pointermove → Drag-Move (translateY aktualisieren via rAF)
pointerup   → Drag-End (Snap/Close berechnen, releasePointerCapture)
```

- `touch-action: none` auf dem Drag-Handle
- Nur Y-Achse tracken

### Snap-Logik

Bei Drag-End wird basierend auf Position und Velocity entschieden:

| Bedingung | Aktion |
|---|---|
| Schneller Swipe nach unten + Panel in unterer Haelfte (< 50%) | Schliessen |
| Schneller Swipe nach oben + Panel in oberer Haelfte (> 50%) | Maximieren (100%) |
| Position < lower - zone | Schliessen |
| Position in unterer Snap-Zone (lower ± zone) | Einrasten auf lower |
| Position > upper | Maximieren (100%) |
| Position zwischen den Zonen | Bleiben wo losgelassen |

**Velocity-Guards:** Schnelles Wischen loest nur aus, wenn die aktuelle Position zur Richtung passt. Ein Swipe nach unten aus der oberen Haelfte schliesst den Drawer nicht — er muesste erst in die untere Haelfte gezogen werden. Das verhindert versehentliches Schliessen bei schnellen Korrekturbewegungen.

### Rubber-Band-Effekt

Ueber den oberen Rand (0% = voller Viewport) hinaus:

```
effectiveOffset = overflow * 0.3
```

### Fade-Out-Effekt

Unterhalb der unteren Snap-Zone (`snapLower - snapZone`) nimmt die Opacity linear ab:

```typescript
const fadeStart = snapLower - snapZone  // z.B. 0.15
const drawerOpacity = visibleFraction < fadeStart
  ? Math.max(0, visibleFraction / fadeStart)
  : 1
```

---

## 9. API (Props-Interface)

```typescript
type PanelMode = "modal" | "sidebar" | "drawer"

interface DrawerSnapConfig {
  lower?: number   // Default: 0.2
  upper?: number   // Default: 0.8
  zone?: number    // Default: 0.05
}

interface AdaptivePanelProps {
  /** Panel-Inhalt */
  children: React.ReactNode

  /** Steuerung: Panel geoeffnet? */
  open: boolean

  /** Callback beim Schliessen */
  onClose: () => void

  /** Erlaubte Modi. Default: ["modal", "sidebar", "drawer"] */
  allowedModes?: PanelMode[]

  /** Seite fuer Sidebar-Modus. Default: "right" */
  side?: "left" | "right"

  /** Anfangsbreite des Sidebar-Modus. Default: "400px" */
  sidebarWidth?: string

  /** Minimale Sidebar-Breite. Default: "280px" */
  sidebarMinWidth?: string

  /** Maximale Sidebar-Breite. Default: "60vw" */
  sidebarMaxWidth?: string

  /** Tailwind-Klassen fuer Modal-Groesse. Default: "max-w-lg max-h-[90vh]" */
  modalClassName?: string

  /** Initiale Drawer-Hoehe (Anteil Viewport). Default: 0.55 */
  drawerInitialHeight?: number

  /** Snap-Konfiguration fuer den Drawer */
  drawerSnap?: DrawerSnapConfig

  /** Wenn true, bleibt das Panel offen — nur explizites Schliessen
   *  (X-Button, Drawer-Dismiss) schliesst es. Default: false */
  pinned?: boolean

  /** Callback bei Aenderung des Pinned-Zustands.
   *  Wenn nicht gesetzt, wird das Pin-Icon nicht angezeigt. */
  onPinnedChange?: (pinned: boolean) => void

  /** Callback bei Moduswechsel */
  onModeChange?: (mode: PanelMode) => void

  /** Callback bei Sidebar-Resize */
  onSidebarResize?: (width: number) => void

  /** Zusaetzliche CSS-Klassen */
  className?: string
}
```

### Verwendungsbeispiel

```tsx
import { useState } from "react"
import { AdaptivePanel } from "@real-life-stack/toolkit"

function DetailView({ item, onClose }) {
  const [pinned, setPinned] = useState(false)

  // Respektiert Pinned-Status: schliesst nur wenn nicht angeheftet
  const handleClosePanel = () => {
    if (!pinned) onClose()
  }

  // Explizites Schliessen: ignoriert Pinned-Status (fuer X-Button / Drawer-Dismiss)
  const handleForceClose = () => {
    onClose()
  }

  return (
    <AdaptivePanel
      open={!!item}
      onClose={handleForceClose}
      allowedModes={["modal", "sidebar", "drawer"]}
      sidebarWidth="420px"
      sidebarMinWidth="300px"
      modalClassName="max-w-2xl"
      drawerInitialHeight={0.55}
      drawerSnap={{ lower: 0.25, upper: 0.8, zone: 0.05 }}
      pinned={pinned}
      onPinnedChange={setPinned}
      onModeChange={(mode) => console.log("Mode:", mode)}
      onSidebarResize={(width) => console.log("Resized:", width)}
    >
      <DetailContent
        item={item}
        onSave={() => handleClosePanel()}  // Schliesst nur wenn nicht pinned
        onCancel={() => handleClosePanel()}
      />
    </AdaptivePanel>
  )
}
```

**Pinned-Modus — Zusammenspiel mit dem Consumer:**

Das AdaptivePanel selbst kennt keine Business-Logik. Der `pinned`-Zustand beeinflusst:
- **Drawer**: Kein Backdrop, kein Body-Scroll-Lock, Escape schliesst nicht
- **Sidebar**: Kein Backdrop (hat ohnehin keinen), Escape schliesst nicht
- **Modal**: Kein Pin-Icon (Modals sind immer blockierend)

Der Consumer entscheidet, ob er bei Speichern/Abbrechen das Panel schliesst oder offen laesst:
```tsx
const handleSave = () => {
  saveData()
  if (!panelPinned) closePanel()  // Nur schliessen wenn nicht pinned
}
```

---

## 10. Abgrenzung

### AdaptivePanel vs. Sheet (bestehend)

| | Sheet | AdaptivePanel |
|---|---|---|
| Modi | 1 (Slide-in von einer Seite) | 3 (Modal, Sidebar, Drawer) |
| Content-Verdraengung | Nein (Overlay) | Ja (Sidebar verdraengt Content) |
| Resize | Nein | Ja (Sidebar-Breite per Drag) |
| Drag | Nein | Ja (Drawer-Modus) |
| Snap-Zonen | Nein | Ja (2 Zonen + freies Ziehen) |
| Manueller Moduswechsel | Nein | Ja (Button im Header) |
| Responsiver Moduswechsel | Nein | Ja (automatisch bei 1024px) |
| Einsatz | Einfache Seitenleisten, Menues | Komplexe Detail-Views, Profil-Panels |

### AdaptivePanel vs. Dialog (bestehend)

| | Dialog | AdaptivePanel |
|---|---|---|
| Modi | 1 (Zentriertes Modal) | 3 (Modal, Sidebar, Drawer) |
| Content-Verdraengung | Nein (Overlay) | Ja (Sidebar) |
| Drag | Nein | Ja (Drawer-Modus) |
| Responsiv | Nein (immer Modal) | Ja (Modus passt sich an) |
| Einsatz | Bestaetigungen, Formulare | Inhalts-Panels mit variabler Groesse |

### Koexistenz

Sheet und Dialog bleiben bestehen — sie sind einfacher und fuer ihre jeweiligen Einsatzbereiche ideal. AdaptivePanel ist fuer Faelle gedacht, in denen ein Panel auf verschiedenen Geraeten unterschiedlich dargestellt werden muss.

---

## Changelog

| Datum | Aenderung |
|---|---|
| 2026-03-11 | Initiales Anforderungsdokument erstellt |
| 2026-03-11 | Sidebar verdraengt Content via CSS-Variablen + Padding (US-21) |
| 2026-03-11 | Sidebar-Resize per Drag-Handle (US-22–24) |
| 2026-03-11 | Manueller Moduswechsel per Button (US-8–11) |
| 2026-03-11 | Drawer z-[60] ueber Navbar + BottomNav (US-18) |
| 2026-03-11 | Breakpoint von 768px auf 1024px angehoben |
| 2026-03-11 | Sidebar unterhalb Navbar (`top-14`), Navbar z-50 (US-29) |
| 2026-03-11 | Snap-System: 2 Zonen statt N Snap-Points, freies Ziehen dazwischen (US-14) |
| 2026-03-11 | Drawer maximierbar bis 100% Viewport (US-12, US-18) |
| 2026-03-11 | Fade-Out unter unterer Snap-Zone (US-27) |
| 2026-03-11 | Groessen-Wiederherstellung nach Modal-Roundtrip (US-28) |
| 2026-03-11 | `modalClassName` fuer konfigurierbare Modal-Groesse (US-30) |
| 2026-03-11 | `drawerInitialHeight` und `DrawerSnapConfig` statt `snapPoints[]` |
| 2026-03-12 | Drawer-Velocity-Close nur aus unterer Haelfte zulassen (US-39, US-40) |
| 2026-03-12 | Drawer-Scrolling: height-basiertes Sizing statt translateY fuer korrekte Scrollbarkeit |
| 2026-03-12 | Scroll-Reset beim Oeffnen (US-38) |
| 2026-03-12 | Pinned-Modus: `pinned` + `onPinnedChange` Props (US-31–US-36) |
| 2026-03-12 | Pinned Drawer: Kein Backdrop, kein Body-Scroll-Lock, kein Escape-Close |
| 2026-03-12 | Storybook-Dokumentation hinzugefuegt |
