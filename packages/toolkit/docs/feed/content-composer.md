# ContentComposer — Anforderungsdokument

## 1. Ueberblick

**ContentComposer** ist ein dynamisches, konfigurierbares Formular zum Erstellen verschiedener Inhaltstypen. Die Kernidee: Ein einziges Widget, das sich je nach Content-Typ (Post, Event, Projekt, Task, Anzeige, ...) unterschiedlich zusammensetzt — aus modularen, ein-/ausblendbaren Eingabe-Widgets.

Die Komponente ist:
- **Reiner Formular-Content** — kein eigenes Modal/Panel, kein Datenzugriff, kein Connector-Wissen. Gibt Daten via `onSubmit`-Callback zurueck. Der Consumer entscheidet, wo und wie der ContentComposer angezeigt wird (AdaptivePanel, eigene Seite, inline).
- **Konfigurierbar** — Content-Typen und deren Default-Widgets werden vom Consumer definiert, nicht hardcoded. Deckt Posts, Events und Tasks gleichermassen ab.
- **Erweiterbar** — Consumer kann eigene Widget-Komponenten registrieren und Slots (z.B. Karte) mit eigenen Implementierungen fuellen.
- **Modusfaehig** — Kann im Multi-Typ-Modus (Typ-Leiste, User waehlt) oder im Einzel-Typ-Modus (fester Typ, keine Auswahl) betrieben werden.
- **Dependency-frei** — Kein Framer Motion, kein react-dnd, kein react-leaflet. Alle Interaktionen mit nativen APIs (CSS Transitions, Pointer Events, File API).

### Darstellung: AdaptivePanel statt eigenes Modal

Im Prototyp bringt das Widget sein eigenes Vollbild-Modal mit (`motion.div` mit Backdrop, eigenem Header und Close-Button). In der sauberen Implementierung wird diese Verantwortung an das **AdaptivePanel** delegiert:

- ContentComposer rendert nur den Formular-Inhalt (Typ-Leiste, Widgets, Footer mit Submit)
- Der Consumer wrapped ihn in ein `<AdaptivePanel>` fuer Modal/Sidebar/Drawer-Darstellung
- Kein eigener Backdrop, kein eigenes Schliessen — das uebernimmt das AdaptivePanel
- Der ContentComposer muss kein Layout-Wissen haben — er fuellt den verfuegbaren Platz

```tsx
<AdaptivePanel open={composerOpen} onClose={() => setComposerOpen(false)}>
  <ContentComposer
    contentTypes={contentTypes}
    onSubmit={(data) => { createItem(data); setComposerOpen(false) }}
    onCancel={() => setComposerOpen(false)}
  />
</AdaptivePanel>
```

### Herkunft

Abgeleitet aus `apps/prototype/src/components/SmartPostWidget.tsx` und den zugehoerigen Widget-Komponenten unter `apps/prototype/src/components/widgets/`. Bekannte Probleme der Vorlage:
- Eigenes Vollbild-Modal mit Framer-Motion-Animationen (gehoert ins AdaptivePanel)
- Framer Motion fuer Widget-Ein-/Ausblenden (Bundle-Size, Mobile-Performance)
- `react-dnd` fuer Media-Sortierung (unnoetige Dependency)
- `react-leaflet` fest eingebunden (Toolkit darf keine Karten-Dependency haben)
- Content-Typen und Widget-Zuordnung hardcoded
- `useComposer`-Hook mit Router-Navigation und localStorage (Business-Logik im Widget)
- Kein TypeScript-Strict-Typing (viele `any`-Casts)

---

## 2. User Stories

### Modi und Content-Typ-Auswahl

- **US-1**: Als Nutzer sehe ich beim Oeffnen des Widgets eine Leiste mit allen verfuegbaren Content-Typen und kann zwischen ihnen wechseln (Multi-Typ-Modus).
- **US-2**: Als Nutzer sehe ich beim Wechsel des Content-Typs, dass sich die sichtbaren Widgets aendern — Widgets, die zum neuen Typ gehoeren, erscheinen; andere verschwinden mit einer sanften Animation.
- **US-3**: Als Nutzer bleiben meine bereits eingegebenen Daten erhalten, wenn ich den Content-Typ wechsle — selbst wenn ein Widget kurzzeitig ausgeblendet wird.
- **US-4**: Als Entwickler kann ich die verfuegbaren Content-Typen, ihre Labels und ihre Default-Widgets konfigurieren — das Widget enthaelt keine festen Typen.
- **US-4a**: Als Entwickler kann ich den ContentComposer im Einzel-Typ-Modus (`mode`) oeffnen — die Typ-Auswahl-Leiste wird dann nicht angezeigt, und der Content-Typ steht fest. Beispiel: Kanban-Board oeffnet den Composer direkt im Task-Modus.
- **US-4b**: Als Entwickler kann ich den Einzel-Typ-Modus nutzen, um Features wie Vorschau, Sichtbarkeit oder Typ-Wechsel gezielt auszublenden — sodass das UI optimal zum Kontext passt (z.B. kompaktes Task-Formular vs. ausfuehrlicher Post-Composer).

