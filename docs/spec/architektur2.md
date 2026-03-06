# Real Life Stack – Architektur-Spezifikation

> Modularer Frontend-Baukasten mit backend-agnostischer Connector-Architektur

---

## Übersicht

Real Life Stack ist ein modularer UI-Baukasten für lokale Vernetzung. Die Architektur trennt UI-Module strikt von der Datenquelle durch eine einheitliche Schnittstelle und austauschbare Connectoren.

```
┌─────────────────────────────────────────────────────────────┐
│                       UI-Module                             │
│           (Kanban, Kalender, Karte, Feed, ...)              │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
│  Query State, Mutations, Pagination, Subscriptions          │
│  (React Hooks: useQuery, useMutation, useSubscription)      │
├─────────────────────────────────────────────────────────────┤
│                    Daten-Schnittstelle                      │
│  DataInterface: getItems(), createItem(), getUser(), ...    │
│  FeatureInterface: getDocument(), getCollection(), ...      │
├─────────────────────────────────────────────────────────────┤
│                      Connector(s)                           │
│               (implementiert die Schnittstelle)             │
├────────────────┬────────────────┬───────────────────────────┤
│ REST-Connector │ WoT-Connector  │   Weitere Connectoren     │
│                │                │                           │
│ - Server-Login │ - wot-core    │   - GraphQL               │
│ - REST API     │ - DID-basiert  │   - Local-only            │
│ - Sessions     │ - Local-first  │   - ActivityPub           │
└────────────────┴────────────────┴───────────────────────────┘
```

### Kernprinzipien

1. **Module sind pure UI** – Sie wissen nicht, woher die Daten kommen
2. **Generische Items** – Ein Item kann in mehreren Modulen erscheinen
3. **Connector-Pattern** – Jeder Connector implementiert die komplette Schnittstelle
4. **Daten-Mixing** – Daten aus verschiedenen Quellen können kombiniert werden
5. **Data Layer** – Zwischen UI und Schnittstelle liegt eine reaktive Datenschicht, die Ladezustände, Caching, Mutations und Subscriptions verwaltet

---

## Schichten im Detail

### 1. UI-Module

Module sind reine Darstellungskomponenten. Sie:
- Rufen Daten über die Schnittstelle ab
- Rendern Items basierend auf deren Attributen
- Senden Änderungen zurück über die Schnittstelle
- Kennen weder Backend noch Authentifizierung

**Verfügbare Module:**

| Modul | Zeigt Items mit | Beschreibung |
|-------|-----------------|--------------|
| Kanban | `status` | Aufgaben in Spalten organisieren |
| Kalender | `start`, `end` | Termine zeitlich darstellen |
| Karte | `location` | Orte geografisch visualisieren |
| Feed | `createdAt` | Chronologischer Aktivitäts-Stream |
| Profil | `type: "profile"` | Nutzerprofile anzeigen |

### 2. Daten-Schnittstelle

Die zentrale API, die alle Module nutzen. Sie abstrahiert:
- **Daten** – Items, Profile, Gruppen
- **Identität** – Aktueller Nutzer, Authentifizierung
- **Quellen** – Woher Daten kommen (für Anzeige)

```typescript
interface DataInterface {
  // Gruppen
  getGroups(): Promise<Group[]>
  getCurrentGroup(): Group | null
  setCurrentGroup(id: string): void

  // Items (immer im Kontext der aktuellen Gruppe)
  getItems(filter?: ItemFilter): Promise<Item[]>
  getItem(id: string): Promise<Item | null>
  createItem(item: Omit<Item, 'id' | 'createdAt'>): Promise<Item>  // Connector vergibt id + createdAt
  updateItem(id: string, updates: { title?: string; data?: object }): Promise<Item>
  deleteItem(id: string): Promise<void>

  // Nutzer
  getCurrentUser(): Promise<User | null>
  getUser(id: string): Promise<User | null>

  // Subscriptions (optional — nicht jeder Connector unterstützt dies)
  subscribeItems?(filter: ItemFilter, callback: (items: Item[]) => void): Unsubscribe
  subscribeItem?(id: string, callback: (item: Item | null) => void): Unsubscribe

  // Quellen (für Multi-Source)
  getSources(): Source[]
  getActiveSource(): Source
  setActiveSource(sourceId: string): void
}

type Unsubscribe = () => void

interface Group {
  id: string
  name: string
  // Weitere Felder Connector-spezifisch (z.B. members, admins bei WoT)
}

interface ItemFilter {
  type?: string
  hasAttribute?: string[]
  createdBy?: string
  source?: string
}
```

