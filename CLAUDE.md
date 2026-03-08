# Claude Code Anweisungen

## Projekt

Real Life Stack (RLS) — ein Monorepo fuer Community-Apps mit austauschbarem Daten-Backend.

Kernidee: UI-Module (Kanban, Kalender, Karte, Feed) arbeiten gegen ein einheitliches `DataInterface`. Verschiedene Connectoren (Mock, Local, GraphQL, WoT/Automerge) implementieren dieses Interface. Die UI weiss nicht, woher die Daten kommen.

## Architektur

```text
apps/reference/          → Showcase-App (alle Module, MockConnector + LocalConnector)
apps/landing/            → Landing Page
packages/toolkit/        → UI-Komponenten (shadcn/ui, Storybook) + Hooks + ConnectorProvider
packages/data-interface/ → TypeScript-Typen, Interfaces, BaseConnector, Shared Helpers
packages/mock-connector/ → In-Memory-Implementierung
packages/local-connector/  → IndexedDB-Implementierung mit Cross-Tab-Sync
packages/graphql-connector/ → GraphQL-Client (graphql-request + graphql-ws)
packages/graphql-server/   → GraphQL-Server (Fastify + Mercurius + Pothos)
```

### Datenfluss

```text
UI-Modul → Hooks → DataInterface (Connector) → Datenquelle
```

- **DataInterface** (`packages/data-interface/`) — das zentrale Interface. Read-only Core + Capability-Interfaces.
- **Connector** — implementiert DataInterface + die Capabilities die er braucht.
- **Hooks** — duenne Schicht, uebersetzen Observable → React State und Mutations → Promise. Hooks pruefen Capabilities via Type Guards.
- **UI-Module** — reine Darstellung, bekommen Daten via Hooks. Wissen NICHT woher die Daten kommen.

### Item-Modell

Alles sind Items (`{ id, type, data, relations? }`). Der `type` bestimmt das Rendering, die Felder in `data` bestimmen, in welchen Modulen ein Item erscheint:

- `status` → Kanban (Spalten sind konfigurierbar, NICHT hardcoded)
- `start`/`end` → Kalender
- `location` → Karte
- `content` → Feed

Ein Item kann in mehreren Modulen gleichzeitig erscheinen. `title` lebt in `data`, nicht top-level.

## Architektur-Regeln (WICHTIG — IMMER befolgen!)

### Interface Segregation (ISP)

`DataInterface` ist **read-only** (6 Methoden: init, dispose, getItems, getItem, observe, observeItem). Zusaetzliche Faehigkeiten ueber separate Capability-Interfaces:

- **`ItemWriter`** — createItem, updateItem, deleteItem
- **`RelationCapable`** — getRelatedItems
- **`GroupManager`** — alle Gruppen- und Mitglieder-Methoden
- **`Authenticatable`** — Auth, User-Methoden
- **`MultiSource`** — Quellen-Verwaltung
- **`FullConnector`** — Convenience-Typ = alle Interfaces zusammen

**Regeln:**
- Ein Connector implementiert NUR die Interfaces die er braucht. Ein CalDAV-Import-Connector implementiert nur `DataInterface` ohne Stub-Methoden.
- Hooks pruefen Capabilities via Type Guards (`isWritable()`, `hasGroups()`, `isAuthenticatable()`, etc.) und werfen einen beschreibenden Fehler wenn die Capability fehlt.
- `BaseConnector` implementiert `FullConnector` mit sinnvollen Defaults — ist ein Convenience, keine Pflicht.

### DRY — Keine Duplikation

- **`createObservable()` und `matchesFilter()`** leben in `data-interface/base-connector.ts`. NIEMALS in einzelnen Connectors duplizieren — immer aus `@real-life-stack/data-interface` importieren.
- Wenn ein Helper in mehr als einem Connector gebraucht wird, gehoert er in `data-interface`.

### Keine Cross-Dependencies zwischen Connectors

Jeder Connector haengt NUR von `data-interface` + eigenen Libraries ab. Connectors importieren NIEMALS voneinander.

### Demo-Daten

- JSON-Dateien leben in `packages/data-interface/data/`, typisierter Wrapper in `demo-data.ts`
- Import: `import { demoItems, ... } from "@real-life-stack/data-interface/demo-data"` — NICHT ueber mock-connector re-exportieren.

### Observable Pattern

- `ReactiveObservable<T>` mit `current`, `subscribe(cb)`, `set(value)`, `destroy()`
- Keine externe RxJS-Dependency. Eigenes Pattern via `createObservable<T>(initial)`.
- Filter-Keys nutzen `JSON.stringify(filter)` als Map-Key fuer Caching.

### UI-Komponenten und Storybook

- **Alle UI-Komponenten gehoeren ins `toolkit` Package** — NICHT in einzelne Apps. Apps kombinieren nur Toolkit-Komponenten.
- **Storybook pflegen:** Fuer jede UI-Komponente im Toolkit eine Story anlegen/aktualisieren. Stories dienen als Dokumentation und visuelle Tests.

### Hooks und ConnectorProvider

- Hooks und `ConnectorProvider` leben im `toolkit` Package, NICHT in einzelnen Apps.
- Jede App uebergibt ihren Connector via `<ConnectorProvider connector={...}>`.
- Hooks sind duenn: Observable → React State, Mutations → Promise. Kein Caching oder Business-Logik in Hooks.

### Relations: Scope-Prefix-System