### Widget-System

- **US-5**: Als Nutzer sehe ich unterhalb des Text-Widgets eine Toolbar mit Icons fuer alle nicht-aktiven optionalen Widgets und kann sie per Klick hinzufuegen.
- **US-6**: Als Nutzer kann ich optionale Widgets (die nicht zum Default des aktuellen Typs gehoeren) ueber einen X-Button wieder entfernen.
- **US-7**: Als Nutzer werden Widgets in einer festen Reihenfolge angezeigt, unabhaengig davon, in welcher Reihenfolge ich sie hinzufuege.
- **US-8**: Als Nutzer sehe ich eine sanfte Animation, wenn Widgets ein- oder ausgeblendet werden (Slide-Down / Collapse).

### Titel-Widget

- **US-9**: Als Nutzer sehe ich ein einfaches Text-Input mit kontextabhaengigem Placeholder (z.B. "Titel" oder "Name" je nach Content-Typ).
- **US-10**: Als Entwickler kann ich den Placeholder per Content-Typ-Konfiguration ueberschreiben.

### Text-Widget

- **US-11**: Als Nutzer sehe ich einen Textbereich mit einer Formatting-Toolbar (Headings, Bold, Italic, Liste, Zitat).
- **US-11a**: Als Nutzer kann ich Text markieren und ueber die Toolbar formatieren — die Formatierung wird nur auf die Selektion angewendet, nicht auf den gesamten Text.
- **US-12**: Als Nutzer kann ich Markdown-Formatierung direkt im Textfeld verwenden.
- **US-13**: Als Nutzer kann ich mit `@name` Personen erwaehnen — erkannte Mentions werden automatisch zum People-Widget hinzugefuegt (das ggf. eingeblendet wird).
- **US-14**: Als Nutzer kann ich mit `#tag` Tags setzen — erkannte Tags werden automatisch zum Tags-Widget hinzugefuegt (das ggf. eingeblendet wird).

### Datum-Widget

- **US-15**: Als Nutzer kann ich ein Startdatum mit Uhrzeit waehlen.
- **US-16**: Als Nutzer kann ich optional ein Enddatum aktivieren und setzen.
- **US-17**: Als Nutzer kann ich eine Wiederholungsregel waehlen (keine, taeglich, woechentlich, monatlich).
- **US-18**: Als Entwickler kann ich das Widget mit vorausgefuellten Daten initialisieren (z.B. beim Klick auf einen Kalenderslot).

### Ort-Widget (Slot-basiert)

- **US-19**: Als Nutzer kann ich zwischen "Vor Ort" und "Online" umschalten.
- **US-20**: Als Nutzer kann ich bei "Vor Ort" eine Adresse eingeben.
- **US-21**: Als Nutzer kann ich bei "Online" einen Meeting-Link eingeben.
- **US-22**: Als Entwickler kann ich eine eigene Karten-Komponente in den Location-Slot einsetzen (z.B. Leaflet, Mapbox, statische Karte).
- **US-23**: Ohne gesetzte Karten-Komponente zeigt das Ort-Widget nur das Adress-Eingabefeld — kein Fehler, kein Fallback.

### Medien-Widget

- **US-24**: Als Nutzer kann ich Dateien ueber einen File-Picker hochladen.
- **US-25**: Als Nutzer sehe ich eine Vorschau der hochgeladenen Bilder in einem Grid.
- **US-26**: Als Nutzer kann ich hochgeladene Dateien per Klick entfernen.
- **US-27**: Als Nutzer kann ich die Reihenfolge der Medien per Drag-and-Drop aendern (native Pointer Events, kein react-dnd).

### Personen-Widget

- **US-28**: Als Nutzer sehe ich ein Autocomplete-Eingabefeld mit Chip-Anzeige fuer ausgewaehlte Personen.
- **US-29**: Als Nutzer kann ich Personen per Klick auf einen Vorschlag hinzufuegen.
- **US-30**: Als Nutzer kann ich Personen per Klick auf den Chip entfernen.
- **US-31**: Als Entwickler kann ich eine Suggestions-Quelle uebergeben (Callback oder Array).

### Tags-Widget

