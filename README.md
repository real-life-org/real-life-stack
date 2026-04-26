# Real Life Stack

**Modularer Baukasten für lokale Vernetzung und dezentrale Zusammenarbeit**

Lokale Gemeinschaften brauchen digitale Werkzeuge, die echte Begegnungen fördern statt ersetzen. Real Life Stack ist ein modularer Baukasten, mit dem Communities eigene Apps für lokale Vernetzung bereitstellen und an ihre Bedürfnisse anpassen können.

> **Selbstorganisation leicht gemacht** – Werkzeuge für echte Zusammenarbeit, die Gruppen dabei helfen, gemeinsam vor Ort etwas zu bewegen.

---

## Das Problem

Lokale Initiativen werden zu zentralen Akteuren bei der Bewältigung sozialer und ökologischer Herausforderungen. Doch:

- **Etablierte Plattformen** sind auf Aufmerksamkeit und Reichweite optimiert, nicht auf lokale Zusammenarbeit
- **Kleine Initiativen** besitzen nicht die Ressourcen, eigene Systeme zu bauen
- **Fehlende Infrastruktur** zwingt Communities auf Plattformen, die ihre Daten kontrollieren

## Die Lösung

Real Life Stack bietet eine gemeinsame technische Grundlage:

- **Modularer UI-Baukasten** – Karte, Kalender, Gruppen, Profile, Feed als wiederverwendbare Komponenten
- **White-Label-App** – Sofort einsetzbar, ohne Programmierkenntnisse anpassbar
- **Backend-agnostisch** – Connector-Architektur für REST, Local-first, P2P oder E2EE
- **Vertrauensbasierte Identität** – Web of Trust durch reale Begegnungen

### Der Aktivierungskreislauf

```
Vorschlagen → Planen → Umsetzen → Vertrauen aufbauen → Erfolge teilen → ↩
```

