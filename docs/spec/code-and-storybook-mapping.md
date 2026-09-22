# Code and Storybook Mapping

**Status:** Normativer Entwurf v0.1

Diese Spec beschreibt, wie die App-Komposition des Real Life Stack auf Code und Storybook abgebildet wird.

Die Source of Truth bleibt die Spec:

- [00-architecture.md](00-architecture.md)
- [01-app-composition.md](01-app-composition.md)
- [modules/](modules/)

Storybook ist keine eigene Spezifikation. Storybook macht die Spec visuell prüfbar und navigierbar.

## Code-Mapping

Der Toolkit-Code muss die RLS-Taxonomie nicht in jedem Ordnernamen exakt spiegeln. Wichtiger ist, dass jedes Bauteil fachlich eindeutig eingeordnet ist.

| RLS-Ebene | Typische Code-Orte | Beispiele |
|---|---|---|
| App Shell | `packages/toolkit/src/components/layout/`, `auth/`, `contacts/`, `debug/` | Navbar, BottomNav, WorkspaceSwitcher, UserMenu, ProfilePanelContent, ContactsDialog, VerificationDialog, DebugDashboard |
| Space Modules | `packages/toolkit/src/components/feed/`, `kanban/`, `calendar/`, `map/`, `resonance/`, `lens/` (CollectionView als Modul `collection`), `graph/` | Feed, Kanban / Tasks, Calendar, Map, Resonance, Collection, Graph |
| Module Components | geteilte Top-Level-Ordner (`comments/`, `reactions/`, `composer/`, `detail/`, `preview/`) oder Unterordner innerhalb von Space Modules | ItemPreview + Adornments (ItemTypeBadge, ItemMetaRow, ItemCommentCount), ContentComposer, ReactionBar, CommentSection, ItemDetailPanel, KanbanCard |
| Read-only Lenses | `packages/toolkit/src/components/lens/` | CollectionView (List/Grid-Dichte), ListView, GridView; Apps kombinieren sie mit ihren Presets |
| Primitives | `packages/toolkit/src/components/primitives/` | Button, Card, Dialog, Input, Tabs |
| Hooks | `packages/toolkit/src/hooks/` | useItems, useComments, useReactions, useVotes |
| Logik-Helfer (modulübergreifend) | `packages/toolkit/src/lib/` | filterByAssignee (Zuweisungsfilter), itemTitle / itemText, parseEventDate / isAllDayDate, moduleForItem |
| Logik-Helfer (modulgebunden) | im jeweiligen Modul-Ordner, z.B. `components/kanban/reorder.ts` | computeColumnReorder, normalizeStatus |

In der Reference-App spiegelt sich die Taxonomie so:

| App-Ebene | Code-Ort |
|---|---|
| Komposition (AuthGate, Connector, App-Eigenes) | `apps/reference/src/App.tsx` — der Rahmen selbst: `packages/toolkit/src/components/frame/app-frame.tsx` + `components/router/routed-app-frame.tsx` |
| Space-Module-Instanzen (eine Datei pro Modul) | `apps/reference/src/views/feed-view.tsx`, `kanban-view.tsx`, `calendar-view.tsx`, `map-view.tsx`, `resonance-view.tsx`, `collection-view.tsx`, `graph-view.tsx` |
| Modul-Dispatch (welches Modul rendert, wie es den Space füllt) | `packages/toolkit/src/components/host/module-outlet.tsx`, gerendert vom Rahmen `components/frame/app-frame.tsx` |
| Space/Module-Routing (URL → aktiver Space + Modul) | `packages/toolkit/src/components/router/workspace-routing.tsx` (`@real-life-stack/toolkit/router`; bis rls#429 in der Referenz-App) |

Regeln:

1. App-Shell-Flächen sind nicht pro Space aktivierbare Module.
2. Space Modules sind pro Space aktivierbare Oberflächen.
3. Module Components sind wiederverwendbare Bausteine innerhalb oder zwischen Space Modules.
4. Primitives kennen keine RLS-Semantik.
5. Hooks gehören zur RLS-Hook-Schicht, nicht zur Modul-Taxonomie.
6. Physische Ordner dürfen pragmatisch bleiben, solange Spec, Exports und Storybook die Einordnung klar machen.

## Storybook-Mapping

Storybook soll die RLS-Taxonomie sichtbar machen. Story-Titel verwenden diese Top-Level-Struktur:

```text
RLS
├─ Einstieg
├─ App
├─ App Shell
├─ Spaces
├─ Module
├─ Items
└─ Grundlagen
```

Die Navigation folgt der UI-Logik: zuerst die komplette App und ihr Kontext,
danach Module, gemeinsame Item-Darstellungen und zuletzt kleine Bausteine.
Innerhalb eines Moduls steht die Übersicht vor Komponenten und Zuständen.
„Modul“ ist der aktuelle Oberbegriff; „Linse“ bleibt nur als historischer Alias
beziehungsweise bestehender Code-Name auffindbar. „Ansicht“ bezeichnet eine
Darstellungsvariante. Allgemeine Item-Inhalte heißen „Detailansicht“;
„Personenprofil“ benennt den fachlichen Spezialfall.

Jede Story-Datei trägt ihre Id ausdrücklich in `meta.id`, nach dem Schema
`rls-<abschnitt>-<seite>` (seit rls#436 durchgängig Englisch, z. B.
`rls-app-04-loading-contract`, `rls-foundations-hooks`). URLs bleiben damit
stabil, auch wenn Titel oder Dateien umziehen. Ob eine Id existiert, prüfen
die Skripte: `scripts/site/check.mjs` gegen den gebauten Storybook-Index,
`scripts/hooks/lib.mjs` (`storyIds()`) aus dem Quelltext.

Am 19.09.2026 sind fünf Stories entfallen: PostCard, StatCard, ActionCard,
KanbanToolbar und das GridView-Duplikat (Begründung in rls#416). Neu
hinzugekommen sind `RLS/App shell/The module surface`,
`RLS/Foundations/Hooks` und `RLS/Foundations/All hooks`.

`RLS/Foundations/All hooks` ist erzeugt: `scripts/hooks/generate.mjs` liest den
Dokumentationskommentar über jedem öffentlichen Hook (erster Absatz = Frage,
`@answers`, `@without`, `@group`, `@see story`, `@see spec`) und schreibt
`src/hooks/all-hooks.json`, das die Seite rendert. `pnpm check:hooks` fällt in
CI, wenn ein Hook ohne vollständigen Block exportiert wird, eine Story-Id oder
Spec-Datei fehlt oder die Datei nicht mehr zum Code passt (`pnpm docs:hooks`).

## Overview Stories

Jedes Space Module soll langfristig eine Overview-Story haben.

Eine Overview-Story zeigt:

1. das Modul als Oberfläche im Space-Kontext,
2. typische Items oder Projektionen,
3. wichtige Module Components im Zusammenspiel,
4. sinnvolles Degradationsverhalten, wenn Features fehlen,
5. keine Backend-spezifische Logik.

Overview-Stories sind visuelle Einstiegspunkte, keine Integrationstests und keine Backend-Simulation.

## Kanban-Referenzmapping

Kanban / Tasks ist das erste abgerundete Referenzmodul für diese Mapping-Regeln. Es zeigt, wie ein Space Module aus wiederverwendbaren Module Components, generischen Items und optionalen Capabilities zusammengesetzt wird.

| Spec-Begriff | Code | Storybook | Daten-/Capability-Annahme |
|---|---|---|---|
| Kanban / Tasks Space Module | `packages/toolkit/src/components/kanban/kanban-module.stories.tsx` | `RLS/Modules/Kanban/Overview` | Items im Current Space mit Kanban-kompatiblem `data.status` |
| Board-Layout | `kanban-board.tsx` | `RLS/Modules/Kanban/Board` | `Item.data[statusField]` (Default `status`), schreibbar zusätzlich `Item.data.order`, optional `relations: assignedTo` und `users` |
| Filter/Werkzeuge | `kanban-toolbar.tsx` | Story entfallen (19.09.2026); Kanban baut seinen Kopf aus `ModuleToolbar` | Items, optionale `users`, optionaler `currentUserId`; Mutationen werden über Callbacks/Capabilities angebunden |
| Task-Erstellung/Bearbeitung | `kanban-task-create.tsx` | Modulkomponente; in späteren Stories direkt prüfbar | `ItemWriter` für persistente Erstellung/Bearbeitung; App entscheidet über erlaubte Felder |
| Kartendetail | `kanban-card-detail.tsx` | Modulkomponente; in späteren Stories direkt prüfbar | Item-Daten, optional `users`, Tags, Status und Assignee-Relations |

`KanbanBoard` akzeptiert zusätzlich `statusField` (Default `status`) und
`readOnly`. Eine read-only Ressourcen-Projektion mit `statusField="kind"`
ist in der Board-Story abgebildet; sie bindet weder Toolbar noch
Mutations-Callbacks ein.

## Linsen-Referenzmapping

| Spec-Begriff | Code | Storybook | Daten-/Capability-Annahme |
|---|---|---|---|
| Generische Sammlungs-Linse | `components/lens/collection-view.tsx` | `RLS/Modules/Shared views/Collection view` | alle Nicht-Relation-Items; session-lokaler Listen-/Raster-Toggle; `activeItemId?` und optionaler Sichtbereichs-Inset aus der Shell |
| Generische Listen-Projektion | `components/lens/list-view.tsx` | `RLS/Modules/Shared views/Collection view` (eigene Story entfallen 22.09.2026, Baustein der CollectionView) | Baustein der CollectionView: kompakte Dichte ohne lokalen Filter |
| Generische Linsen-Karte | `components/preview/item-preview.tsx` + `preview/item-type-meta.tsx` | Linsen-Stories | ItemPreview: List kompakt, Grid komfortabel; `active` nutzt den geteilten Glow; Typ-Meta für Person, Projekt, Ressource und Event sowie Typ-Badge-Fallback |
| Typspezifische Raster-Projektion | `components/lens/grid-view.tsx` | eigene Story entfallen (19.09.2026); sichtbar in `RLS/Modules/Shared views/Collection view` | Baustein der CollectionView: komfortable Dichte mit geteilten Preview-Adornments |
| Read-only Karten-Linse | `components/lens/map-lens.tsx` | `RLS/Modules/Map/MapView` (eigene MapLens-Story entfallen 22.09.2026; `lens-auto-fit`) | Nicht-Relation-Items mit gültigem GeoJSON-`Point`; `createAdapter` erzeugt pro Mount eine frische Engine; ein Marker zentriert im Shell-Sichtbereich bei Zoom 16, mehrere nutzen `fitBounds`; `viewportResetKey` re-armt beim Bestandswechsel; kein lokaler Filter |
| MapView | `components/map/map-view.tsx` | `RLS/Modules/Map/MapView` | Die Kartenfläche selbst; rendert MapLens intern |

Die CollectionView und die Map-Linse sind presentationale, read-only Module
Components. List/Grid sind deren wiederverwendbare Dichte-Projektionen und komponieren keine eigene Card-Fläche; die Map-Linse
rendert die geteilten Marker-Primitive. Die App-Shell besitzt Filter- und
Selektionszustand; `activeItemId` überlebt den Linsenwechsel. Karten-Linsen
heben den passenden `ItemPreview` hervor, die Map ihren Marker; beide
zentrieren das aktive Ziel einmal pro aktiver ID, ohne bei späteren Renders den
User-Scroll beziehungsweise -Viewport zu übernehmen.

Die Kanban-Komponenten stellen ihren eigenen Container-Query-Kontext bereit, damit sie auch außerhalb der App Shell, z.B. in Storybook oder eingebetteten Modulflächen, korrekt zwischen mobiler und breiter Darstellung wechseln.

## Feed-Referenzmapping

Feed ist das Referenzmodul für einen generischen Aktivitäts- und Inhaltsstrom im Current Space. Es zeigt Items unterschiedlicher Typen als Stream, ohne selbst neue Fachobjekte zu erfinden.

| Spec-Begriff | Code | Storybook | Daten-/Capability-Annahme |
|---|---|---|---|
| Feed Space Module | `packages/toolkit/src/components/feed/feed-module.stories.tsx` | `RLS/Modules/Feed/Overview` | Feed-fähige Items im Current Space, sortiert nach `createdAt` |
| Feed Item | `preview/item-preview.tsx` (shared) + Adornments (`item-type-badge.tsx`, `item-meta-row.tsx`, `item-comment-count.tsx`) | In der Overview als Standardprojektion verwendet | Generisches `Item` mit `data.title`, `data.content` oder `data.description`; type-spezifische Metadaten kommen über Adornments |
| Composer | `feed/feed-composer-trigger.tsx` (Feed-Trigger), `composer/content-composer.tsx` (geteilt) | `RLS/Items/Create and edit/ContentComposer` und Feed-Overview | Persistente Erstellung braucht später `ItemWriter`; die Story hält neue Items nur lokal |
| Reaktionen | `components/reactions/` (geteilt) | `RLS/Items/Detail view/Reactions and comments/ReactionBar` (auch ReactionPicker, ReactionDetails) | Optional über `RelationCapable`/`reactsTo`; Feed bleibt nutzbar ohne Relations |
| Kommentare | `components/comments/` (geteilt) | `RLS/Items/Detail view/Reactions and comments/CommentSection` | Optional über `RelationCapable`/`commentOn`; `ItemCommentCount` zeigt die Anzahl im Footer |
| PostCard | `post-card.tsx` | Story entfallen (19.09.2026) | Spezifische ältere Post-Projektion ohne Aufrufer; nicht die kanonische generische Feed-Projektion |

Die Feed-Overview darf keine Backend-Simulation erzwingen. Sie zeigt das Zusammenspiel von Composer, `ItemPreview` und optionalen Social Slots; echte Mutationen, Relations und Confirmations werden über Connector-Capabilities angebunden.

## Calendar-Referenzmapping

Calendar ist das Referenzmodul für zeitliche Projektionen im Current Space. Es zeigt Items unterschiedlicher Typen als Monats-, Wochen-, Tages- oder Listenansicht, wenn sie ein parsebares `data.start` tragen.

| Spec-Begriff | Code | Storybook | Daten-/Capability-Annahme |
|---|---|---|---|
| Calendar Space Module | `packages/toolkit/src/components/calendar/calendar-module.stories.tsx` | `RLS/Modules/Calendar/Overview` | Items im Current Space mit `data.start`, optional `data.end` |
| Header und Ansichtsauswahl | `calendar-view.tsx` | `RLS/Modules/Calendar/Overview` | UI-Zustand steuert Zeitraum, Monat/Woche/Tag/Liste und Heute-Sprung; `initialVisibleDate` öffnet additiv einen Startzeitraum ohne den Heute-Wert zu überschreiben |
| Filter | `calendar-view.tsx` | `RLS/Modules/Calendar/Overview` | Typ-, Tag- und Textfilter laufen über die geteilte Leiste (`useModuleFilteredItems`); Orts- und Current-User-Filter bleiben lokal; ihre Optionen stammen nur aus zeitlich darstellbaren Items; Persistenz ist App-/Shell-Verantwortung |
| Monatsansicht | `calendar-view.tsx` | `RLS/Modules/Calendar/Overview` | `Item.data.start` gruppiert Events nach Kalendertag; Event-Pills öffnen das Item |
| Wochen-/Tagesansicht | `calendar-view.tsx` | `RLS/Modules/Calendar/Overview` | Zeitgebundene Items werden auf einfache Zeitslots projiziert |
| Eventliste | `calendar-view.tsx` | `RLS/Modules/Calendar/Overview` | Zeitgebundene Items im sichtbaren Zeitraum, sortiert und nach Tag gruppiert |
| Event-Erstellung/Bearbeitung | `CalendarView` Create-Hook, später über `ContentComposer` | Create-Hook sichtbar, Persistenz noch nicht abgebildet | Persistente Erstellung braucht `ItemWriter`; Calendar bleibt ohne Writer read-only |
| Teilnehmer/Bestätigungen | spätere Module Components | noch nicht abgebildet | Optional über `RelationCapable` und `ConfirmationCapable` |

Die Calendar-Overview orientiert sich am Edge-Prototyp unter `https://real-life-stack.de/edge/` (Navigation `Kalender`), bleibt aber technisch eine backend-agnostische Projektion über generische Items.

## Flächen ohne Spec-Dokument

Diese Code-Flächen existieren, werden aber von keinem Spec-Dokument beschrieben. Die Liste hält die Lücke fest; sie ersetzt keine Spezifikation.

- `components/graph/` ist als Modul `graph` im Register; ein Modul-Spec-Dokument fehlt.
- `components/lens/collection-view.tsx` ist als Modul `collection` im Register, in der Spec aber nur als Linse beschrieben; die Modul-Spec fehlt.
- `components/activity/` liefert ActivityBell, ActivityPanel und NotificationCenter; eine Spec fehlt.
- `components/debug/` liefert DebugDashboard, StoreInspector und TraceTimeline; eine Spec fehlt.
- `components/contacts/` liefert Kontaktliste, Kontakt- und Verifizierungsdialoge sowie RelayStatusBadge; eine Spec fehlt.
- `layout/space-theme-panel.tsx` stellt die Farbeinstellung eines Space im Modul-Panel; eine Spec fehlt.
- `layout/connector-switcher.tsx` wechselt den aktiven Connector; eine Spec fehlt.

## Nicht-Ziele

Diese Spec definiert nicht:

- eine Pflicht zur sofortigen Ordner-Umstrukturierung,
- eine vollständige Storybook-Abdeckung für alle Komponenten,
- visuelles Design,
- Backend- oder Connector-Mocks als Norm,
- Produktnavigation einzelner Apps.

## Offene Punkte

1. Ob `components/auth/` dauerhaft App Shell bleibt oder später stärker WoT-spezifisch ausgelagert wird.
2. Ob einzelne Module Components, z.B. `ReactionBar`, eigene geteilte Code-Ordner bekommen sollen.
3. Ob Storybook später automatisiert gegen die Spec-Module-Liste geprüft werden soll.