- **US-32**: Als Nutzer sehe ich ein Eingabefeld mit Autocomplete und Chip-Anzeige fuer gesetzte Tags.
- **US-33**: Als Nutzer kann ich bestehende Tags aus Vorschlaegen waehlen oder freie Tags per Enter erstellen.
- **US-34**: Als Nutzer kann ich Tags per Klick auf den Chip entfernen.
- **US-35**: Als Entwickler kann ich eine Tag-Suggestions-Quelle uebergeben.

### Status-Widget

- **US-43**: Als Nutzer sehe ich eine Auswahl von Status-Optionen als Chips/Buttons (z.B. "To Do", "In Arbeit", "Erledigt").
- **US-44**: Als Nutzer kann ich genau einen Status waehlen — der aktive Status ist visuell hervorgehoben.
- **US-45**: Als Entwickler kann ich die verfuegbaren Status-Optionen (ID, Label, Farbe) konfigurieren.

### Gruppen-Widget

- **US-46**: Als Nutzer sehe ich eine Auswahl von Gruppen, zu der mein Inhalt gehoert.
- **US-47**: Als Nutzer muss ich eine Gruppe waehlen, wenn Gruppen verfuegbar sind — das Formular kann ohne Gruppenzuordnung nicht abgesendet werden.
- **US-48**: Als Entwickler kann ich die verfuegbaren Gruppen uebergeben und eine Default-Gruppe setzen.

### Vorschau

- **US-36**: Als Nutzer kann ich zwischen Bearbeitungs- und Vorschau-Modus wechseln.
- **US-37**: Als Nutzer sehe ich in der Vorschau den Beitrag so, wie er spaeter angezeigt wuerde — mit gerendertem Markdown, Bild-Grid, formatiertem Datum, etc.

### Sichtbarkeit und Absenden

- **US-38**: Als Nutzer kann ich zwischen "Oeffentlich" und "Privat" umschalten.
- **US-39**: Als Nutzer kann ich den Beitrag ueber einen Submit-Button absenden. Der Button-Text passt sich dem Content-Typ an (z.B. "Posten", "Erstellen").
- **US-40**: Als Nutzer kann ich den Vorgang abbrechen.

### Initialisierung und Bearbeitung

- **US-41**: Als Entwickler kann ich das Widget mit einem vorausgewaehlten Content-Typ oeffnen.
- **US-42**: Als Entwickler kann ich das Widget mit vorausgefuellten Daten oeffnen (z.B. Datum aus Kalender-Klick).
- **US-49**: Als Entwickler kann ich den ContentComposer im Edit-Modus oeffnen (`initialData` + `editMode`). Der Submit-Button zeigt dann "Speichern" (bzw. das konfigurierte Label), und optional wird ein Delete-Button angezeigt.
- **US-50**: Als Nutzer sehe ich im Edit-Modus alle Felder vorausgefuellt mit den bestehenden Daten.
- **US-51**: Als Nutzer kann ich im Edit-Modus den Inhalt loeschen, wenn der Consumer einen `onDelete`-Callback uebergeben hat.

---

## 3. Widget-System

### Die 9 Widget-Typen

| ID | Label | Beschreibung | Daten-Typ |
|---|---|---|---|
| `title` | Titel | Einzeiliges Text-Input | `string` |
| `text` | Beschreibung | Mehrzeiliger Markdown-Editor mit Formatting-Toolbar | `string` |
| `media` | Medien | File-Upload mit Bild-Vorschau und Drag-Sortierung | `MediaFile[]` |
| `date` | Datum | Start-/End-Datum mit Uhrzeit und Wiederholungsregel | `DateRange` |
| `location` | Ort | Adresse oder Online-Link, mit optionalem Karten-Slot | `LocationData` |
| `people` | Personen | Autocomplete mit Chip-Anzeige | `string[]` |
| `tags` | Tags | Autocomplete + freie Eingabe mit Chips | `string[]` |
| `status` | Status | Single-Select aus konfigurierbaren Optionen (Chips) | `string` |
| `group` | Gruppe | Single-Select fuer Gruppenzugehoerigkeit | `string` |

### Widget-Rendering-Reihenfolge

Widgets werden immer in dieser Reihenfolge angezeigt, unabhaengig davon, wann sie aktiviert werden:

```
group → title → text → media → date → location → status → people → tags
```

### Widget-Aktivierung

Jeder Content-Typ definiert eine Liste von Default-Widgets. Zusaetzlich kann der Nutzer weitere Widgets manuell hinzufuegen (via Toolbar im Text-Widget) oder entfernen.

**Regeln:**
- Default-Widgets des aktuellen Typs koennen nicht entfernt werden (kein X-Button)
- Manuell hinzugefuegte Widgets zeigen einen X-Button zum Entfernen
- Das Text-Widget zeigt in seiner Footer-Toolbar Icons fuer alle verfuegbaren, noch nicht aktiven Widgets
- `@mention` und `#tag` im Text aktivieren automatisch das People- bzw. Tags-Widget