### 3. Data Layer

Zwischen UI-Modulen und der Daten-Schnittstelle liegt die **Data Layer**. Sie ist dafür verantwortlich, den Zustand der Daten gegenüber der UI zu verwalten: Ladezustände, Caching, Pagination und reaktive Updates. UI-Module arbeiten ausschließlich mit der Data Layer — nie direkt mit der Connector-Schicht.

```
┌─────────────┐       ┌─────────────────────┐       ┌──────────────┐
│  UI-Modul   │──────►│     Data Layer      │──────►│  Connector   │
│             │◄──────│                     │◄──────│              │
│ useQuery()  │       │ Query State         │       │ getItems()   │
│ useMutation │       │ Mutation Pipeline   │       │ createItem() │
│             │       │ Subscriptions       │       │ subscribe()  │
└─────────────┘       └─────────────────────┘       └──────────────┘
```

#### Query State

Jede Datenanfrage wird in der Data Layer als **Query** mit explizitem Ladezustand verwaltet. Die UI muss jederzeit wissen, in welchem Zustand sich eine Abfrage befindet.

```typescript
interface QueryState<T> {
  data: T | undefined          // Die geladenen Daten
  status: 'idle' | 'loading' | 'success' | 'error'
  error: Error | undefined
  isLoading: boolean
  isFetching: boolean          // true bei Hintergrund-Aktualisierung
}
```

Für **Collections** (Listen) erweitert die Data Layer den Zustand um Pagination-Informationen:

```typescript
interface CollectionQueryState<T> extends QueryState<T[]> {
  loadedCount: number          // Anzahl aktuell geladener Elemente
  totalCount?: number          // Gesamtanzahl — kann undefined sein,
                               // wenn der Connector dies nicht effizient
                               // ermitteln kann
  hasMore: boolean             // Gibt es weitere Elemente zum Nachladen?
  loadMore(): void             // Nächste Seite laden
  refresh(): void              // Collection komplett neu laden
}
```

**Wichtig:** `totalCount` ist optional. Es liegt in der Verantwortung des jeweiligen Connectors, ob und wie er die Gesamtanzahl liefert. Manche Backends können dies nicht effizient berechnen — die UI muss damit umgehen können (z.B. "Weitere laden" statt "12 von 48").

#### Mutations

Schreiboperationen (Erstellen, Ändern, Löschen) laufen als **Mutations** durch die Data Layer. Eine Mutation ist unabhängig von Queries — es muss keine Liste geladen sein, um ein neues Item zu erstellen.

```typescript
// Item erstellen — direkt über die Data Layer, ohne vorheriges Laden
const { mutate: createItem } = useMutation({
  mutationFn: (newItem: Omit<Item, 'id' | 'createdAt'>) =>
    connector.createItem(newItem)
})

createItem({ title: "Neuer Eintrag", ... })
```

**ID-Vergabe durch den Connector:** Beim Erstellen eines neuen Items kennt die UI die ID noch nicht — diese wird vom Connector vergeben. Die Data Layer handhabt diesen Übergang:

1. Die UI übergibt das Item ohne `id` und `createdAt` an die Data Layer
2. Die Data Layer leitet es an den Connector weiter
3. Der Connector vergibt die ID und gibt das vollständige Item zurück
4. Die Data Layer aktualisiert den Cache und benachrichtigt betroffene Queries

Optional kann die Data Layer ein **Optimistic Update** durchführen: Das Item wird sofort in der UI angezeigt (mit temporärem Zustand), noch bevor der Connector geantwortet hat. Nach der Antwort wird es durch das echte Item ersetzt.

```typescript
const { mutate: createItem } = useMutation({
  mutationFn: (newItem) => connector.createItem(newItem),
  // Optimistic: Item sofort in der Liste anzeigen
  onMutate: (newItem) => {
    cache.addOptimistic('items', { ...newItem, _pending: true })
  },
  // Nach Erfolg: Cache mit echtem Item (inkl. ID) aktualisieren
  onSuccess: (createdItem) => {
    cache.replaceOptimistic('items', createdItem)
  },
  // Bei Fehler: Optimistic Update zurückrollen
  onError: () => {
    cache.rollbackOptimistic('items')
  }
})
```