Relation-Targets nutzen Scope-Prefixe:
- `item:` — selbe Gruppe/Space
- `space:{id}/item:` — Cross-Space-Referenz
- `global:` — User-IDs (DIDs)

### User vs. Profil

- **User** = Identity (nur id + cached displayName/avatarUrl). User ist KEIN Item.
- **Profil** = Item (`type: "profile"`) mit zwei Sichtbarkeitsstufen (public + contacts-only). Profil IST ein Item.

### GraphQL Subscriptions

WebSocket via `graphql-ws` (npm-Paket), NICHT `graphql-sse`. Mercurius nutzt das `graphql-transport-ws` Subprotokoll.

## Packages

### `@real-life-stack/data-interface`

- TypeScript-Typen + Shared Helpers (`createObservable`, `matchesFilter`)
- Exportiert: `DataInterface`, `ItemWriter`, `RelationCapable`, `GroupManager`, `Authenticatable`, `MultiSource`, `FullConnector`
- Type Guards: `isWritable()`, `hasRelations()`, `hasGroups()`, `isAuthenticatable()`, `hasMultiSource()`
- `BaseConnector` — abstrakte Basisklasse mit Defaults fuer alle Capabilities
- Demo-Daten: `@real-life-stack/data-interface/demo-data`
- Aendern nur nach Absprache — das ist der Vertrag zwischen UI und Backend

### `@real-life-stack/mock-connector`

- `MockConnector` implementiert `FullConnector`
- In-Memory, fuer Entwicklung und Tests

### `@real-life-stack/local-connector`

- `LocalConnector` implementiert `FullConnector`
- IndexedDB-Persistenz via `idb-keyval`
- BroadcastChannel fuer Cross-Tab-Sync
- Seed-Daten ueber Constructor

### `@real-life-stack/graphql-connector`

- `GraphQLConnector` implementiert `FullConnector`
- `graphql-request` fuer Queries/Mutations, `graphql-ws` fuer Subscriptions
- HTTP-URL wird automatisch zu WS-URL konvertiert

### `@real-life-stack/graphql-server`

- Fastify + Mercurius + Pothos Schema Builder
- Port 4000, GraphiQL Playground, CORS aktiviert

### `@real-life-stack/toolkit`

- UI-Komponenten basierend auf shadcn/ui (Radix + Tailwind)
- Layout: AppShell, Navbar, WorkspaceSwitcher, ModuleTabs, BottomNav, UserMenu
- Content: PostCard, StatCard, ActionCard, SimplePostWidget, KanbanBoard
- Hooks: useItems, useItem, useCreateItem, useUpdateItem, useDeleteItem, useGroups, useMembers, useAuthState, useCurrentUser
- ConnectorProvider fuer React Context
- Storybook fuer Komponentenentwicklung (`pnpm storybook`)

## Konventionen

- **shadcn/ui Pattern:** Komponenten liegen im Repo, nicht als npm-Dependency
- **Tailwind CSS v4** mit OKLCH-Farben
- **CVA** (class-variance-authority) fuer Varianten, `cn()` fuer bedingte Klassen
- **Deutsche Demo-Texte** in der Reference App
- **pnpm** als Package Manager, **Turbo** fuer Build-Orchestrierung
- **TypeScript strict mode** in allen Packages
- **Type-only Imports** nutzen: `import type { Item } from ...`
- **UI-Aenderungen dokumentieren:** `packages/toolkit/docs/UI-REQUIREMENTS.md` aktualisieren

## Entwicklung

```bash
pnpm install              # Abhaengigkeiten installieren
pnpm dev:reference        # Reference App starten (Vite)
pnpm storybook            # Storybook fuer Toolkit-Komponenten
pnpm build                # Alles bauen (Turbo)
```

### Connector verwenden

```typescript
import { MockConnector } from "@real-life-stack/mock-connector"
import type { Item, DataInterface } from "@real-life-stack/data-interface"
import { isWritable, hasGroups } from "@real-life-stack/data-interface"

const connector = new MockConnector()
await connector.init()

// Items lesen (DataInterface — jeder Connector kann das)
const tasks = await connector.getItems({ type: "task" })

// Schreiben nur wenn der Connector es kann
if (isWritable(connector)) {
  await connector.createItem({ type: "task", createdBy: "user-1", data: { title: "Neu" } })
}

// Gruppen nur wenn der Connector es kann
if (hasGroups(connector)) {
  const groups = await connector.getGroups()
}
```

## Architektur-Spec

Die vollstaendige Architektur ist dokumentiert in `docs/spec/architektur2.md`. Dort stehen alle Entscheidungen mit Begruendung. Bei Unklarheiten: zuerst die Spec lesen.

## Wichtige Dateien

- `docs/spec/architektur2.md` — Architektur-Spezifikation (kanonisch)
- `packages/data-interface/src/index.ts` — Alle Typdefinitionen + Capability-Interfaces
- `packages/data-interface/src/base-connector.ts` — BaseConnector + createObservable + matchesFilter
- `packages/data-interface/src/demo-data.ts` — Demo-Daten Wrapper
- `packages/toolkit/src/hooks/connector-context.tsx` — ConnectorProvider + useConnector
- `packages/toolkit/docs/UI-REQUIREMENTS.md` — UI/UX Anforderungen
- `packages/toolkit/src/styles/globals.css` — Theme & CSS-Variablen
- `apps/reference/src/App.tsx` — Reference App (Showcase)
