# Service-Architektur

> Wie Services (Notifications, GeoCoding, CalDAV, ...) in die Connector-Architektur passen

---

## Problem

Die RLS-Architektur definiert zwei Schichten: **Connectoren** (Datenquellen) und **UI-Module** (Darstellung). Aber viele Features passen in keine von beiden:

- Ein Notification Service **reagiert** auf Datenänderungen und hat **Seiteneffekte** (Telegram, Email)
- Ein GeoCoder **transformiert** Daten (Adresse → Koordinaten), ist aber keine Datenquelle
- CalDAV-Sync **liefert** Daten von extern, verhält sich wie eine zweite Datenquelle
- Map Tiles sind **Assets**, die nur ein einzelnes Modul betrifft

Diese Features brauchen einen definierten Platz in der Architektur.

---

## Drei Service-Muster

### Muster 1: Seiteneffekt-Services

**Reagieren auf Datenänderungen, lösen externe Aktionen aus.**

| Service | Beobachtet | Ausgabe |
|---------|-----------|---------|
| Notifications (In-App) | `observe()` → Änderungserkennung | Toast, Badge, Browser Push API |
| Reminder (zeitgesteuert) | Client registriert Timer | Server feuert Telegram / Email / Push |

Merkmale:
- Konsumieren den Connector (read-only)
- Haben Seiteneffekte nach außen
- Brauchen User-Konfiguration (welche Events, welche Kanäle)
- Können einen Server-Teil haben (für Timer/Erinnerungen)

#### Notification Service im Detail

Der Notification Service reagiert auf **jede relevante Zustandsänderung**, nicht nur auf spezielle Events wie Deadlines:

- Task wird einem User zugewiesen
- Neuer Post in einer Gruppe
- Event wurde verschoben
- Mitglied eingeladen/entfernt
- Task wechselt Status
- Deadline nähert sich (Timer)

**Hybrid-Architektur für Local-First (E2EE):**

```
┌──────────────────────────┐
│   NotificationService    │  (läuft im Client)
│                          │
│   observe() ─────────────┤──► Änderungserkennung
│                          │    "Task X wurde dir zugewiesen"
│   Ausgabe-Kanäle:        │    "Neuer Post in Gruppe Y"
│   ├─ In-App Toast        │    "Event Z wurde verschoben"
│   ├─ Browser Push API    │
│   └─ scheduleReminder()──┤──► Server-Dienst (dummer Timer)
│                          │    └─ Telegram / Email / Push
└──────────────────────────┘
```

Der Server-Teil ist bewusst "dumm": Er bekommt `{text, recipient, time, channel}` — sieht keine Item-Daten, kennt keine Inhalte. Der Client baut den Notification-Text selbst zusammen, bevor er ihn an den Timer schickt. Die E2EE-Grenze wird nicht durchbrochen.

### Muster 2: Datenquellen-Services

**Liefern oder transformieren Daten — verhalten sich wie eine zusätzliche Datenquelle.**

| Service | Rolle | Integration |
|---------|-------|-------------|
| CalDAV Sync | Externe Kalender-Events als Items | Source im Connector |
| Interop (RSS, ActivityPub) | Externe Inhalte als Items | Source im Connector |

Merkmale:
- Holen Daten von extern
- Transformieren sie zu Items
- Sind eigentlich ein **zweiter Connector** oder eine **Source** im Multi-Source-Modell
- `DataInterface.getSources()` / `setActiveSource()` existiert bereits dafür

### Muster 3: Infrastruktur-Services

**Betreffen Identität, Sicherheit, Betrieb — orthogonal zum Item-Datenfluss.**

| Service | Ebene | Integration |
|---------|-------|-------------|
| ID-Backup / Social Recovery | Identität | Im Connector (WoT) oder wot-core |
| Map Tiles | UI-Assets | Modul-Konfiguration (Props) |
| Geo Coder | Utility | Stateless Request-Response |
| Clustering | UI-Logik | Im Karten-Modul |