### Widget-Daten-Persistenz

Wenn der Nutzer den Content-Typ wechselt, bleiben alle bisher eingegebenen Daten erhalten. Nur die Sichtbarkeit der Widgets aendert sich. Wechselt der Nutzer zurueck, sind die Daten noch da.

---

## 4. Content-Typ-Konfiguration

### Prinzip

Der Consumer definiert Content-Typen als Array von Konfigurationsobjekten. Das ContentComposer hat keine eingebauten Typen — ohne Konfiguration zeigt es nur das Text-Widget.

### Konfigurations-Interface

```typescript
interface ContentTypeConfig {
  /** Eindeutige ID des Content-Typs */
  id: string

  /** Anzeige-Label (z.B. "Post", "Task") */
  label: string

  /** Widgets, die standardmaessig aktiv sind */
  defaultWidgets: WidgetType[]

  /** Optionale Label-Overrides fuer Widgets in diesem Typ.
   *  z.B. { title: "Name", people: "Mitglieder einladen" } */
  widgetLabels?: Partial<Record<WidgetType, string>>

  /** Label fuer den Submit-Button im Erstellen-Modus. Default: "Erstellen" */
  submitLabel?: string

  /** Label fuer den Submit-Button im Edit-Modus. Default: "Speichern" */
  editLabel?: string

  /** Icon fuer den Typ-Selektor (Lucide-Icon-Komponente) */
  icon?: React.ComponentType<{ className?: string }>

  /** Status-Optionen (fuer Status-Widget) */
  statusOptions?: StatusOption[]
  defaultStatus?: string

  /** Gruppen-Optionen (fuer Group-Widget) */
  groupOptions?: GroupOption[]
  defaultGroup?: string
  groupRequired?: boolean
}
```

### Beispiel-Konfiguration

```typescript
const contentTypes: ContentTypeConfig[] = [
  {
    id: "post",
    label: "Post",
    defaultWidgets: ["text"],
    submitLabel: "Posten",
  },
  {
    id: "event",
    label: "Veranstaltung",
    defaultWidgets: ["title", "text", "date", "location", "people"],
    widgetLabels: {
      people: "Teilnehmer einladen",
    },
  },
  {
    id: "task",
    label: "Task",
    defaultWidgets: ["group", "title", "text", "status", "people", "tags"],
    widgetLabels: {
      text: "Beschreibung",
      people: "Zugewiesen",
    },
    submitLabel: "Task erstellen",
    statusOptions: [
      { id: "todo", label: "To Do" },
      { id: "doing", label: "In Arbeit", className: "bg-blue-100 text-blue-700" },
      { id: "done", label: "Erledigt", className: "bg-green-100 text-green-700" },
    ],
    defaultStatus: "todo",
    // groupOptions werden zur Laufzeit vom Consumer uebergeben
  },
  {
    id: "project",
    label: "Projekt",
    defaultWidgets: ["title", "text", "people"],
    widgetLabels: {
      title: "Name",
      people: "Mitglieder einladen",
    },
  },
  {
    id: "ad",
    label: "Anzeige",
    defaultWidgets: ["title", "text", "tags"],
  },
]
```

---

## 5. Konfiguration

### Props

Vollstaendiges Props-Interface siehe Abschnitt 7 (API). Hier die konzeptionelle Uebersicht:

| Prop | Zweck |
|---|---|
| `contentTypes` | Content-Typ-Definitionen (ID, Label, Widgets, Status-/Gruppen-Optionen) |
| `initialContentType` | Vorausgewaehlter Typ beim Oeffnen |
| `mode` | Fester Content-Typ — blendet Typ-Auswahl aus |
| `initialData` | Vorausgefuellte Widget-Daten |
| `onSubmit` | Callback mit allen eingegebenen Daten |
| `onCancel` | Callback beim Abbrechen |
| `renderLocationMap` | Slot/Render-Prop fuer die Karten-Komponente |
| `peopleSuggestions` | Vorschlaege fuer das People-Widget |
| `tagSuggestions` | Vorschlaege fuer das Tags-Widget |
| `widgets` | Optionale Custom-Widget-Registrierung |

### Slots

Das ContentComposer nutzt **Render-Props** fuer externe Abhaengigkeiten, die nicht ins Toolkit gehoeren:

**Location-Map-Slot:**

```typescript
renderLocationMap?: (props: {
  position: { lat: number; lng: number } | null
  onPositionChange: (pos: { lat: number; lng: number }) => void
  onConfirm: () => void
}) => React.ReactNode
```