#### Snapshot vs. Subscription (Daten-Liefermodus)

Connectoren können Daten auf zwei Arten liefern. Welchen Modus ein Connector unterstützt, liegt in seiner Verantwortung — die Schnittstelle definiert beide Möglichkeiten:

| Modus | Beschreibung | Verhalten in der UI |
|---|---|---|
| **Snapshot** | Einmaliger Abruf. Die Daten sind eine Momentaufnahme und werden nicht automatisch aktualisiert. | Die UI zeigt die Daten an. Aktualisierung nur durch explizites Neuladen (Pull-to-Refresh, Timer, Benutzeraktion). |
| **Subscription** | Reaktiver Datenstrom. Der Connector liefert Updates, sobald sich die Daten ändern. | Die UI aktualisiert sich automatisch. React re-rendert bei jeder Änderung. |

Die Daten-Schnittstelle unterstützt beide Modi:

```typescript
interface DataInterface {
  // Snapshot: Einmaliger Abruf
  getItems(filter?: ItemFilter): Promise<Item[]>

  // Subscription: Reaktiver Datenstrom (optional)
  subscribeItems?(filter: ItemFilter, callback: (items: Item[]) => void): Unsubscribe
}

type Unsubscribe = () => void
```

**Ob ein Connector Subscriptions unterstützt, ist Sache des Connectors.** Die `subscribe*`-Methoden sind optional. Die Data Layer prüft, ob der Connector Subscriptions anbietet, und fällt andernfalls auf Snapshots mit optionalem Polling zurück.

```typescript
// Die Data Layer entscheidet automatisch:
// - Connector mit Subscription → Live-Updates
// - Connector ohne Subscription → Snapshot + optionales Polling
function useItems(filter?: ItemFilter) {
  const connector = useConnector()

  if (connector.subscribeItems) {
    return useSubscription(filter, connector.subscribeItems)
  }
  return useQuery(['items', filter], () => connector.getItems(filter))
}
```

Beispiele:

| Connector | Snapshot | Subscription | Bemerkung |
|---|---|---|---|
| REST | Ja | Optional (via WebSocket) | Abhängig vom Server |
| WoT (Evolu) | Ja | Ja (Live Queries) | Evolu liefert reaktive Daten |
| Google Calendar | Ja | Nein | Nur Polling möglich |

### 4. Connector

Ein Connector implementiert die Daten-Schnittstelle für ein spezifisches Backend. Es ist die Verantwortung des Connectors, die Schnittstelle korrekt zu bedienen — einschließlich ID-Vergabe, Pagination, und der Entscheidung, ob Subscriptions unterstützt werden. Jeder Connector ist eigenständig und bringt alles mit:

- Authentifizierung / Identität
- Datenspeicherung
- Synchronisation
- Verschlüsselung (falls nötig)

**Wichtig:** Connectoren sind nicht komponierbar. Man wählt einen Connector oder kombiniert mehrere auf Daten-Ebene (Multi-Source).

---

## Das generische Item

Items sind die universelle Datenstruktur. Module interpretieren sie basierend auf Attributen.

```typescript
interface Item {
  // Pflichtfelder
  id: string
  title: string
  createdAt: Date
  createdBy: string      // User-ID (DID oder Server-ID)

  data: object // plain object oder ReactiveObject

  // Metadaten (nur lesen)
  _source?: string       // Woher kommt das Item?
}
```

### Das `data`-Feld

Das `data`-Feld enthält die fachlichen Daten des Items als offenes Objekt. Die Schnittstelle erzwingt keine Struktur — es liegt in der Verantwortung des jeweiligen Connectors, welche Felder ein Item enthält, und in der Verantwortung der UI-Module, die für sie relevanten Felder zu interpretieren.

```typescript
// Dieses Item erscheint in Kanban UND Kalender
const item: Item = {
  id: "abc123",
  title: "Team-Meeting vorbereiten",
  createdAt: new Date(),
  createdBy: "did:key:z6Mk...",
  data: {
    status: "doing",           // → Kanban zeigt es
    start: "2024-01-15T10:00", // → Kalender zeigt es
    end: "2024-01-15T11:00",
    tags: ["arbeit", "wichtig"]
  }
}
```

