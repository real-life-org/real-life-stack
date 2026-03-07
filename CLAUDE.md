# Claude Code Anweisungen

## Projekt

Real Life Stack (RLS) — ein Monorepo fuer Community-Apps mit austauschbarem Daten-Backend.

Kernidee: UI-Module (Kanban, Kalender, Karte, Feed) arbeiten gegen ein einheitliches `DataInterface`. Verschiedene Connectoren (Mock, REST, WoT/Automerge) implementieren dieses Interface. Die UI weiss nicht, woher die Daten kommen.

## Architektur

```text
apps/reference/        → Showcase-App (alle Module + MockConnector)
apps/landing/          → Landing Page
packages/toolkit/      → UI-Komponenten (shadcn/ui, Storybook)
packages/data-interface/ → TypeScript-Typen (DataInterface, Item, Group, User, Observable)
packages/mock-connector/ → In-Memory-Implementierung mit Demo-Daten
```

### Datenfluss

```text
UI-Modul → Hooks → DataInterface (Connector) → Datenquelle
```

- **DataInterface** (`packages/data-interface/`) — das zentrale Interface. Typen-only, keine Implementierung.
- **Connector** — implementiert DataInterface. Aktuell: `MockConnector` (in-memory). Spaeter: REST, WoT/Automerge.
- **Hooks** — duenne Schicht, uebersetzen Observable → React State und Mutations → Promise.
- **UI-Module** — reine Darstellung, bekommen Daten via Hooks.

### Item-Modell

Alles sind Items (`{ id, type, data, relations? }`). Der `type` bestimmt das Rendering, die Felder in `data` bestimmen, in welchen Modulen ein Item erscheint:

- `status` → Kanban
- `start`/`end` → Kalender
- `location` → Karte
- `content` → Feed

Ein Item kann in mehreren Modulen gleichzeitig erscheinen.

## Packages

### `@real-life-stack/data-interface`

- Reine TypeScript-Typen, keine Runtime-Abhaengigkeiten
- Exportiert: `DataInterface`, `Item`, `Group`, `User`, `Observable`, `Relation`, `ItemFilter`, `AuthState`, `Source`
- Aendern nur nach Absprache — das ist der Vertrag zwischen UI und Backend

### `@real-life-stack/mock-connector`

- `MockConnector` Klasse implementiert `DataInterface`
- Demo-Daten: Tasks (Kanban), Events (Kalender), Posts (Feed), Places (Karte)
- 3 Gruppen, 4 User, Feature-Item
- Fuer Entwicklung und Tests — kein echtes Backend noetig

### `@real-life-stack/toolkit`

- UI-Komponenten basierend auf shadcn/ui (Radix + Tailwind)
- Layout: AppShell, Navbar, WorkspaceSwitcher, ModuleTabs, BottomNav, UserMenu
- Content: PostCard, StatCard, ActionCard, SimplePostWidget
- UI-Primitives: Button, Card, Dialog, Input, Avatar, Tabs, etc.
- Storybook fuer Komponentenentwicklung (`pnpm storybook`)

## Konventionen

- **shadcn/ui Pattern:** Komponenten liegen im Repo, nicht als npm-Dependency
- **Tailwind CSS v4** mit OKLCH-Farben
- **Deutsche Demo-Texte** in der Reference App
- **pnpm** als Package Manager, **Turbo** fuer Build-Orchestrierung
- **UI-Aenderungen dokumentieren:** `packages/toolkit/docs/UI-REQUIREMENTS.md` aktualisieren

## Entwicklung

```bash
pnpm install              # Abhaengigkeiten installieren
pnpm dev:reference        # Reference App starten (Vite)
pnpm storybook            # Storybook fuer Toolkit-Komponenten
pnpm build                # Alles bauen (Turbo)
```

### MockConnector verwenden

```typescript
import { MockConnector } from "@real-life-stack/mock-connector"
import type { Item, Group } from "@real-life-stack/data-interface"

const connector = new MockConnector()
await connector.init()

// Items nach Typ laden
const tasks = await connector.getItems({ type: "task" })
const events = await connector.getItems({ type: "event" })

// Reaktiv beobachten
const observable = connector.observe({ type: "task" })
const unsub = observable.subscribe((tasks) => console.log(tasks))

// Gruppen
const groups = await connector.getGroups()
connector.setCurrentGroup(groups[0].id)
```

## Architektur-Spec

Die vollstaendige Architektur ist dokumentiert in `docs/spec/architektur2.md`. Dort stehen alle Entscheidungen mit Begruendung. Bei Unklarheiten: zuerst die Spec lesen.

## Wichtige Dateien

- `docs/spec/architektur2.md` — Architektur-Spezifikation (kanonisch)
- `packages/toolkit/docs/UI-REQUIREMENTS.md` — UI/UX Anforderungen
- `packages/toolkit/src/styles/globals.css` — Theme & CSS-Variablen
- `packages/data-interface/src/index.ts` — Alle Typdefinitionen
- `packages/mock-connector/src/demo-data.ts` — Demo-Daten
- `packages/mock-connector/src/mock-connector.ts` — MockConnector Implementierung
- `apps/reference/src/App.tsx` — Reference App (Showcase)