Wenn `renderLocationMap` nicht gesetzt ist, zeigt das Location-Widget nur das Adress-Eingabefeld. Kein Fehler, kein Fallback.

### Custom Widgets

Consumer koennen eigene Widget-Typen registrieren, die neben den eingebauten 7 Widgets verwendet werden koennen:

```typescript
interface CustomWidgetDefinition {
  /** Eindeutige Widget-ID */
  id: string

  /** Anzeige-Label */
  label: string

  /** Icon fuer die Widget-Toolbar */
  icon: React.ComponentType<{ className?: string }>

  /** Die Widget-Komponente */
  component: React.ComponentType<WidgetComponentProps<unknown>>
}
```

Custom Widgets werden in `contentTypes[].defaultWidgets` und in der Widget-Toolbar genauso behandelt wie eingebaute Widgets.

---

## 6. Animations-Konzept

### Grundprinzip: Kein Framer Motion

Wie beim AdaptivePanel wird Framer Motion **nicht** verwendet. Gruende:
- Bundle-Size (~30kB minified)
- Performance-Probleme auf Mobile (JS-getriebene Animationen)
- CSS Transitions reichen fuer die benoetigten Effekte

### Widget Ein-/Ausblenden

```
Einblenden: max-height 0 → auto, opacity 0 → 1 (200ms ease-out)
Ausblenden: max-height auto → 0, opacity 1 → 0 (200ms ease-in)
```

Technisch: CSS `transition` auf einem Wrapper-Div. `max-height` mit einem hinreichend grossen Wert (z.B. 500px) als Proxy fuer `auto`, da CSS `height: auto` nicht animierbar ist. Alternative: `grid-template-rows: 0fr → 1fr` (modernere Technik, breitere Unterstuetzung seit 2023).

### Text-Formatting (Selection-aware)

Die Formatting-Toolbar im Text-Widget arbeitet selection-aware:
- Ist Text markiert: Formatierung wird nur auf die Selektion angewendet (`**markierter Text**`)
- Ist nichts markiert: Formatierung wird an der Cursor-Position eingefuegt (`**|**`, Cursor zwischen den Markern)
- Technisch: `textarea.selectionStart` / `selectionEnd` + `setSelectionRange()` nach dem Einfuegen

### Vorschau-Wechsel

```
Form → Preview: opacity 1 → 0, dann Content-Swap, dann opacity 0 → 1 (150ms)
Preview → Form: gleich
```

### Markdown-Rendering in der Vorschau

Die eingebaute Vorschau nutzt `react-markdown` + `remark-gfm` fuer das Rendering. Beides sind Peer-Dependencies des Toolkit — der Consumer muss sie installieren. Die Vorschau kann alternativ komplett via `renderPreview`-Prop ersetzt werden.

### Typ-Selektor

Der aktive Content-Typ wird mit einem farbigen Hintergrund hervorgehoben. Der Wechsel nutzt eine CSS-Transition auf `background-color` (150ms).

### Media-Drag-Sortierung

Native Pointer Events mit `setPointerCapture()`:

```
pointerdown → Drag-Start (Element klonen als Ghost, Capture setzen)
pointermove → Drag-Move (Ghost-Position via transform aktualisieren, Drop-Target berechnen)
pointerup   → Drag-End (Array umsortieren, Ghost entfernen, Capture freigeben)
```

Kein `react-dnd`. Kein HTML5 Drag-and-Drop API (unzuverlaessig auf Mobile).

---

## 7. API (Props-Interface)

