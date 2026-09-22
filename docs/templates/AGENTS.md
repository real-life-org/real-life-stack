# AGENTS.md — building an app on Real Life Stack

This file is a template. Copy it into the root of a new app repository (or hand it to your coding agent) when building an app **on top of** the published Real Life Stack packages. It is not about contributing to the stack itself — for that, read the [repository AGENTS.md](https://github.com/real-life-org/real-life-stack/blob/master/AGENTS.md).

Machine-readable overview of the whole stack (packages, spec, every hook): <https://real-life-stack.de/llms.txt>. Handbook page for humans: <https://real-life-stack.de/handbuch/erste-app/> (German).

## What Real Life Stack is

A modular, backend-agnostic app and UI toolkit for community apps: maps of people, places and projects, calendars, kanban boards, feeds, lists, graphs, profiles.

```text
app frame / modules -> hooks -> DataInterface -> connector -> data source
```

The app never talks to a backend. It renders the toolkit's frame; modules ask hooks; hooks read a `DataInterface`; a **connector** implements that interface against a concrete data source. Swapping the connector swaps the backend without touching the UI.

**What stays with the app** (spec 01): the connector, the router, the register of modules (the toolkit's seven come bound by default), the map engine, and the frame. Nothing else. A module runs without a line in the app; the app does not build header, tabs, panel, create or detail itself.

Status: packages are `0.x` — the API is usable but still moving. Pin exact versions.

## Install

```bash
npm install react react-dom react-router-dom maplibre-gl
npm install --save-exact @real-life-stack/data-interface @real-life-stack/toolkit @real-life-stack/mock-connector
npm install --save-dev vite @vitejs/plugin-react tailwindcss @tailwindcss/vite typescript
```

Pick one connector:

| Connector | Package | Use when |
|---|---|---|
| Mock | `@real-life-stack/mock-connector` | Prototyping, demos, seed data in memory. Start here. |
| Local | `@real-life-stack/local-connector` | Offline-first, single device, persistent. |
| Supabase | `@real-life-stack/supabase-connector` | Central backend on Supabase (auth, rows, realtime). |
| Web of Trust | `@real-life-stack/wot-connector` | Decentralized, end-to-end encrypted groups, DID identity. |

The UI code is identical for all of them. Build against the mock connector first; switch later.

## The whole app (generated from `examples/first-app`, built and tested in CI)

<!-- first-app:start -->
```tsx
// src/main.tsx — data and address
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { MockConnector } from "@real-life-stack/mock-connector"

import { App } from "./App"
import "./index.css"
import "maplibre-gl/dist/maplibre-gl.css"

async function start() {
  // Die Daten: ein Space, ein Mensch, ein Item — im Speicher, für den Anfang.
  const connector = new MockConnector({
    users: [{ id: "mira", displayName: "Mira" }],
    groups: [{ id: "garten", name: "Gemeinschaftsgarten", data: { modules: ["calendar", "map", "collection"] } }],
    groupMembers: { garten: ["mira"] },
    items: [{
      id: "erntefest", type: "event", createdBy: "mira", createdAt: "2026-09-01T10:00:00Z",
      data: { title: "Erntefest", content: "Wir teilen unsere Ernte.", start: "2026-09-26T14:00:00+02:00", position: { type: "Point", coordinates: [13.4, 52.5] } },
    }],
    groupItems: { garten: ["erntefest"] },
  })
  await connector.init()
  connector.setCurrentGroup("garten")

  // Die Adresse: /{space}/{modul}/{item} — der Rahmen liest sie, die App stellt nur den Router.
  const router = createBrowserRouter([{ path: "*", element: <App connector={connector} /> }])

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void start()
```

```tsx
// src/App.tsx — the frame
import type { DataInterface } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { MapLibreAdapterProvider } from "@real-life-stack/toolkit/maplibre"
import { RoutedAppFrame } from "@real-life-stack/toolkit/router"

// Die App stellt drei Dinge: den Connector, die Karten-Engine und den Rahmen.
// Kopfzeile, Tabs, Panel, Erstellen, Detail und alle Module kommen aus dem Toolkit.
export function App({ connector }: { connector: DataInterface }) {
  return (
    <ConnectorProvider connector={connector}>
      <MapLibreAdapterProvider>
        <RoutedAppFrame fallbackModule="collection" />
      </MapLibreAdapterProvider>
    </ConnectorProvider>
  )
}
```
<!-- first-app:end -->

Styles (`src/index.css`): Tailwind, the toolkit's tokens, and the toolkit's built files as a Tailwind source — without the third line the frame has no spacing and no colours.

```css
@import "tailwindcss";
@import "@real-life-stack/toolkit/styles/globals.css";
@source "../node_modules/@real-life-stack/toolkit/dist";
@custom-variant dark (&:is(.dark *));
```

Vite: `plugins: [react(), tailwindcss()]`, nothing else. Then `vite` — the space, its tabs, the item in calendar and map, detail in the panel, create with all types. To add a module of your own: a view, a register entry (`composeModules([TOOLKIT_DEFINITION, yours])` + `setModuleRegistry`, once, before the first render), a module hint. See the network app's `module-register.tsx`.

## Data model (read this before inventing your own)

Everything is an **Item**: a person, place, project, event, task, post, offer. Items have `id`, `type` (a class or a set of classes), `data` (schema-composed fields), and live in **Groups** (called Spaces in the UI — visibility and collaboration contexts). **Relations** connect items (typed predicates, some symmetric). **Users** are identities; in the WoT connector they are DIDs.

- Do not design a parallel data model. Express your domain as item types + fields + relations. Vocabulary and schema composition: [spec 06](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/06-schema-composition.md).
- A module shows items by what they **have** (`presents: ["start"]` = everything with a date), not by type. The host loads them; the module never queries itself.
- Read items via hooks (`useItems` with an `ItemFilter`), never by reaching into the connector. Writes go through the writer hooks (`useCreateItem`, `useUpdateItem`, `useDeleteItem`), not through custom fetch calls.
- `Group.data` updates are merge patches: `null` deletes a key. `Group.data.modules` is the space's module list, in tab order.

## Capabilities, not assumptions

Connectors differ. Feature-detect instead of hardcoding:

```ts
import { isWritable, hasGroups, isAuthenticatable } from "@real-life-stack/data-interface"
if (isWritable(connector)) { /* show create/edit UI */ }
```

Inside the frame this is done for you: reading hooks answer empty without a capability, writing hooks fail on the call, and surfaces hide what the connector cannot do. The full table per hook: <https://real-life-stack.de/storybook/?path=/docs/rls-foundations-all-hooks--docs>.

## UI rules (these keep apps consistent and migratable)

1. **Compose, do not rebuild.** The frame, the host, the panel, create and detail exist once, in the toolkit. A second version in an app — also a partial one, also a "temporary" one — is a defect (spec 01, rule 5).
2. **Cards always come from `ItemPreview`.** Never hand-roll an item card.
3. **One dialog family.** Detail, composer and confirm come from the toolkit; variants via props and capabilities, never app-side forks.
4. **Cross-cutting UX belongs to the toolkit.** Empty states, loading, error boundaries, permission hints: check the toolkit first; if it is missing, that is an upstream issue, not an app-local workaround.
5. **Type-driven rendering.** The item type decides how it renders. Register or extend type presentation instead of `if (item.type === ...)` chains.
6. Styling: import `@real-life-stack/toolkit/styles/globals.css` once; use the tokens; do not restyle toolkit internals.

## Source of truth

- Types in `@real-life-stack/data-interface` are the precise contract (English).
- Normative spec (German): [spec index](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/README.md). When this file and the spec disagree, the spec wins.
- Glossary: [glossary.md](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/glossary.md).

## For agents specifically

- Keep changes small and reviewable; prefer the composition above over clever abstractions.
- Do not fork or vendor toolkit components to change their behaviour — file an issue upstream instead. Do not copy internal files to get at a missing export.
- Do not write secrets into code, docs or prompts.
- Before handing off, run typecheck and build; say which checks ran.
- If something in the stack blocks you (missing export, missing capability, unclear spec), say so explicitly in your handoff instead of working around it silently. These reports are how the stack becomes better for the next app.
