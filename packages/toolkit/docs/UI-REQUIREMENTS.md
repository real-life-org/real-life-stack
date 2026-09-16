# UI/UX Design-Entscheidungen

Atomare Design-Entscheidungen für das @real-life-stack/toolkit.
Jede Checkbox repräsentiert eine einzelne, aktivierbare Entscheidung.

---

## Schatten

- [ ] **shadow-card-xl**: Cards verwenden `--shadow-xl`
- [x] **shadow-card-lg**: Cards verwenden `--shadow-lg` (`--shadow-card: var(--shadow-lg)`)
- [ ] **shadow-card-md**: Cards verwenden `--shadow-md`
- [ ] **shadow-card-sm**: Cards verwenden `--shadow-sm`
- [ ] **shadow-card-none**: Cards ohne Schatten

- [ ] **shadow-navbar-xl**: Navbar verwendet `--shadow-xl`
- [ ] **shadow-navbar-lg**: Navbar verwendet `--shadow-lg`
- [x] **shadow-navbar-md**: Navbar verwendet `--shadow-md` (`--shadow-navbar: var(--shadow-md)`)
- [ ] **shadow-navbar-sm**: Navbar verwendet `--shadow-sm`
- [ ] **shadow-navbar-none**: Navbar ohne Schatten

- [ ] **shadow-button-xl**: Buttons verwenden `--shadow-xl`
- [ ] **shadow-button-lg**: Buttons verwenden `--shadow-lg`
- [ ] **shadow-button-md**: Buttons verwenden `--shadow-md`
- [ ] **shadow-button-sm**: Buttons verwenden `--shadow-sm`
- [x] **shadow-button-none**: Buttons ohne Schatten (`--shadow-button: none`)

---

## Cursor

- [x] **cursor-pointer-interactive**: Alle interaktiven Elemente zeigen `cursor: pointer`
- [x] **cursor-not-allowed-disabled**: Deaktivierte Elemente zeigen `cursor: not-allowed`

---

## Fokus-Verhalten

- [x] **focus-visible-only**: Focus-Ring nur bei Keyboard-Navigation, nicht bei Mausklick
- [x] **focus-ring-consistent**: Einheitlicher Focus-Ring mit `ring-ring/50`

## Benachrichtigungen

- [x] **notification-center-primitives**: Filter-Tabs und Gruppenaktionen verwenden die gemeinsamen Radix-Primitives; die Glocke behält den einheitlichen `focus-visible`-Ring.

---

## Navbar

- [x] **navbar-fixed-sections**: NavbarStart/NavbarEnd haben feste Breite (`w-56`) für stabile Mitte
- [x] **navbar-glass**: Navbar mit Glasmorphism (`.glass-navbar`; Deckkraft und Weichzeichnung aus `--surface-alpha`/`--surface-blur`, gesteuert von der Achse `surfaces: translucent | solid` des Space bzw. der Instanz)
- [x] **navbar-sticky**: Navbar bleibt beim Scrollen oben (`sticky top-0`)

---

## Cards

- [x] **card-no-hover-lift**: Cards bewegen sich nicht beim Hover
- [x] **card-backdrop-blur**: Cards mit `backdrop-blur-sm` für Glaseffekt
- [x] **card-rounded-xl**: Cards mit `rounded-xl`
- [x] **card-border**: Cards mit Border
- [x] **card-bg-white**: Cards haben weißen Hintergrund (`oklch(1.00 0 0)`)

---

## Workspace-Switcher

- [x] **workspace-logo-square**: Workspace-Avatare sind eckig (`rounded-md` im Trigger, `rounded-none` im Dropdown)
- [x] **workspace-name-prominent**: Workspace-Name groß und prominent (`text-lg font-semibold`)
- [ ] **workspace-name-with-label**: Zweizeilig mit "Workspace" Label
- [x] **workspace-chevron-hidden-mobile**: Chevron-Icon nur auf Desktop sichtbar

---

## User-Menu

- [x] **user-avatar-round**: User-Avatar ist rund (Standard)
- [ ] **user-avatar-square**: User-Avatar ist eckig

---

## Space-Konfiguration