```typescript
// === Daten-Typen ===

type WidgetType = "title" | "text" | "media" | "date" | "location" | "people" | "tags" | "status" | "group"

interface MediaFile {
  /** Eindeutige ID */
  id: string
  /** Dateiname */
  name: string
  /** Object-URL oder Upload-URL */
  url: string
  /** MIME-Type */
  type?: string
}

interface DateRange {
  /** ISO datetime-local String */
  start: string
  /** ISO datetime-local String (optional) */
  end?: string
  /** Enddatum anzeigen? */
  showEnd?: boolean
  /** iCalendar RRULE oder "none" */
  rrule?: string
}

interface LocationData {
  /** Freitext-Adresse */
  address?: string
  /** URL fuer Online-Events */
  link?: string
  /** Vor Ort oder Online */
  isOnline?: boolean
  /** Geo-Position (fuer Karten-Slot) */
  position?: { lat: number; lng: number }
}

/** Alle Widget-Daten als flaches Objekt */
interface WidgetData {
  title?: string
  text?: string
  media?: MediaFile[]
  date?: DateRange
  location?: LocationData
  people?: string[]
  tags?: string[]
  status?: string
  group?: string
  /** Custom-Widget-Daten */
  [key: string]: unknown
}

// === Konfiguration ===

interface StatusOption {
  /** Eindeutige ID (z.B. "todo", "doing", "done") */
  id: string
  /** Anzeige-Label */
  label: string
  /** CSS-Klasse fuer Farbe (optional) */
  className?: string
}

interface GroupOption {
  /** Gruppen-ID */
  id: string
  /** Gruppen-Name */
  name: string
}

interface ContentTypeConfig {
  id: string
  label: string
  defaultWidgets: (WidgetType | string)[]
  widgetLabels?: Partial<Record<WidgetType | string, string>>
  submitLabel?: string
  icon?: React.ComponentType<{ className?: string }>

  /** Status-Optionen fuer das Status-Widget (nur relevant wenn "status" in defaultWidgets) */
  statusOptions?: StatusOption[]
  /** Default-Status beim Erstellen */
  defaultStatus?: string

  /** Gruppen-Optionen fuer das Group-Widget (nur relevant wenn "group" in defaultWidgets) */
  groupOptions?: GroupOption[]
  /** Default-Gruppe beim Erstellen */
  defaultGroup?: string
  /** Gruppe ist Pflichtfeld? Default: true wenn groupOptions gesetzt */
  groupRequired?: boolean
}

// === Widget-Erweiterung ===

interface WidgetComponentProps<T = unknown> {
  /** Aktueller Wert des Widgets */
  value: T
  /** Callback bei Aenderung */
  onChange: (value: T) => void
  /** Anzeige-Label (aus ContentTypeConfig oder Default) */
  label: string
}

interface CustomWidgetDefinition {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<WidgetComponentProps<unknown>>
}

// === Submit-Daten ===

interface ContentComposerSubmitData {
  /** ID des gewaehlten Content-Typs */
  contentType: string
  /** Sichtbarkeit */
  isPublic: boolean
  /** Alle Widget-Daten */
  data: WidgetData
}

// === Props ===

interface ContentComposerProps {
  /** Content-Typ-Definitionen. Mindestens ein Typ erforderlich. */
  contentTypes: ContentTypeConfig[]

  /** Vorausgewaehlter Content-Typ (ID). Default: erster Typ in contentTypes. */
  initialContentType?: string

  /** Fester Content-Typ-Modus. Wenn gesetzt, wird die Typ-Auswahl-Leiste
   *  ausgeblendet und der Composer zeigt nur diesen einen Typ.
   *  Ueberschreibt initialContentType. */
  mode?: string

  /** Vorausgefuellte Widget-Daten (z.B. Datum aus Kalender-Klick). */
  initialData?: Partial<WidgetData>

  /** Callback beim Absenden. Erhaelt alle Formulardaten. */
  onSubmit: (data: ContentComposerSubmitData) => void

  /** Callback beim Abbrechen. */
  onCancel?: () => void

  /** Callback zum Loeschen (nur im Edit-Modus). Wenn gesetzt, wird ein
   *  Delete-Button angezeigt. */
  onDelete?: () => void

  /** Edit-Modus: aendert Submit-Label und zeigt Delete-Button.
   *  Wird automatisch true wenn onDelete gesetzt ist. */
  editMode?: boolean

  /** Render-Prop fuer die Karten-Komponente im Location-Widget.
   *  Wenn nicht gesetzt, zeigt Location nur das Adress-Eingabefeld. */
  renderLocationMap?: (props: {
    position: { lat: number; lng: number } | null
    onPositionChange: (pos: { lat: number; lng: number }) => void
    onConfirm: () => void
  }) => React.ReactNode

  /** Vorschlaege fuer das People-Widget. Array oder async Callback. */
  peopleSuggestions?: string[] | ((query: string) => Promise<string[]>)

  /** Vorschlaege fuer das Tags-Widget. Array oder async Callback. */
  tagSuggestions?: string[] | ((query: string) => Promise<string[]>)

  /** Custom-Widget-Definitionen. Werden neben den 9 eingebauten Widgets registriert. */
  widgets?: CustomWidgetDefinition[]

  /** Sichtbarkeits-Toggle anzeigen (Oeffentlich/Privat). Default: true. */
  showVisibility?: boolean

  /** Default-Sichtbarkeit. Default: true (oeffentlich). */
  defaultPublic?: boolean

  /** Vorschau-Modus anzeigen. Default: true. */
  showPreview?: boolean

  /** Render-Prop fuer die Vorschau. Erhaelt die aktuellen Widget-Daten.
   *  Default: eingebaute Markdown-Vorschau. */
  renderPreview?: (data: WidgetData, contentType: string) => React.ReactNode

  /** Zusaetzliche CSS-Klassen fuer den aeusseren Container. */
  className?: string
}
```