### Datenfeld-basierte Modul-Zuordnung

Ein Item erscheint in Modulen basierend auf den Feldern in `data`. Module prüfen, ob die für sie relevanten Felder vorhanden sind:

| Feld | Typ | Genutzt von |
|------|-----|-------------|
| `status` | string | Kanban |
| `start` | ISO DateTime | Kalender |
| `end` | ISO DateTime | Kalender |
| `location` | GeoJSON | Karte |
| `address` | string | Karte |
| `tags` | string[] | Alle (Filter) |
| `type` | string | Routing/Filter |
| `visibility` | string | Berechtigungen |

**Validierung:** Module sind verantwortlich für die Validierung der Felder, die sie aus `data` lesen. Die Schnittstelle erzwingt keine Struktur — das ist bewusst so, damit verschiedene Connectoren unterschiedliche Datenmodelle bedienen können.

---

## Connectoren

Jeder Connector implementiert das `DataInterface` und ist verantwortlich für:
- **ID-Vergabe** bei `createItem()` — die ID wird vom Connector erzeugt und im zurückgegebenen Item mitgeliefert
- **Pagination** — der Connector entscheidet, ob `totalCount` in Collections geliefert wird
- **Snapshot vs. Subscription** — der Connector entscheidet, ob er `subscribe*`-Methoden implementiert
- **Datenstruktur** — der Connector bestimmt, welche Felder in `item.data` enthalten sind

### REST-Connector

Klassische Server-Anbindung mit Session-basierter Authentifizierung.

```typescript
class RestConnector implements DataInterface {
  constructor(config: {
    baseUrl: string
  })

  // Login/Logout
  login(credentials: { email: string; password: string }): Promise<User>
  logout(): Promise<void>

  // Implementiert DataInterface...
  // subscribe*-Methoden optional (nur wenn Server WebSockets bietet)
}
```

**Eigenschaften:**
- Server speichert Daten und vergibt IDs
- Session-basierte Auth (JWT, Cookies)
- Liefert Snapshots; Subscriptions optional via WebSockets
- `totalCount` in Collections typischerweise verfügbar (SQL COUNT)
- Klassisches Rechte-Management

### WoT-Connector