Entwurf: Claude-Design-Projekt „RLS System Design", Datei `Space Menu.dc.html` (Turn 3 und 4).

- [x] **space-config-side-menu**: Bereiche stehen in einem Seitenmenü links, nicht in einer Reiterleiste — die Leiste war schon bei drei Einträgen am Anschlag
- [x] **space-config-section-list**: Menü, Inhalt und Startwert lesen **eine** Liste (`spaceConfigSections`); keine zweite Aufzählung der Bereiche
- [x] **space-config-identity-in-header**: Bild und Name stehen über den Bereichen und bleiben in jedem Bereich änderbar; es gibt keinen Bereich „Allgemein"
- [x] **space-config-fixed-frame**: Fester Rahmen, nur der Inhalt scrollt — Kopf, Menü und Fußzeile stehen
- [x] **space-config-dialog-is-space-window**: Der ganze Dialog trägt die Primärfarbe des bearbeiteten Space — er setzt `--primary`, `--primary-foreground`, `--ring` und den `--accent`-Tint lokal, dieselben Variablen, die `use-workspace-routing` auf `:root` legt. Öffnet man ihn aus der Übersicht oder einem anderen Space, stünden sonst zwei Farben nebeneinander: das Menü in der Farbe des bearbeiteten Space, der Einladen-Knopf in der der laufenden App
- [x] **space-config-active-in-space-color**: Der aktive Menüeintrag trägt die Primärfarbe des Space. Spec 04 nennt „aktive Navigations- und Sidebar-Items" ausdrücklich; damit spricht das Menü dieselbe Sprache wie die Modulleiste, und eine Farbänderung zeigt sich sofort daneben. Die Farbe kommt aus dem Dialog, nicht aus `--primary`: aus der Übersicht geöffnet wäre der bearbeitete Space nicht der aktive
- [x] **space-config-no-section-heading**: Kein Bereichsname als Überschrift über dem Inhalt — der Menüeintrag daneben nennt ihn auf gleicher Höhe und hebt ihn farbig hervor; für Screenreader trägt ihn die Fläche als `role="region"` mit `aria-label`
- [x] **space-config-single-section-no-menu**: Bleibt genau ein Bereich übrig, entfällt das Menü; ein einzelner Eintrag wäre eine Wahl ohne Alternative
- [x] **space-config-section-fallback**: Fällt der gewählte Bereich weg (Adminrecht steht beim Öffnen noch nicht fest), fällt die Auswahl auf den ersten zurück statt eine leere Fläche zu zeigen
- [x] **space-config-reset-on-close**: Beim Schließen fallen Bereich, Suche und Kontaktfilter zurück — der Dialog bleibt montiert und öffnete sonst für den nächsten Space im Bereich des vorigen
- [x] **space-config-no-name-autofocus**: Der Name fängt beim Öffnen keinen Fokus; er stand markiert da und ein Tastendruck hätte den Space umbenannt
- [x] **space-config-image-badge-persistent**: Das Stift-Abzeichen am Bild ist dauerhaft sichtbar, nicht erst bei Hover — auf einem Tastfeld gibt es kein Hover
- [x] **space-config-menu-horizontal-mobile**: Auf schmalen Schirmen liegt das Menü waagerecht über dem Inhalt
- [ ] **space-config-menu-as-page-mobile**: Auf schmalen Schirmen klappt das Menü zur Liste, der Bereich öffnet als zweite Seite mit „‹ Zurück" (Entwurf Turn 4)

### Mitglieder