---

## 8. Verwendungsbeispiel

### Minimal (Feed-Post)

```tsx
import { ContentComposer } from "@real-life-stack/toolkit"
import { useCreateItem } from "@real-life-stack/toolkit"

function Feed() {
  const createItem = useCreateItem()

  return (
    <ContentComposer
      contentTypes={[
        { id: "post", label: "Post", defaultWidgets: ["text"] },
      ]}
      onSubmit={async (data) => {
        await createItem({
          type: data.contentType,
          createdBy: "current-user",
          data: data.data,
        })
      }}
    />
  )
}
```

### Einzel-Typ-Modus: Task aus dem Kanban-Board

```tsx
import { ContentComposer } from "@real-life-stack/toolkit"
import { useCreateItem, useGroups, useMembers } from "@real-life-stack/toolkit"

function KanbanCreateTask({ onClose, defaultGroupId }) {
  const createItem = useCreateItem()
  const groups = useGroups()
  const members = useMembers()

  const taskType: ContentTypeConfig = {
    id: "task",
    label: "Task",
    defaultWidgets: ["group", "title", "text", "status", "people", "tags"],
    widgetLabels: { text: "Beschreibung", people: "Zugewiesen" },
    submitLabel: "Task erstellen",
    statusOptions: [
      { id: "todo", label: "To Do" },
      { id: "doing", label: "In Arbeit" },
      { id: "done", label: "Erledigt" },
    ],
    defaultStatus: "todo",
    groupOptions: groups.map(g => ({ id: g.id, name: g.name })),
    defaultGroup: defaultGroupId,
  }

  return (
    <ContentComposer
      contentTypes={[taskType]}
      mode="task"
      initialData={{ group: defaultGroupId }}
      showVisibility={false}
      showPreview={false}
      onSubmit={async (data) => {
        await createItem({
          type: "task",
          createdBy: "current-user",
          data: data.data,
        })
        onClose()
      }}
      onCancel={onClose}
      peopleSuggestions={members.map(m => m.displayName)}
    />
  )
}
```

### Multi-Typ-Modus (mit Karten-Slot)

```tsx
import { ContentComposer } from "@real-life-stack/toolkit"
import { MapPicker } from "./MapPicker" // App-eigene Karten-Komponente

const contentTypes: ContentTypeConfig[] = [
  {
    id: "post",
    label: "Post",
    defaultWidgets: ["text"],
    submitLabel: "Posten",
  },
  {
    id: "event",
    label: "Veranstaltung",
    defaultWidgets: ["title", "text", "date", "location", "people"],
    widgetLabels: { people: "Teilnehmer einladen" },
  },
  {
    id: "task",
    label: "Task",
    defaultWidgets: ["title", "text", "status", "tags"],
    widgetLabels: { text: "Beschreibung" },
    statusOptions: [
      { id: "todo", label: "To Do" },
      { id: "doing", label: "In Arbeit" },
      { id: "done", label: "Erledigt" },
    ],
    defaultStatus: "todo",
  },
]

function CreateContentView({ onClose }) {
  const createItem = useCreateItem()

  return (
    <ContentComposer
      contentTypes={contentTypes}
      initialContentType="event"
      initialData={{ date: { start: "2026-03-15T14:00" } }}
      onSubmit={async (data) => {
        await createItem({
          type: data.contentType,
          createdBy: "current-user",
          data: data.data,
        })
        onClose()
      }}
      onCancel={onClose}
      renderLocationMap={({ position, onPositionChange, onConfirm }) => (
        <MapPicker
          position={position}
          onChange={onPositionChange}
          onConfirm={onConfirm}
        />
      )}
      peopleSuggestions={async (query) => {
        const res = await fetch(`/api/users?q=${query}`)
        return res.json()
      }}
      tagSuggestions={["Wichtig", "Freizeit", "Projekt", "Idee"]}
    />
  )
}
```

---

## 9. Abgrenzung

### ContentComposer vs. SimplePostWidget

| | SimplePostWidget | ContentComposer |
|---|---|---|
| Zweck | Schnelles Posten (Tweet-artig) | Strukturiertes Erstellen verschiedener Inhaltstypen |
| Widget-System | Nein | Ja (9 eingebaute + Custom Widgets) |
| Content-Typen | Nein (immer "Post") | Ja (konfigurierbar, wechselbar oder fest) |
| Eingabefelder | 1 Textarea + File-Upload | Titel, Text, Datum, Ort, Medien, Personen, Tags, Status, Gruppe |
| Markdown | Nein | Ja (Formatting-Toolbar + Vorschau) |
| Konfigurierbarkeit | Minimal (`placeholder`, `onSubmit`) | Umfangreich (Typen, Widgets, Slots, Suggestions) |
| Layout | Eigene Card-Komponente | Kein eigenes Layout — wird in AdaptivePanel oder inline verwendet |
| Einsatz | Feed-Header als Einladung/Teaser, oeffnet ContentComposer bei Klick | In AdaptivePanel (Modal/Sidebar/Drawer) oder als eigene Ansicht |