Merkmale:
- Kein Bezug zum Observable/Item-Datenfluss
- Entweder im Connector eingebaut (Identität) oder reine Modul-Konfiguration (Tiles)

---

## Architektur-Einordnung

```
┌──────────────────────────────────────────────────────────────────┐
│                          UI-Module                                │
│      (Kanban, Kalender, Karte, Feed)                              │
│                                                                   │
│      Modul-spezifische Config:                                    │
│      ├─ Map Tiles (Provider-URL)                                  │
│      └─ Clustering (UI-Logik, z.B. Leaflet MarkerCluster)        │
├──────────────────────────────────────────────────────────────────┤
│                       React Hooks                                 │
├─────────────────────────┬────────────────────────────────────────┤
│                         │                                        │
│   DataInterface         │   App Services                         │
│   (Connector)           │   (konsumieren DataInterface)          │
│                         │                                        │
│   ┌───────────────┐     │   ┌─ NotificationService               │
│   │ WoT / REST /  │◄────┤   │  → observe() → Änderungserkennung │
│   │ Mock           │     │   │  → In-App / Browser Push          │
│   │               │     │   │  → scheduleReminder() → Server    │
│   │ Sources:      │     │   │                                    │
│   │ ├─ Lokal      │     │   ├─ GeoCoderService                  │
│   │ ├─ CalDAV     │     │   │  → geocode(addr) → {lat,lng}      │
│   │ └─ RSS/AP     │     │   │                                    │
│   └───────┬───────┘     │   └─ SearchService (Volltext)          │
│           │             │                                        │
├───────────┴─────────────┴────────────────────────────────────────┤
│                    Infrastruktur                                  │
│   ├─ Identity (DID, Keys, WotIdentity)                           │
│   ├─ ID-Backup / Social Recovery                                 │
│   └─ Relay / Messaging                                           │
└──────────────────────────────────────────────────────────────────┘

Server-Dienste (dumm, kein Item-Wissen):
  ├─ Reminder-Timer  →  Telegram / Email / Push
  ├─ Geo Coder API   →  Nominatim / eigener
  └─ Tile Server     →  optional, meist OSM
```

---

## AppService Interface

Services werden parallel zum Connector in die App injiziert. Sie bekommen den Connector und können ihn beobachten:

```typescript
interface AppService {
  readonly name: string
  init(connector: DataInterface): Promise<void>
  dispose(): Promise<void>
}
```

### Beispiel: NotificationService

```typescript
class NotificationService implements AppService {
  readonly name = "notifications"
  private unsub?: () => void

  async init(connector: DataInterface) {
    // Alle Items beobachten, auf Änderungen reagieren
    const observable = connector.observe({})
    let previous = observable.current

    this.unsub = observable.subscribe((items) => {
      const changes = this.diff(previous, items)
      previous = items

      for (const change of changes) {
        this.handleChange(change)
      }
    })
  }

  async dispose() {
    this.unsub?.()
  }

  // User-Konfiguration: welche Änderungen, welche Kanäle
  setPreferences(prefs: NotificationPreferences): void { ... }

  // Erinnerungen: Client schickt an Server-Timer
  scheduleReminder(reminder: Reminder): Promise<void> { ... }

  private handleChange(change: ItemChange) {
    // "Task X wurde dir zugewiesen" → Toast
    // "Event Y in 1h" → scheduleReminder()
    // "Neuer Post in Gruppe Z" → Badge
  }

  private diff(prev: Item[], next: Item[]): ItemChange[] { ... }
}
```

### Beispiel: GeoCoderService