Real Life Stack unterstützt den gesamten Kreislauf: von der Idee über die Verabredung bis zur gemeinsamen Umsetzung vor Ort. Durch echte Zusammenarbeit entsteht ein Vertrauensnetzwerk ([Web of Trust](https://web-of-trust.de)), das die Gemeinschaft nachhaltig stärkt.

---

## Architektur

```text
┌──────────────────────────────────────────────────────────┐
│                           UI                             │
│   ┌──────────────────────────────────────────────────┐   │
│   │                   App-Shell                      │   │
│   └──────────────────────────────────────────────────┘   │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐   │
│   │ Kanban │ │Kalender│ │ Karte  │ │  Feed  │ │ ...  │   │
│   └────────┘ └────────┘ └────────┘ └────────┘ └──────┘   │
├──────────────────────────────────────────────────────────┤
│                      Hooks (dünn)                        │
├──────────────────────────────────────────────────────────┤
│                     DataInterface                        │
├──────────────────────────────────────────────────────────┤
│                    Connectoren                           │
│    ┌────────┐ ┌───────────┐ ┌────────────────────────┐   │
│    │  Mock  │ │   REST    │ │  WoT (Automerge+E2EE)  │   │
│    └────────┘ └───────────┘ └────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### App-Shell + UI-Module

Die **App-Shell** ist der Container, die **UI-Module** (Kanban, Kalender, Karte, Feed, ...) sind austauschbar. Jede Gruppe wählt, welche Module sie nutzt. Module prüfen nicht den Item-Typ, sondern welche Daten-Felder vorhanden sind (`status` → Kanban, `start`/`end` → Kalender, `location` → Karte).

### Hooks + DataInterface

Die Hooks sind eine dünne Schicht zwischen UI und Connector — sie übersetzen Observables in React State und Mutations in Promises. Das **DataInterface** definiert den read-only Kernvertrag: Items lesen und reaktiv beobachten. Zusätzliche Fähigkeiten wie Schreiben, Gruppen, Identität oder Relations werden über Capability-Interfaces (`ItemWriter`, `GroupManager`, `Authenticatable`, ...) erkannt. Module kennen nur diese Interfaces, nicht das Backend.

### Connectoren

Jeder Connector implementiert das DataInterface und nur die Capabilities, die seine Datenquelle unterstützt. Der **MockConnector** (in-memory) dient zur Entwicklung, der **LocalConnector** für lokale IndexedDB-Persistenz, ein **GraphQL-Connector** für klassische Server, der **WoT-Connector** (Yjs/CRDT + E2EE) für dezentrale, verschlüsselte Zusammenarbeit.

---

## Module

| Modul | Beschreibung |
|-------|--------------|
| [**Map**](docs/modules/map.md) | Lokale Orte, Ressourcen und Aktivitäten auf einer Karte visualisieren |
| [**Calendar**](docs/modules/calendar.md) | Events planen, Termine koordinieren, Einladungen verwalten |
| [**Feed**](docs/modules/feed.md) | Aktivitäten-Stream aus allen Modulen – was passiert in der Community? |
| **Groups** | Gruppen mit Rollen, Mitgliedschaften und gemeinsamen Ressourcen |
| **Profiles** | Nutzerprofile mit Fähigkeiten, Interessen und Vertrauensbeziehungen |

---

## Zielgruppe

- Nachbarschaftsnetzwerke und Urban-Gardening-Gruppen
- Repair-Cafés, Foodsharing-Initiativen, Solawis
- Jugendgruppen und freie Lernorte
- Sharing- und Tausch-Communities
- Organisationen, die lokale Gruppen stärken

---

## Demos

| Demo | Beschreibung |
|------|--------------|
| **[Landing Page](https://real-life-stack.de/)** | Projektübersicht und Einstieg |
| **[Reference App](https://real-life-stack.de/app/)** | Implementierung mit allen Modulen |
| **[UI-Prototyp](https://real-life-stack.de/edge/)** | Experimentelle UI-Konzepte und Komponenten |
| **[Storybook](https://real-life-stack.de/storybook/)** | Komponenten-Dokumentation |
| **[Web-of-Trust](https://it4change.github.io/web-of-trust-prototype/)** | Forschungs-Prototyp für dezentrale Identität |

---

## Forschungsprojekt: Web-of-Trust

[Web-of-Trust](https://web-of-trust.de) ist eine experimentelle Spielwiese, auf der wir Ideen und Ansätze für Real Life Stack erforschen und testen:

- **Dezentrale Identitäten** – Experimente mit did:key und Ed25519
- **Web of Trust** – QR-Code-basierte Verifizierung, JWS-Signaturen
- **Local-first** – Automerge CRDT für Offline-Fähigkeit
- **Modulare Architektur** – AppShell-Pattern für verschiedene Apps

**[Zur Landing Page →](https://web-of-trust.de)** | **[Zum Prototyp →](https://it4change.github.io/web-of-trust-prototype/)** | **[GitHub →](https://github.com/IT4Change/web-of-trust)**

---

## Team

Das Projekt wird von einem Team mit langjähriger Erfahrung in Open-Source-Community-Tools entwickelt:

- **Anton Tranelis** – Projektkoordination, System-Architektur, Full Stack
- **Ulf Gebhardt** – Full Stack, DevOps, Infrastruktur
- **Sebastian Stein** – Frontend-Entwicklung, UX/UI
- **Mathias Lenz** – Qualitätssicherung, Testing, Dokumentation

### Referenzprojekte

- [Utopia Map](https://github.com/utopia-os/utopia-map/) – Kartenplattform für lokale Vernetzung
- [ocelot.social](https://github.com/Ocelot-Social-Community/ocelot.social) – Soziales Netzwerk für Communities

---

# Entwickler-Dokumentation

## Monorepo-Struktur

```text
real-life-stack/
├── packages/
│   ├── data-interface/    # @real-life-stack/data-interface - TypeScript-Typen + Capabilities
│   ├── mock-connector/    # @real-life-stack/mock-connector - In-Memory-Implementierung
│   ├── local-connector/   # @real-life-stack/local-connector - IndexedDB + Cross-Tab-Sync
│   ├── graphql-connector/ # @real-life-stack/graphql-connector - GraphQL-Client
│   ├── graphql-server/    # @real-life-stack/graphql-server - Fastify/Mercurius Server
│   ├── wot-connector/     # @real-life-stack/wot-connector - WoT/Yjs/E2EE
│   └── toolkit/           # @real-life-stack/toolkit - UI-Komponenten + Hooks
├── apps/
│   ├── landing/           # Landing Page
│   ├── reference/         # Reference App (React 19)
│   └── prototype/         # UI-Prototyp (experimentell)
└── docs/                  # Dokumentation
    ├── spec/              # Architektur-Spezifikation
    ├── modules/           # Modul-Spezifikationen
    ├── concepts/          # Konzept-Dokumente
    └── funding/           # Förderantrag
```

## Schnellstart

```bash
# Dependencies installieren
pnpm install

# Reference App starten
pnpm dev:reference

# Landing Page starten
pnpm dev:landing

# Toolkit bauen
pnpm build:toolkit
```

## DataInterface & Connectoren

UI-Module arbeiten gegen das **DataInterface** und optionale Capability-Interfaces — TypeScript-Vertraege, die Daten, Reaktivitaet, Schreibzugriff, Gruppen und Identitaet abstrahieren. Connectoren implementieren diese Interfaces fuer verschiedene Backends.

### @real-life-stack/data-interface

Reine TypeScript-Typen und Shared Helper (keine externen Runtime-Abhaengigkeiten):

```typescript
import type { DataInterface, Item, Group, User, Observable } from "@real-life-stack/data-interface"
```

### @real-life-stack/mock-connector

In-Memory-Implementierung mit Demo-Daten fuer Entwicklung ohne Backend:

```typescript
import { MockConnector } from "@real-life-stack/mock-connector"

const connector = new MockConnector()
await connector.init()

const tasks = await connector.getItems({ type: "task" })  // 5 Demo-Tasks
const groups = await connector.getGroups()                  // 3 Demo-Gruppen

// Reaktiv beobachten
const obs = connector.observe({ type: "task" })
obs.subscribe((tasks) => { /* Live-Updates */ })
```

Architektur-Details: [docs/spec/architektur2.md](docs/spec/architektur2.md)

## @real-life-stack/toolkit

Das Toolkit-Package exportiert wiederverwendbare UI-Komponenten:

```typescript
import { Button, Card, Avatar, Tabs } from '@real-life-stack/toolkit'
```

**[Storybook ansehen →](https://it4change.github.io/real-life-stack/storybook/)**

```bash
# Storybook lokal starten
pnpm storybook

# Storybook bauen
pnpm build:storybook
```

### Tech Stack

- TypeScript + React 19
- Tailwind CSS v4
- Radix UI Primitives
- CVA (class-variance-authority)
- Vite

---

**Gemeinsam gestalten wir die Zukunft – lokal vernetzt, global gedacht.**