**Koexistenz und Zusammenspiel:** SimplePostWidget dient im Feed als Dummy/Teaser — es laedt den User ein, einen Beitrag zu erstellen ("Was gibt's Neues?"). Klickt der User darauf, oeffnet sich der ContentComposer in einem AdaptivePanel. SimplePostWidget ist kein eigenstaendiges Eingabeformular, sondern ein **Trigger** fuer den ContentComposer. Dafuer erhaelt es ein `onClick`-Prop (bisher `onSubmit` — wird im Zuge der ContentComposer-Implementierung angepasst).

```tsx
function FeedHeader() {
  const [composerOpen, setComposerOpen] = useState(false)

  return (
    <>
      {/* Teaser-Card im Feed — klick oeffnet den Composer */}
      <SimplePostWidget
        placeholder="Was gibt's Neues?"
        onClick={() => setComposerOpen(true)}
      />

      <AdaptivePanel open={composerOpen} onClose={() => setComposerOpen(false)}>
        <ContentComposer
          contentTypes={contentTypes}
          onSubmit={(data) => { createItem(data); setComposerOpen(false) }}
          onCancel={() => setComposerOpen(false)}
        />
      </AdaptivePanel>
    </>
  )
}
```

### ContentComposer vs. KanbanTaskForm

| | KanbanTaskForm | ContentComposer (mode="task") |
|---|---|---|
| Zweck | Task-Erstellung/-Bearbeitung im Kanban-Kontext | Universelle Inhaltserstellung, auch fuer Tasks |
| Widget-System | Nein (feste Felder) | Ja (modulare Widgets) |
| Felder | Title, Description, Status, Tags, Assignee, Group | Gleiche Felder via Widget-Konfiguration |
| Markdown | Nein | Ja (Formatting-Toolbar) |
| Erweiterbarkeit | Keine (hardcoded Felder) | Custom Widgets moeglich |
| Andere Typen | Nein (nur Tasks) | Ja (Post, Event, Task, ...) |

**Migration:** KanbanTaskForm kann langfristig durch `<ContentComposer mode="task" ... />` ersetzt werden. Das ist aber keine sofortige Anforderung — beide koennen koexistieren. Die Migration ergibt Sinn, wenn:
- Tasks Markdown-Beschreibungen oder Medien-Anhaenge bekommen sollen
- Das gleiche Formular aus verschiedenen Kontexten (Feed, Kanban, Kalender) erreichbar sein soll
- Neue Felder (Datum, Ort) fuer Tasks hinzukommen

Solange Tasks nur die bestehenden Felder brauchen und das KanbanTaskForm gut funktioniert, gibt es keinen Druck zur Migration.

---

## Changelog

| Datum | Aenderung |
|---|---|
| 2026-03-13 | Initiales Anforderungsdokument erstellt |
| 2026-03-13 | Content-Typen konfigurierbar statt hardcoded (Architektur-Entscheidung) |
| 2026-03-13 | Kein Framer Motion, kein react-dnd — native APIs (Architektur-Entscheidung) |
| 2026-03-13 | Karten-Komponente als Render-Prop-Slot (Architektur-Entscheidung) |
| 2026-03-13 | onSubmit-Callback statt Connector-Zugriff (Architektur-Entscheidung) |
| 2026-03-13 | Task-Erstellung integriert: Status-Widget, Group-Widget, Einzel-Typ-Modus (`mode`) |
| 2026-03-13 | Abgrenzung zu KanbanTaskForm dokumentiert |
| 2026-03-13 | PostTypeConfig → ContentTypeConfig, postTypes → contentTypes (Umbenennung) |
| 2026-03-13 | Kein eigenes Modal — Darstellung via AdaptivePanel (Trennung Content vs. Layout) |
| 2026-03-13 | Edit-Modus: `editMode`, `onDelete`, `editLabel` (US-49–US-51) |
| 2026-03-13 | Text-Widget: Selection-aware Formatting statt Ganztext-Formatierung (US-11a) |
| 2026-03-13 | Markdown-Vorschau via `react-markdown` + `remark-gfm` (Peer-Dependencies) |
| 2026-03-13 | SimplePostWidget wird Trigger (`onClick` statt `onSubmit`) |