Dezentrale Anbindung via [Web of Trust](https://github.com/IT4Change/web-of-trust).

```typescript
class WotConnector implements DataInterface {
  constructor(config: {
    storage: WotStorage  // z.B. Evolu, LocalStorage
  })

  // Keine separates Login — DID ist die Identität
  // Identity wird beim ersten Start generiert oder wiederhergestellt

  // Implementiert DataInterface inkl. subscribe*-Methoden
}
```

**Eigenschaften:**
- Nutzt `wot-core` für DID, Kryptografie, Signaturen
- Local-first: ID-Vergabe lokal (z.B. UUID), Sync im Hintergrund
- Liefert Subscriptions (Live Queries über die Storage-Schicht)
- `totalCount` ggf. nicht effizient ermittelbar (dezentrale Daten)
- E2E-verschlüsselt
- Vertrauen durch persönliche Verifizierung

**Integration:**

```
┌─────────────────────────────────────────┐
│            WoT-Connector                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌────────────────┐  │
│  │  wot-core   │    │  WotStorage    │  │
│  │             │    │                │  │
│  │ - Identity  │    │ - Evolu        │  │
│  │ - Crypto    │    │ - LocalStorage │  │
│  │ - Signing   │    │ - IndexedDB    │  │
│  │ - Verify    │    │                │  │
│  └─────────────┘    └────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

`wot-core` ist ein separates npm-Paket aus dem Web-of-Trust-Repository, das die kryptografischen Grundlagen bereitstellt.

---

## Generisches Feature-Interface

Das `DataInterface` (Abschnitt 2) deckt die Kern-Entitäten Items, Gruppen und Nutzer ab. Darüber hinaus gibt es Features, die nicht in dieses Schema passen – z.B. ein personalisierter Feed, Freundschaftsvorschläge oder Statistiken. Gleichzeitig muss nicht jedes Backend den vollen Funktionsumfang unterstützen.

Das generische Feature-Interface löst beide Probleme: Es bietet eine einheitliche Schnittstelle für beliebige Features und ermöglicht es der UI, sich dynamisch an den Funktionsumfang des verbundenen Backends anzupassen.

### Schnittstelle

```typescript
interface FeatureInterface {
  // Lesen
  getDocument(featureKey: string, request?: object): Promise<Document>
  getCollection(featureKey: string, request?: object, options?: CollectionOptions): Promise<Collection>

  // Schreiben
  setDocument(featureKey: string, request: object): Promise<Document>
  addDocument(featureKey: string, request: object): Promise<Document>
  removeDocument(featureKey: string, request: object): Promise<void>

  // Feature-Erkennung
  isSupported(...featureKeys: string[]): Record<string, boolean>
}

interface CollectionOptions {
  pagination?: {
    cursor?: string
    limit?: number
  }
  resolve?: {
    relations?: boolean
    depth?: number          // Wie tief Relationen aufgelöst werden
  }
}

interface Collection {
  items: Document[]
  nextCursor?: string       // Für Pagination
  total?: number            // Falls vom Backend bekannt
}

type Document = Record<string, unknown>
```

### Feature-Keys

Feature-Keys sind hierarchisch durch Punkte gegliedert. Sie benennen das Feature, nicht die Datenstruktur.

```
user.feed                    // Persönlicher Feed
user.friends                 // Freundesliste
user.friends.suggestions     // Freundschaftsvorschläge
group.stats                  // Gruppenstatistiken
group.activity               // Aktivitäts-Log einer Gruppe
moderation.reports           // Gemeldete Inhalte
```

Die Punkt-Hierarchie dient der Namensorganisation – übergeordnete Keys implizieren **nicht** automatisch die Unterstützung untergeordneter Keys. `isSupported("user.friends")` kann `true` sein, während `isSupported("user.friends.suggestions")` `false` ist.

### Lese-Operationen

**`getDocument`** gibt ein einzelnes Objekt zurück (Snapshot). Das `request`-Objekt enthält feature-spezifische Parameter. Die Data Layer wickelt den Query State ab:

```typescript
// Schnittstellen-Ebene (Connector implementiert dies)
getDocument(featureKey: string, request?: object): Promise<Document>

// Data Layer (UI nutzt dies)
function UserProfile({ userId }: { userId: string }) {
  const { data: profile, isLoading, error } = useQuery(
    ['user.profile', userId],
    () => connector.getDocument("user.profile", { userId })
  )

  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  return <ProfileCard profile={profile} />
}
```

**`getCollection`** gibt eine Liste zurück, mit optionalem Paging. Die Data Layer bildet daraus einen `CollectionQueryState`:

```typescript
// Schnittstellen-Ebene (Connector implementiert dies)
getCollection(featureKey: string, request?: object, options?: CollectionOptions): Promise<Collection>

// Data Layer (UI nutzt dies)
function FeedView() {
  const {
    data: feedItems,
    isLoading,
    hasMore,       // Gibt es weitere Seiten?
    totalCount,    // Kann undefined sein, wenn Connector es nicht liefert
    loadMore       // Nächste Seite nachladen
  } = useCollectionQuery("user.feed", {}, { pagination: { limit: 20 } })

  if (isLoading) return <Spinner />

  return (
    <>
      {feedItems.map(item => <FeedCard key={item.id} item={item} />)}
      {hasMore && <button onClick={loadMore}>Weitere laden</button>}
    </>
  )
}
```

### Schreib-Operationen

Schreib-Operationen laufen als **Mutations** durch die Data Layer. Sie sind unabhängig von Queries — es muss keine Collection geladen sein, um ein Dokument hinzuzufügen.

**`setDocument`** erstellt oder aktualisiert ein Dokument.

```typescript
// Mutation: Profilbild aktualisieren
const { mutate: updateProfile } = useMutation({
  mutationFn: (data) => connector.setDocument("user.profile", data),
  onSuccess: () => cache.invalidate(['user.profile'])
})

updateProfile({ userId: "did:key:z6Mk...", avatarUrl: "https://..." })
```

**`addDocument`** fügt ein neues Dokument zu einer Collection hinzu. Der Connector vergibt die ID.

```typescript
// Mutation: Freundschaftsanfrage — unabhängig davon, ob die Liste geladen ist
const { mutate: sendRequest } = useMutation({
  mutationFn: (data) => connector.addDocument("user.friends.requests", data),
  onSuccess: () => cache.invalidate(['user.friends.requests'])
})

sendRequest({ targetUserId: "did:key:z6Mk..." })
```

**`removeDocument`** entfernt ein Dokument.

```typescript
// Mutation: Freundschaft entfernen mit Optimistic Update
const { mutate: removeFriend } = useMutation({
  mutationFn: (data) => connector.removeDocument("user.friends", data),
  onMutate: ({ friendId }) => {
    cache.removeOptimistic(['user.friends'], item => item.id === friendId)
  },
  onError: () => cache.rollbackOptimistic(['user.friends'])
})

removeFriend({ friendId: "did:key:z6Mk..." })
```

### Feature-Erkennung und adaptive UI

`isSupported` ermöglicht der UI, sich dynamisch an das Backend anzupassen. Da sich die Feature-Unterstützung während der Laufzeit nicht ändert, ist dies ein synchroner Aufruf — kein Query State nötig.

```typescript
// Schnittstellen-Ebene (synchron, kein Ladezustand)
const support = connector.isSupported(
  "user.feed",
  "user.friends",
  "user.friends.suggestions",
  "moderation.reports"
)
// → { "user.feed": true, "user.friends": true,
//     "user.friends.suggestions": false, "moderation.reports": false }
```

**UI-Konsequenz:** Für jedes Feature muss definiert werden, ob es **obligatorisch** oder **optional** ist. Die UI reagiert darauf:

| Kategorie | Verhalten | Beispiel |
|-----------|-----------|----------|
| **Obligatorisch** | Feature muss vorhanden sein, Connector ist ohne es nicht nutzbar | Items, Gruppen, Nutzer-Identität |
| **Optional** | UI blendet Bereich aus oder zeigt Fallback | Freundschaftsvorschläge, Statistiken |

```typescript
function FriendsSection() {
  const support = useFeatureSupport("user.friends", "user.friends.suggestions")

  // Feature nicht verfügbar → gar nicht rendern
  if (!support["user.friends"]) return null

  return (
    <div>
      {/* FriendsList nutzt intern useCollectionQuery mit Query State */}
      <FriendsList />
      {/* Nur rendern, wenn der Connector Vorschläge unterstützt */}
      {support["user.friends.suggestions"] && <SuggestionsList />}
    </div>
  )
}
```

---

## Multi-Source

Die Architektur erlaubt das Kombinieren von Daten aus mehreren Quellen. Der `SourceAggregator` implementiert selbst das `DataInterface` und delegiert an die einzelnen Connectoren.

```typescript
const sources = [
  new WotConnector({ storage: evoluStorage }),
  new GoogleCalendarConnector({ apiKey: "..." })
]

const aggregator = new SourceAggregator(sources)
```

### Sync und Speichern

- **Lesen:** Items aus allen Quellen werden zusammengeführt. Jedes Item trägt `_source` für die Herkunft.
- **Schreiben:** Mutations gehen an die aktive Quelle. Der Connector vergibt die ID.
- **Sync:** Jede Quelle synchronisiert sich selbst.
- **Ladezustand:** Die Data Layer aggregiert den Query State aller Quellen. Die UI sieht einen kombinierten `CollectionQueryState` — `hasMore` ist `true`, solange mindestens eine Quelle weitere Daten hat.
- **Subscriptions:** Bietet eine Quelle Subscriptions an, werden deren Updates automatisch in den aggregierten Datenstrom eingefügt. Quellen ohne Subscriptions werden per Snapshot behandelt.

```
┌──────────────────────────────────────────────┐
│              SourceAggregator                │
│          (implementiert DataInterface)        │
├──────────────────────────────────────────────┤
│                                              │
│  getItems() ───► Merge aus allen Quellen     │
│  subscribe*() ─► Weiterleitung an Quellen    │
│                  die Subscriptions bieten     │
│                                              │
│  createItem() ──► Mutation an aktive Quelle  │
│                   (Connector vergibt ID)     │
│                                              │
│  Sync: Jede Quelle managed sich selbst       │
│                                              │
└──────────────────────────────────────────────┘
```

---

## Gruppen

Gruppen sind der zentrale Kontext, in dem Items geteilt werden. Eine Gruppe ist eine Gemeinschaft von Menschen, die zusammenarbeiten.

```
┌─────────────────────────────────────────┐
│  Gruppe "Gemeinschaftsgarten"           │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Kalender│ │  Karte  │ │ Kanban  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  Items: Gießplan, Erntefest, Beet 3... │
│  (nur für Mitglieder sichtbar)          │
└─────────────────────────────────────────┘
```

### Gruppen-Wechsel

Ein Nutzer kann Mitglied mehrerer Gruppen sein und zwischen ihnen wechseln. Die Data Layer stellt dafür Hooks bereit:

```typescript
function GroupSwitcher() {
  // Query: Gruppen laden (mit Ladezustand)
  const { data: groups, isLoading } = useQuery(['groups'], () => connector.getGroups())

  if (isLoading) return <Spinner />

  return (
    <select onChange={(e) => connector.setCurrentGroup(e.target.value)}>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )
}

// Items reagieren automatisch auf Gruppenwechsel
function ItemList() {
  const { data: items, isLoading, hasMore, loadMore } = useItemsQuery()

  if (isLoading) return <Spinner />

  return (
    <>
      {items.map(item => <ItemCard key={item.id} item={item} />)}
      {hasMore && <button onClick={loadMore}>Weitere laden</button>}
    </>
  )
}
```

### Simple Apps

Für einfache Apps ohne Gruppen-Wechsel gibt es einen impliziten Default-Kontext. `getGroups()` liefert dann nur eine Gruppe, und kein Gruppen-Switcher ist nötig.

---

## Identität und Nutzer

### User

Ein User ist eine Identität mit Profil:

```typescript
interface User {
  id: string              // Connector-spezifisch (DID oder Server-ID)
  profile: UserProfile
}

interface UserProfile {
  displayName: string
  avatarUrl?: string
}
```

**Hinweis:** Ein User ist kein Item. Die Identität ist fundamental anders als Inhalte.

### Identitätsmodelle

Je nach Connector unterschiedlich:

| Connector | Identität      | Auth                   |
|-----------|----------------|------------------------|
| REST      | Server-Account | E-Mail/Passwort, OAuth |
| WoT       | DID (did:key)  | Keypair (Ed25519)      |

---

## Offene Fragen

Diese Aspekte werden in der Implementierung geklärt:

1. **Auth-Abstraktion** – Wie abstrahieren wir Keypair-Auth (WoT) und Server-Auth (REST) so, dass Module davon nichts wissen müssen?
2. **User-Profil als Item?** – Ist ein Nutzerprofil ein Item oder eine eigene Entität? (Hinweis: Über das FeatureInterface wäre ein Profil ein Document unter `"user.profile"` – unabhängig von der Item-Frage.)
3. **Migration** – Kann man von einem Connector zu einem anderen wechseln?
4. **Hybrid-Szenarien** – Können verschiedene Connector-Typen sinnvoll kombiniert werden?
5. **Feature-Katalog** – Welche Feature-Keys sind obligatorisch, welche optional? Ein verbindlicher Katalog muss definiert werden, sobald die ersten Connectoren implementiert werden.
6. **Typisierung** – Wie wird TypeScript-Typsicherheit für `item.data` und feature-spezifische Request/Response-Strukturen hergestellt? (z.B. über eine generische Registry `FeatureKey → RequestType, ResponseType` bzw. typisierte Item-Varianten)
7. **Data Layer Implementierung** – Eigene Implementierung oder Nutzung einer bestehenden Library (z.B. TanStack Query)? Die Schnittstelle (Query State, Mutations, Optimistic Updates) ist definiert, die Implementierung offen.
8. **Optimistic Update Strategie** – Welche Mutations bekommen Optimistic Updates, welche nicht? Leitlinie: Schnelle, häufige Aktionen (Item erstellen, Status ändern) profitieren davon; seltene, komplexe Aktionen (Gruppeneinstellungen ändern) können auf die Connector-Antwort warten.

---

## Weiterführend

- [Module im Detail](../modules/) – Spezifikationen der einzelnen UI-Module
- [Web of Trust Datenmodell](../../web-of-trust/docs/datenmodell/) – Entitäten im WoT
- [Connector-Implementierung](./connectors/) – Technische Details der Connectoren

---

*Diese Spezifikation ist ein lebendiges Dokument und wird basierend auf Implementierungserfahrungen aktualisiert.*