- [x] **space-members-grouped**: Admins und übrige Mitglieder stehen in getrennten Gruppen; `members` ist nach DID sortiert, ein Abzeichen in flacher Liste sagte nichts über die Rolle
- [x] **space-members-no-admin-badge**: Kein Admin-Abzeichen an der Zeile — die Gruppe sagt es bereits
- [x] **space-members-search-threshold**: Suchfeld ab neun Mitgliedern; darunter überschaut man die Liste
- [x] **space-members-search-sticky**: Ein eingegebener Suchbegriff hält das Feld sichtbar, auch wenn die Zahl unter die Schwelle fällt — sonst bliebe ein wirksamer Filter ohne Bedienteil zurück (rls#377)
- [ ] **space-members-invited-by**: Herkunftszeile „eingeladen von …" je Mitglied und Gruppe „Offene Einladungen" (Entwurf 4c) — braucht `invitedBy` und einen Einladungszustand im `data-interface`

### Aussehen

- [x] **space-theme-own-section**: Aussehen ist ein eigener Bereich zwischen Einladen und Modulen
- [x] **space-theme-admin-gated**: Nur Admins ändern das Aussehen — das Design eines Space ist geteilte Wirklichkeit, kein persönlicher Geschmack
- [x] **space-theme-house-palette**: Die Farbvorschläge sind `TAG_PALETTE.accent`, dieselbe Palette wie die Tags (Spec 04, Regel 1) — keine zweite Farbwelt
- [x] **space-theme-custom-color**: Neben der Palette steht der native Farbwähler; eine geltende Farbe außerhalb der Palette wird als „eigene" markiert, nicht als „keine"
- [x] **space-theme-reset-to-fallback**: „Zurück zur Farbe aus dem Bild" schreibt `null` und stellt den Rückfall her (Logo-Farbe, sonst deterministisch aus der Space-Id), statt eine Farbe einzufrieren
- [x] **space-theme-accent-only**: Die Space-Farbe bleibt Akzent — Hintergründe und Karten unberührt (Spec 04, „Verwendung der Primärfarbe", Regel 1)
- [ ] **space-theme-scheme-tiles**: Theme-Kacheln Standard / Dunkel / Eigenes mit Datei-Upload (Entwurf 3c) — wartet auf die Entscheidung zur Theme-Kaskade
- [ ] **space-theme-manual-vs-derived**: Eine von Hand gewählte Farbe überlebt Logo-Upload und Logo-Entfernen. Heute überschreibt der Upload sie mit der Bildfarbe, das Entfernen setzt `null`; beide Pfade unterscheiden nicht zwischen gewählt und abgeleitet

---

### Einladen

- [x] **space-invite-own-section**: Einladen ist ein eigener Bereich, kein Unterzustand von Mitgliedern; „Einladen" bei den Mitgliedern springt dorthin statt aufzuklappen
- [x] **space-invite-not-admin-gated**: Der Bereich hängt nicht am Adminrecht — im WoT lädt jedes Mitglied ein, nur der Creator entfernt
- [x] **space-invite-verified-only**: Einladbar sind nur verifizierte Kontakte, die noch nicht Mitglied sind; es gibt bewusst keine Einladung per Link
- [ ] **space-invite-shared-space-subtitle**: Untertitel „gemeinsamer Space" an der Kontaktzeile (Entwurf 4a) — `ContactInfo` kennt keinen Bezug zu Spaces
- [ ] **space-invite-history**: „Von dir eingeladen" mit Zeitpunkt und Status Mitglied/Offen — nicht im Modell; gezeigt wird nur, wer in dieser Sitzung eingeladen wurde

---

## Adaptive Panels

- [x] **adaptive-panel-stack-order**: Gestapelte Panels schließen per Escape nur die oberste sichtbare Ebene
- [x] **adaptive-panel-sidebar-inset**: Ein Modal oder Drawer über einer Sidebar erhält deren Layout-Inset
- [x] **adaptive-panel-scroll-lock-stack**: Body-Scroll bleibt bis zum Schließen des letzten sperrenden Panels deaktiviert

---

## Graph

- [x] **graph-focus-visible-area**: Ausgewählte Knoten werden innerhalb der nicht vom Drawer verdeckten Fläche zentriert
- [x] **graph-focus-transition**: Die Kamera fährt weich zum ausgewählten Knoten und folgt ihm bis zum Ende der Force-Simulation
- [x] **graph-hover-transition**: Nicht verbundene Knoten und Kanten werden beim Hover weich ein- und ausgeblendet
- [x] **graph-reduced-motion**: Bei reduzierter Bewegung wechseln Kamera und Opazität ohne animierte Zwischenstufen
- [x] **graph-resize-continuity**: Canvas-Resizes zeichnen synchron nach, damit Panel-Animationen keinen leeren Frame zeigen

---

## Linsen

- [x] **lens-no-local-filter-toolbar**: List-, Grid- und read-only-Kanban-Linsen bringen keine eigene Filter-Toolbar mit
- [x] **lens-density-is-toggle**: Darstellungsdichte ist ein Toggle innerhalb einer Linse, nie eine eigene Linse; die Projektion definiert die Linse
- [x] **lens-read-only-no-drag**: Read-only-Kanban-Karten bieten keine Drag- oder Drop-Affordance
- [x] **lens-item-preview-composition**: List/Grid-Karten verwenden ausschließlich ItemPreview (List compact, Grid comfortable) plus Preview-Adornments
- [x] **grid-type-specific-cards**: Geteilte Preview-Adornments zeigen Person, Projekt, Ressource und Event mit ihren jeweils verwertbaren Feldern; sonstige Typen behalten einen Typ-Badge
- [x] **lens-selection-is-shell-state**: `activeItemId` bleibt Eigentum der App Shell bzw. des ModulePanels; ein Linsenwechsel verliert die Selektion nicht
- [x] **lens-active-item-highlight**: Jede Linse hebt das aktive Item hervor: Karten-Linsen über `ItemPreview.active` mit neutralem Default-Glow (optional pro Caller überschreibbar), Map/Graph über ihre bestehenden Selected-Stile
- [x] **lens-active-item-center-once**: Jede Linse zentriert das aktive, gerenderte Item einmal pro zusammenhängender Auswahl; ein fehlendes Ziel re-armt die Folge, ohne danach User-Scroll zu kapern
- [x] **lens-active-item-escalates-view**: Kann die aktuelle Unter-Ansicht einer Linse das aktive Item nicht darstellen (z. B. Monatszelle voll), wechselt der Fokus-Pfad einmalig in eine Ansicht, die es kann (z. B. Tagesansicht) — nie die Darstellungs-Ordnung verbiegen, um es hineinzuzwingen
- [x] **lens-switch-transition**: Der Wechsel der aktiven Linse ist eine React-Transition — die Auslöse-Fläche bleibt sofort responsiv, der schwere Mount der Ziel-Linse rendert nachgelagert; Flächen-Linsen virtualisieren ihre Bestände standardmäßig.
- [x] **lens-selection-visible-area**: Map, Graph und scrollbare Linsen berücksichtigen einen Shell-Bottom-Inset, damit eine Mobile-Drawer-Auswahl im nicht verdeckten Sichtbereich landet
- [x] **lens-focus-requires-visible-highlight**: Ein Fokus-Gate wird nur verbraucht, wenn das Ziel im selben Schritt tatsächlich sichtbar und hervorgehoben ist; bei Monats-Overflow erfüllt der Wechsel in die Tagesansicht diese Pflicht (siehe lens-active-item-escalates-view — die Zell-Ordnung wird nicht verbogen)
- [x] **lens-content-frame**: List und Grid scrollen über die volle verfügbare Breite; ihr gemeinsamer `max-w-6xl`-Inhaltsrahmen (einschließlich Toggle) ist innen zentriert. Grid-Zeilen messen ihren vertikalen Abstand mit.
- [x] **lens-empty-state-component**: Der Leer-Zustand jeder Linse ist die geteilte `EmptyState`-Primitive (zentriert, Icon + Titel + optionaler Hinweis) — nie nackter Text; „lädt noch" bleibt davon getrennt (Skeleton)
- [x] **map-reset-awaits-fresh-inventory**: Ein Space-/Inventar-Reset fittet erst einen nicht-leeren, gegenüber dem vorherigen Render neuen Markerbestand und nie noch sichtbare Marker des alten Space

---

## Dropdown-Menüs

- [x] **dropdown-cursor-pointer**: Alle Items zeigen `cursor: pointer`
- [x] **dropdown-trigger-no-outline**: Kein Fokusrahmen auf Trigger nach Auswahl

---

## Typografie

- [x] **font-sans-inter**: Inter als Sans-Serif Hauptschrift
- [ ] **font-sans-montserrat**: Montserrat als Sans-Serif Hauptschrift
- [x] **font-serif-merriweather**: Merriweather als Serif-Schrift
- [x] **font-mono-source-code-pro**: Source Code Pro als Monospace-Schrift

---

## Farbschema

- [ ] **color-scheme-green**: Grün-basiertes Theme (Primary: Grün)
- [x] **color-scheme-blue**: Blau-basiertes Theme (Primary: #2563eb / oklch(0.55 0.21 264))
- [ ] **color-scheme-purple**: Lila-basiertes Theme

- [x] **secondary-green**: Sekundärfarbe Grün (#22c55e / oklch(0.72 0.19 142))
- [ ] **secondary-monochrom**: Sekundärfarbe aus Primary-Familie

- [ ] **accent-amber**: Akzentfarbe Amber (#f59e0b / oklch(0.78 0.16 75))
- [x] **accent-monochrom**: Akzentfarbe aus Primary-Familie (Light: oklch(0.95 0.03 264), Dark: oklch(0.30 0.08 264))

- [x] **background-slate**: Slate-basierte Hintergrundfarben (slate-50 / oklch(0.98 0.01 247))
- [ ] **background-neutral**: Neutrale Grautöne

---

## Dark Mode

- [x] **dark-mode-supported**: Vollständige Dark Mode Unterstützung
- [x] **dark-mode-class-based**: Theme-Wechsel über `.dark` Klasse auf `<html>`

---

## Assets

- [x] **assets-base-path**: Logo-Pfade nutzen `import.meta.env.BASE_URL` für GitHub Pages Kompatibilität

---

## Changelog

| Datum | Änderung |
|-------|----------|
| 2026-01-10 | Initiale Dokumentation erstellt |
| 2026-01-10 | Cursor-Pointer für interaktive Elemente |
| 2026-01-10 | Focus-visible statt focus für Fokusrahmen |
| 2026-01-10 | Workspace-Logos eckig (nicht rund) |
| 2026-01-10 | Feste Breiten für NavbarStart/NavbarEnd |
| 2026-01-10 | Kein Hover-Lift auf Cards |
| 2026-01-10 | Semantische Schatten-Variablen (--shadow-card, --shadow-navbar, --shadow-button) |
| 2026-01-10 | Dokumentation auf atomare Checkboxen umgestellt |
| 2026-01-10 | **Theme-Wechsel auf Blau** (Landing Page Design) |
| 2026-01-10 | Font-Wechsel auf Inter |
| 2026-01-10 | Farbschema: Primary Blau, Secondary Grün, Accent Amber |
| 2026-01-10 | Schatten auf Tailwind-Standard (shadow-lg für Cards/Buttons, shadow-md für Navbar) |
| 2026-01-10 | Hintergrund auf Weiß (oklch(1.00 0 0)) |
| 2026-01-10 | Accent auf Blau-Familie umgestellt (keine Orange-Hover mehr) |
| 2026-01-10 | Button-Schatten deaktiviert (shadow-button: none) |
| 2026-07-16 | Adaptive-Panel-Stacking und weiche Graph-Fokus-/Hover-Übergänge dokumentiert |
| 2026-07-17 | Read-only-Linsen ohne lokale Filter- oder Drag-Affordances dokumentiert |
| 2026-07-17 | Linsen-Karten auf ItemPreview plus geteilte Typ-Adornments zurückgeführt |
| 2026-07-17 | Selektionskontinuität für Linsen: Shell-State, gemeinsamer Highlight- und Einmal-Zentrierungs-Vertrag |
| 2026-07-17 | Listen- und Rasterdichte zur CollectionView-Linse mit session-lokalem Toggle zusammengeführt |
| 2026-07-17 | Vollbreite Linsen-Scroller, gemeinsamer Inhaltsrahmen und gemessene Raster-Zeilenabstände dokumentiert |
| 2026-07-17 | CollectionView-Toggle erhält den Linsen-Innenabstand oben; Rasterkarten nutzen reihenfolgestabile, gemessene Masonry-Lanes |
| 2026-09-15 | Space-Konfiguration als Seitenmenü mit Bereichen Mitglieder, Einladen, Module (Entwurf „Space Menu") |
| 2026-09-16 | Bereich „Aussehen“: Space-Primärfarbe aus der Haus-Palette, eigene Farbe, Rückweg zum Rückfall |