```typescript
class GeoCoderService implements AppService {
  readonly name = "geocoder"
  private baseUrl: string

  constructor(baseUrl = "https://nominatim.openstreetmap.org") {
    this.baseUrl = baseUrl
  }

  async init(_connector: DataInterface) {
    // Stateless — nichts zu initialisieren
  }

  async dispose() {}

  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const res = await fetch(
      `${this.baseUrl}/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    )
    const data = await res.json()
    if (data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const res = await fetch(
      `${this.baseUrl}/reverse?lat=${lat}&lon=${lng}&format=json`
    )
    const data = await res.json()
    return data.display_name ?? null
  }
}
```

---

## React-Integration

```typescript
// ServiceProvider — analog zum ConnectorProvider
const ServiceContext = createContext<Map<string, AppService>>(new Map())

function ServiceProvider({
  services,
  children,
}: {
  services: AppService[]
  children: React.ReactNode
}) {
  const connector = useConnector()
  const [ready, setReady] = useState(false)
  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.name, s])),
    [services]
  )

  useEffect(() => {
    Promise.all(services.map((s) => s.init(connector))).then(() =>
      setReady(true)
    )
    return () => {
      services.forEach((s) => s.dispose())
    }
  }, [connector, services])

  if (!ready) return null
  return (
    <ServiceContext.Provider value={serviceMap}>
      {children}
    </ServiceContext.Provider>
  )
}

// Hook: Service nach Name holen
function useService<T extends AppService>(name: string): T {
  const services = useContext(ServiceContext)
  const service = services.get(name)
  if (!service) throw new Error(`Service "${name}" not found`)
  return service as T
}
```

### App-Bootstrap

```tsx
const connector = new WotConnector()
const notifications = new NotificationService()
const geocoder = new GeoCoderService()

export default function App() {
  return (
    <ConnectorProvider connector={connector}>
      <ServiceProvider services={[notifications, geocoder]}>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </ServiceProvider>
    </ConnectorProvider>
  )
}
```

### Nutzung in Komponenten

```tsx
function CreatePlaceForm() {
  const geocoder = useService<GeoCoderService>("geocoder")
  const { mutate: createItem } = useCreateItem()

  const handleSubmit = async (address: string, title: string) => {
    const location = await geocoder.geocode(address)
    if (!location) return alert("Adresse nicht gefunden")

    await createItem({
      type: "place",
      createdBy: userId,
      data: { title, address, location },
    })
  }
}
```

---

## Zuordnung aller Services

| Service | Muster | Lebt wo | Braucht DataInterface? |
|---------|--------|---------|----------------------|
| Notifications (In-App) | Seiteneffekt | AppService (Client) | Ja — `observe()` |
| Reminder (Telegram/Email) | Seiteneffekt | AppService → Server-Timer | Nur Client-Teil |
| CalDAV Sync | Datenquelle | Source im Connector | Ist Teil davon |
| Interop (RSS, AP) | Datenquelle | Source im Connector | Ist Teil davon |
| Map Tiles | Infrastruktur | Modul-Props | Nein |
| Geo Coder | Infrastruktur | AppService (stateless) | Nein |
| Clustering | Infrastruktur | Karten-Modul (UI-Logik) | Indirekt |
| ID-Backup / Reset | Infrastruktur | Connector / wot-core | Nein — Identitäts-Ebene |
| E-Mail-Versand | Seiteneffekt | Server-Dienst | Nein — bekommt fertigen Text |

---

## Designprinzipien

1. **Services sind optional.** Die App funktioniert ohne jeden Service — sie erweitern, aber sie sind keine Voraussetzung.

2. **Services sind nicht-invasiv.** Sie ändern das DataInterface nicht. Sie konsumieren es nur.

3. **Server-Dienste sind dumm.** Sie sehen keine Item-Daten, kennen keine Geschäftslogik. Der Client bereitet alles vor (E2EE-kompatibel).

4. **Datenquellen sind Sources, nicht Services.** CalDAV, RSS, ActivityPub — alles was Items liefert, gehört in den Connector als Source, nicht als AppService.

5. **Modul-spezifisches gehört ins Modul.** Map Tiles, Clustering, Chart-Libraries — das sind Modul-Konfigurationen, keine globalen Services.
