# Anatomie eines Moduls

**Status:** Leitfaden, abgeleitet aus der Spec. Bei Widerspruch gilt die Spec.

Diese Seite ist die Landkarte für alle, die eine App oder ein Modul auf dem Real Life Stack bauen, Menschen wie Agenten. Sie sagt für jede Zone der Oberfläche, wem sie gehört und welcher Baustein sie füllt, und zitiert die Regel, aus der das folgt. Wer sie gelesen hat, weiß, wo etwas hingehört, bevor er die erste Zeile schreibt.

Warum es diese Seite gibt: Beim Bau des ersten externen Beispiels ([Karabirrdt](https://github.com/antontranelis/karabirrdt), September 2026) wurden rund fünfzehn Stellen anders gebaut, als die Spec sie definiert. Fast alles davon stand in [01-app-composition.md](spec/01-app-composition.md) und [modules/shared-components.md](spec/modules/shared-components.md), aber verteilt über 800 Zeilen und einen 41 Commits alten Checkout. Diese Seite bündelt es auf einer.

## Lesereihenfolge

1. Diese Seite.
2. [01-app-composition.md](spec/01-app-composition.md), Abschnitte „Overlay-Flächen“, „Content-Bereich“, „Die Modulfläche ist eine Spalte“, „Modul-Register“.
3. [modules/shared-components.md](spec/modules/shared-components.md), die Verträge der Bausteine, die unten genannt werden.
4. [modules/README.md](spec/modules/README.md) und [modules/template.md](spec/modules/template.md), wenn ein neues Modul entsteht: erst die Spec nach der Vorlage, dann Code.
5. [toolkit-index.md](toolkit-index.md), die vollständige Liste der exportierten Bausteine der installierten Version.
6. [templates/AGENTS.md](templates/AGENTS.md), Bootstrap und Regeln für eine App auf den npm-Paketen.

Lies die Doku in der Version, die du installiert hast. Das Repo ist oft weiter oder älter als das Paket. Jede Toolkit-Version hat ein Tag `toolkit-vX.Y.Z`; die Doku dazu liegt unter `https://github.com/real-life-org/real-life-stack/tree/toolkit-vX.Y.Z/docs`.

## Die Zonen

```text
┌────────────────────────────────────────────────────────────────┐
│ Navbar: Space-Switcher · [Modul-Tabs] · Relay-Status · Nutzer  │  App Shell
├────────────────────────────────────────────────────────────────┤
│ Kopf: Suche (links) · Ansicht/Aktionen (rechts)                │  Modulfläche
├───────────────────────────────────────────┬────────────────────┤
│                                           │ Panel:             │
│ Inhalt (scrollt, oder Karte/Graph)        │ Detail lesen →     │
│                                           │ bearbeiten;        │
│                                           │ Composer; Filter   │
│ ◯ Filter-Pille (unten links)  Erstellen ⊕ │                    │
└───────────────────────────────────────────┴────────────────────┘
  Dialog-Ebene (Modal): Space konfigurieren, Mitglieder, Profil, Kontakte
  Hinweis-Ebene (Toast/Banner): Einladungen, eingehende Verifikation
```

| Zone | Besitzer | Baustein | Was hinein gehört | Was nicht | Regel |
|---|---|---|---|---|---|
| Navbar | App Shell | `Navbar`, `WorkspaceSwitcher`, `ModuleTabs`, `UserMenu`, `RelayStatusBadge` | Space wechseln, Modul wechseln, Nutzer, Verbindungsstatus | Knöpfe, Felder oder Anzeigen eines Moduls | 01 § App Shell, „Was kein Space Module ist“ |
| Space-Konfiguration | App Shell, Dialog-Ebene | `GroupDialog`, Mitglieder-Verwaltung | Name, Beschreibung, Module, Mitglieder, Daten des Space | Modul-Zustand | 01 § Overlay-Flächen Ebene 2 |
| Modul-Kopf | Modulfläche | `ModuleFrame` (besitzt den Kopf), `ModuleToolbar` (Beitrag des Moduls) | Suche links, aktive Filter, Ansichtswechsel und Modul-Aktionen rechts | Erklärtexte, Verbindungsstatus, Datenexport | 01 § Modulfläche Regel 2, 4, 5 |
| Inhalt | Modul | Modul-eigene Fläche oder Linse (`CollectionView`, `KanbanBoard`, `MapView`, …) | Die Projektion der Items | Eigene Karten für Items | shared-components § `ItemPreview` |
| Karte eines Items | Toolkit | `ItemPreview` mit Adornment-Slots | Typ-getriebene Darstellung, Zuständige, Meta | Handgebaute Kacheln | shared-components § `ItemPreview`, Adornments |
| Ecke unten links | Modulfläche | `FilterPill` in der `PanelSafeArea` | Filter öffnen | Zweites Element in derselben Ecke | 01 § Modulfläche Regel 6 |
| Ecke unten rechts | Modulfläche | `CreateFab` | Neues Item; der Composer wählt den Typ | Eigene Plus-Knöpfe, „weitere Karte“-Knöpfe im Detail | shared-components § `CreateFab` |
| Schwebende Bedienung über Karte/Graph | Modul, als Beitrag zum Kopf | `clearsTopLeft`, `PanelSafeArea` | Zoom, Standort | Zweiter Kopf, eigene Leiste | 01 § Modulfläche Regel 5, Content-Bereich Pflicht 2 |
| Panel rechts | App, eine Instanz | `AdaptivePanel`, `DetailHostProvider`, `ItemDetailView` | Erst Lesen (`ItemDetailBody`, ⋮-Menü mit Bearbeiten und Löschen, Diskussion), dann Bearbeiten (`ContentComposer`) | Composer als erste Ansicht; Lösch- oder Status-Knöpfe im Formular; eigene Kopfzeilen | shared-components § `ItemDetailView` Regel 1 und 5, 01 § Overlay-Flächen Ebene 1 |
| Formular | Toolkit | `ContentComposer` über `ContentTypeConfig` (Widgets: title, text, media, date, location, people, tags, status, group) | Felder als deklarierte Widgets; Personen aus den Mitgliedern (`peopleOptions`, `peopleQuickSuggestions`); Tags des Space | Eigene Widgets, wo ein deklariertes existiert; Erklärsätze | shared-components § `ContentComposer` |

## Die drei Abläufe

**Item anlegen.** `CreateFab` unten rechts öffnet den Composer im Panel. Der Composer bietet die Typen des Moduls an. Ein Modul darf einen schnelleren Einstieg zusätzlich haben (Klick auf leere Zelle, Feed-Pille), ersetzt den FAB aber nicht.

**Item öffnen.** Klick auf eine `ItemPreview` öffnet das Panel in der Leseansicht: Typ-Badge, Titel, Text, Fakten-Box (Datum, Ort, Beteiligte, Beziehungen), Autor, Diskussion. Rechts oben das ⋮-Menü. „Bearbeiten“ schaltet dasselbe Panel auf den Composer, Speichern oder Abbrechen zurück. Beziehungen zu anderen Items stehen in der Fakten-Box und sind als `ItemPreview` verlinkt.

**Item löschen.** Nur über das ⋮-Menü der Leseansicht, mit `DeleteConfirmDialog`. Nie als Knopf im Formular, nie zweistufig selbstgebaut.

Status („offen“, „erledigt“) ist ein Widget des Composers, keine eigene Aktion.

## Was ein Modul selbst besitzt

- Die Fläche und ihre Projektion: ein Raster, eine Karte, ein Kalender, ein Graph.
- Modul-eigene Aktionen im Kopf rechts (Ansicht wechseln, Zoom, „Heute“).
- Modul-eigene Auswertungen, wenn die Spec des Moduls sie vorsieht.
- Den Beitrag zum Typ-Register (Widgets je Typ, Slots in Vorschau und Detail).

Alles andere ist geliehen. Wer etwas baut, das in der Tabelle oben einen Besitzer hat, baut es doppelt.

## Wenn ein Baustein fehlt

1. Im [Toolkit-Index](toolkit-index.md) der installierten Version nachsehen, dann in der Reference-App (`apps/reference/src`), dann in `shared-components.md`.
2. Fehlt er wirklich: nicht bauen. Fundstelle notieren (welche Datei im Paket, welche Prop fehlt), einen Vorschlag formulieren, und die Lücke im Bericht oder Handoff nennen. Ein fehlendes Feld ist besser als ein Eigenbau, der später migriert werden muss.
3. Die Lücke wird ein Issue oder PR im Stack, nach [modules/template.md](spec/modules/template.md) für Module und nach dem Beitragsleitfaden für Komponenten.

Bekannte Lücken, die auf diesem Weg gemeldet wurden, stehen in der Doku des jeweiligen Beispiels, für das Karabirrdt in dessen `docs/rls-kompatibel.md`.

## Selbstprüfung vor dem Handoff

- Steht in der Navbar nur, was die App Shell besitzt?
- Öffnet ein Klick auf ein Item zuerst die Leseansicht?
- Kommt jede Item-Karte aus `ItemPreview`?
- Ist jedes Formularfeld ein deklariertes Widget?
- Sitzt der Filter unten links, das Erstellen unten rechts, die Suche oben links?
- Gibt es im Modul einen Erklärtext, eine Legende oder eine Kopfzeile, die ein Kanban-Detail in der Reference-App nicht hätte?
- Ist jede eigene Komponente in der Liste „Was ein Modul selbst besitzt“ begründbar, oder als Lücke gemeldet?
