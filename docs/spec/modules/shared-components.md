# Shared Module Components

**Status:** Normativer Entwurf v0.1

Diese Spec listet die wiederverwendbaren Bausteine, die mehr als ein *Space Module* benutzen darf — und beschreibt für jede Komponente den minimalen Vertrag, gegen den Module sich verlassen können. Sie ergänzt [01-app-composition.md §Module Components](../01-app-composition.md) um die maschinen-lesbare Definition jedes geteilten Bausteins.

Sie definiert *nicht* das visuelle Aussehen — das ist Sache der UI-Schicht und liegt im Polish-Backlog. Was hier festgeschrieben ist: API-Form, Daten-Verträge und Slot-Konvention.

Code-Referenz: `packages/toolkit/src/components/` und `packages/toolkit/src/hooks/`.

## Zweck

Module Components abstrahieren wiederkehrendes UI-Verhalten, das jedes neue Modul sonst neu erfindet:

- Item-Vorschau (Preview),
- Item-Detail mit Comments und Reactions,
- Composer für Item-Erstellung und -Bearbeitung,
- Filter über Tags / Type / Date,
- Profile-Click.

Jede shared Komponente trägt einen klaren Vertrag, damit Module sie ohne Library-Bindung benutzen können.

## Geltungsbereich

Diese Spec deckt:

- die geteilten React-Komponenten im Toolkit (`packages/toolkit/src/components/`),
- die geteilten Hooks (`packages/toolkit/src/hooks/`),
- die Slot-/Adornment-Konventionen, die Module nutzen um spezifische Darstellung zu ergänzen.

Sie deckt *nicht*:

- visuelle Spezifikation (Spacings, Farben, Hover-States) — folgt im UI-Polish,
- modul-spezifische Komponenten (z.B. `KanbanBoard`, `CalendarView`) — bleiben in ihrem Modul,
- App-Shell-Flächen (Navbar, ProfilePanelContent) — eigene Verträge in `01-app-composition.md`.

## Komponenten

Jede shared Komponente hat: Zweck, Vertrag (TypeScript-Signatur), Slot-Konvention falls vorhanden, Spec-Anker.

### `ContentComposer`

**Zweck:** Item-Erstellung und -Bearbeitung über eine Widget-Komposition.

**Vertrag (Pflichtfelder + häufig gesetzte Optionen):**

```ts
interface ContentComposerProps {
  contentTypes: ContentTypeConfig[]
  initialContentType?: string
  /** Alias für initialContentType, wenn die UI mit einem festen Modus arbeitet. */
  mode?: string
  initialData?: Partial<WidgetData>
  onSubmit: (data: ContentComposerSubmitData) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void
  /** Expliziter Override; sonst `editMode ?? !!onDelete`. */
  editMode?: boolean
  widgets?: CustomWidgetDefinition[]
  showVisibility?: boolean
  defaultPublic?: boolean
  liveUpdate?: boolean
  className?: string
  // Weitere optionale Props (peopleOptions, tagSuggestions, geocode,
  // reverseGeocode, requestMapPick, renderPreview, …) siehe
  // `packages/toolkit/src/components/composer/content-composer.tsx`.
}

interface ContentComposerSubmitData {
  contentType: string
  isPublic: boolean
  data: WidgetData
}
```

**Slot-Konvention:** `contentTypes[].defaultWidgets` listet die Widgets, die der Composer für einen Typ rendert (`title`, `text`, `date`, `location`, `status`, `people`, `tags`, `media`, `group`). `defaultWidgets` und ihre Reihenfolge leiten sich aus dem Feld- und Kantenregister ab ([06 → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister)); die Reihenfolge ist die der [Edit-Regeln](#edit-regeln), keine feste Widget-Liste. Modul-spezifische Widgets können per `widgets?: CustomWidgetDefinition[]` ergänzt werden; sie sind eine Ausnahme mit Lückenmeldung, nicht die Regel.

**Edit vs. Create:** Der Composer entscheidet via `editMode ?? !!onDelete` — explizit gesetzter `editMode` gewinnt; ansonsten signalisiert das Vorhandensein von `onDelete` Edit-Modus (Delete-Button erscheint, Submit-Label wechselt zu „Speichern"). Caller ohne beides sind im Create-Modus.

**Präsentation je Modul (Hülle):** Die `ContentComposer`-Form ist geteilt; *wie* sie eingeblendet wird, wählt das Modul — es gibt mehrere Hüllen, nicht eine für alle. Heute: **Fullscreen-Morph** (Feed, `FeedComposerTrigger`) und **Content-Panel** (Calendar/Map/Kanban, [Ebene 1](../01-app-composition.md): Sidebar auf Desktop / Drawer auf Mobile). Vereinheitlicht wird nur, was tatsächlich falsch liegt (z.B. ein Composer, der auf Mobile fälschlich Sidebar bleibt), nicht per Brechstange alles gleichgemacht.

**Spec:** [01-app-composition.md → Module Components](../01-app-composition.md)

#### Personenfelder (`people`)

**Zweck:** Ein Typ kann MEHRERE Personen-Zuweisungen führen — eine Aufgabe z.B. „Kann ich" (`assignedTo`) und „Will lernen" (`wantsToLearn`). Dafür gibt es **keine zweite Komponente und keinen zweiten Composer**: dasselbe `people`-Widget wird je deklariertem Eintrag einmal gerendert.

```ts
interface ContentTypeConfig {
  /** Kurzform für genau ein Personenfeld. */
  peopleRelation?: { predicate: string }
  /** Mehrere Personenfelder, in Renderreihenfolge. */
  peopleRelations?: readonly { predicate: string; label: string; dataKey?: string }[]
}
```

**Regeln (normativ):**

1. `peopleRelations` gewinnt über `peopleRelation`; die Einzahl-Form bleibt gültig und bedeutet genau einen Eintrag.
2. Der Datenschlüssel ist `data.people` für den ersten (bzw. einzigen) Eintrag und `data.people:<predicate>` für jeden weiteren; ein gesetztes `dataKey` gewinnt. Ein Eintrag beschriftet sein Feld über `label`; ohne `peopleRelations` gilt weiter `widgetLabels.people`.
3. Welche Schlüssel Personen tragen, sagt die **Konfiguration**, nicht der Name: Composer (Sichtbarkeit, Ungespeichert-Schutz, `liveUpdate`) und Mapper erkennen sie über die aufgelöste Feldliste. Das `people:`-Präfix ist nur die Ableitungsregel für den Standardschlüssel, kein Erkennungsmerkmal — ein eigener `dataKey` nimmt an allem gleichberechtigt teil.
4. Alle Felder teilen sich `peopleOptions`, `peopleSuggestions` und `peopleQuickSuggestions` sowie den einen `people`-Eintrag in `defaultWidgets` — der Typ schaltet die Personenfelder gemeinsam ein.
5. Beim Speichern schreibt der Mapper je Feld die Relationen seines Prädikats (`global:<userId>`); Relationen anderer Prädikate — auch die eines nicht eingereichten Personenfeldes — bleiben unverändert. Die Vorbefüllung liest je Prädikat zurück.
6. Deklariert die Kante einen Qualifier ([08 → Qualifier an Kanten](../08-relation-records.md#qualifier-an-kanten)), liest und schreibt das Feld ihn als `meta.role` je Relation. Der Mapper MUSS den Qualifier einer Person erhalten, die im Feld bleibt; er DARF `meta` beim Ersetzen der Relationen nicht verwerfen.

**Code:** `packages/toolkit/src/components/composer/people-relations.ts` (`resolvePeopleFields`, `peopleDataKeys`, `peopleRelationsFromWidgetData`, `peopleRelationsToWidgetData`).

#### Location-Widget (`location`)

**Zweck:** Einen **physischen Ort** für verortete Items setzen. Das `location`-Widget (`LocationWidget`, im `WIDGET_ORDER` zwischen `date` und `people`) hat genau diesen einen Zweck. Online-/Meeting-Links sind kein Ort und gehören nicht hierher (ggf. eigenes Feld/Widget).

**Zwei Eingabewege:**

- **(a) Adresse → Geocoding → Position:** Freitext-Adresse im Adress-`Input`. Ein injizierter Geocoder löst die Eingabe debounced auf (ab wenigen Zeichen; die vorherige Anfrage wird abgebrochen) und zeigt Vorschläge; die Auswahl setzt `data.position` und übernimmt den Adresstext. Die Vorschlagsliste ist eine zugängliche Combobox (`role="combobox"`/`listbox`/`option`, Pfeiltasten/Enter/Escape). **Gespeichert wird die kurze Form** („Straße Nr, PLZ Ort" — dieselbe, die auch das Reverse-Geocoding liefert), denn sie steht danach auf jeder Karte; die **lange Form** des Providers steht als zweite Zeile in der Vorschlagsliste, damit zwei gleichnamige Straßen unterscheidbar bleiben. Fehlen die Strukturdaten, bleibt es bei der langen Form — lieber lang als leer. Der Geocoding-Provider ist nicht normativ festgelegt und wird — wie der Karten-Adapter — injiziert; Referenz ist Nominatim/OSM (öffentliche Instanz nur Dev/Demo, produktiv self-hosted/identifiziert).
- **(b) Position auf der Karte wählen:** Neben dem Adressfeld steht ein kompakter Button (in einer Zeile); beim Klick ruft das Widget einen vom Caller bereitgestellten `onPickOnMap`-Callback auf. Gepickt wird auf der **großen Karte des Map Module**, nicht in einer Inline-Minikarte: die App wechselt ins Map-Modul, ein Klick auf die Karte übernimmt die Position sofort (`MapAdapter.observeClicks` → `MapClickEvent.position`, durchgängig `[lng, lat]`), anschließend füllt ein Reverse-Geocoding das Adressfeld. Nach dem Picken bleibt man auf der Karte.

**App-Realisierung des Map-Picks (Referenz-App, nicht Widget-Sache):** Damit der Speichern-Pfad den Modulwechsel übersteht, liegen Editor + `ContentComposer` app-weit über dem Modul-Outlet (Composer-Host). Das geteilte Content-Panel ([01-app-composition.md → Overlay-Flächen](../01-app-composition.md)) bleibt beim Modulwechsel offen; auf kompakten Screens (Drawer) tritt es während des Pickens beiseite und kommt per „Fertig" zurück, auf Desktop bleibt die Sidebar sichtbar (kein Extra-Schritt, direkt „Erstellen"). „Abbrechen" stellt die vorherige Position wieder her und kehrt ins Ursprungsmodul zurück. Das Widget selbst kennt nur `onPickOnMap` und den injizierten Geocoder.

**Daten-Vertrag (geschriebene Felder):**

- `data.position` MUSS ein GeoJSON `Point` sein (`pointFromLatLng(lat, lng)` aus `lib/geo`), konform zu [place/v1](../schemas/vocab/place/v1/schema.json). Beide Eingabewege (a) und (b) schreiben in dasselbe Feld.
- `data.address` SOLLTE den menschlichen Adresstext halten (aus Geocoding-Auswahl oder Reverse-Geocoding).
- `data.locationName` KANN einen benannten Ort halten (z.B. „Markthalle 7").

**Auslieferung:** Adress-Geocoding (a) und Map-Pick (b) sind zusammen mit dem `MapLibreMapAdapter` (Vektorkarte, [map.md → Bereitgestellte Adapter](map.md)) implementiert. Ohne bereitgestellten Geocoder/Karten-Adapter funktioniert das Widget weiter als reiner Adress-Freitext (kein `data.position`, kein Pick-Button).

**Welche Typen das Widget anbieten:** Das Widget gehört in `contentTypes[].defaultWidgets` jedes Typs mit Ortsbezug — primär `place` (Position ist Pflichtfeld), sowie `event` mit Ort. Die Auswahl leitet sich aus Typ/Template ab; der `ContentComposer` rendert `location` nur, wenn der Typ es in `defaultWidgets` führt oder der Nutzer es manuell zuschaltet.

**Spec:** [map.md → Adapter-Vertrag](map.md), [01-app-composition.md → Overlay-Flächen](../01-app-composition.md), [place/v1](../schemas/vocab/place/v1/schema.json)

### `ItemDetailBody`

**Zweck:** Die Leseansicht eines Items im Detail-Panel. Eigene Anatomie, **keine** `ItemPreview`-Variante.

**Warum getrennt:** Eine Vorschau führt mit dem Autor — in einer Liste will man zuerst wissen, von wem etwas kommt. Wer ein Item geöffnet hat, will zuerst wissen, WAS es ist. Und die wiederverwendete Card ergab im schwebenden Panel eine Card in der Card: zwei Rahmen, zwei Radien, zwei Schatten um denselben Inhalt.

**Ordnung (normativ):** siehe [Detail-Anatomie](#detail-anatomie). Die Meta-Box steht auf eigener `--muted`-Fläche mit Rahmen und entfällt ohne Inhalt. Tags und Urheber teilen eine Zeile: Tags fließen links, „Erstellt von …" bleibt rechts und bricht nicht um. Der Titel steht in 20px/600.

*Bis zum Entwurf S0 (26.09.2026) standen Zusagen und Stimmen als Typ-Fußzeile über dem Divider. Sie stehen seit S2 im Slot `actions` direkt unter der Meta-Box (Prop `selfActions`, weil `actions` das ⋮-Menü trägt); der Prop `footer` trägt danach nur noch Reaktionen und Kommentieren (Slot `bar`). Die Karte (`ItemPreview`) zeigt die Stimmleiste im Übergang weiter als Fußzeile (06, Regel 17).*

**Vertrag:**

```ts
interface ItemDetailBodyProps {
  item: Item
  author?: User
  headerAdornment?: ReactNode  // Typ-/Scope-Badge
  actions?: ReactNode          // ⋮-Menü — wandert in die Panel-Kopfleiste
  meta?: ReactNode             // Slot `meta`: Inhalt der Meta-Box, TYP-getrieben
  selfActions?: ReactNode      // Slot `actions`: Selbstaktionen (C2) und Stimme (C4)
  reverse?: ReactNode          // Slot `reverse`: Rückwärts-Listen
  footer?: ReactNode           // Slot `bar`: Reaktionen und Kommentieren (Typ-Fußzeile nur noch für Typen ohne Feldliste)
  note?: ReactNode             // Slot `note`: Nur-lesen-Hinweis oder Fehler-Banner
  className?: string
}
```

**Regeln:**

1. Die Ansicht bringt **keinen eigenen Rahmen** mit — kein `border`, kein `rounded`, kein `shadow`, keine Card-Fläche. Das Panel IST die Karte.
2. Was in Meta-Box, Aktionszeile und Rückwärts-Listen steht, entscheidet der **Item-Typ**, nicht die Fläche. Die Inhalte leiten sich aus dem Feld- und Kantenregister ab (siehe [06-schema-composition.md → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister)), aus dem sich auch die Vorschau bedient.
3. Das ⋮-Menü gehört in die **Kopfleiste des Panels**, neben Modus- und Schließen-Knopf (`PanelHeaderActions`). Es im Inhalt zu zeichnen führt zur Kollision: Das Panel legt seine Knöpfe absolut in dieselbe Ecke, und wieviel Platz zu lassen wäre, hängt vom Modus ab. Ohne Panel darüber bleiben die Aktionen in der Kopfzeile der Ansicht.
4. Der Ladezustand (`ItemDetailSkeleton`) trägt **dieselbe** Anatomie — sonst springt das Layout, sobald das Item ankommt.

**Spec:** [01-app-composition.md → Content-Bereich](../01-app-composition.md), [06-schema-composition.md → Typ-Register](../06-schema-composition.md)

### `ItemDetailPanel`

**Zweck:** Container für Item-Detail-Anzeige mit Comments-Section. Library-agnostisches Inneres — Caller entscheidet, wie das Panel gerahmt wird (Modal, Drawer, Side-Panel, Route).

**Vertrag:**

```ts
interface ItemDetailPanelProps {
  itemId: string
  children: ReactNode          // Top-Slot: Read-View ODER Composer im Edit-Mode
  renderCommentReactions?: (commentId: string) => ReactNode
  className?: string
}
```

**Slot-Konvention:** `children` ist der freie Top-Slot. Module füllen ihn mit entweder einer Read-Ansicht (`ItemDetailBody`) oder einem inline `ContentComposer` im Edit-Mode. Der Comments-Bereich wird automatisch gerendert; das `renderCommentReactions`-Slot erlaubt es, ReactionBars an einzelne Comments zu hängen.

**Die Diskussion trägt keine Überschrift.** Blasen unter einem Item sind als Kommentare erkennbar; ohne Kommentare stünde dort eine Überschrift ohne Inhalt. Ein Leer-Platzhalter entfällt ebenfalls — die Eingabe genügt als Aufforderung. Sie sitzt als **Pille** in einer gepinnten Fußzeile außerhalb des Scroll-Bereichs.

**Spec:** [01-app-composition.md → Module Components](../01-app-composition.md)

### `ItemDetailActions`

**Zweck:** Item-Aktionen im **Card-Header** (rechtsbündig über `ItemPreview`s `actions`-Slot, nicht in der Panel-Chrome): ein **⋮-Menü** mit Bearbeiten / Teilen / Löschen. Berechtigungs-gegated über `useItemPermissions(item)` (siehe [03-capabilities.md → AuthorizationCapable](../03-capabilities.md)).

> **Trennung Inhalt vs. Fenster:** Item-Aktionen (⋮) gehören zum Item (Card-Header). Die Panel-Chrome (`AdaptivePanel`) trägt nur noch **Schließen** (+ mobiler Drag-Griff) — Pin und Maximieren wurden entfernt (kein realer Nutzen: Pin wirkt in der Sidebar nicht, Maximieren verdeckt den Kontext).

**Vertrag:**

```ts
interface ItemDetailActionsProps {
  item: Item
  onEdit?: () => void      // → Edit-Modus; "Bearbeiten" nur wenn editierbar UND verdrahtet
  onDeleted?: () => void   // nach erfolgtem Löschen (z.B. Panel schließen); Löschung erfolgt intern
  onShare?: () => void     // Link teilen/kopieren
  title?: string           // für den Lösch-Dialog
}
```

**Regeln:**

1. Sichtbarkeit folgt `useItemPermissions(item)`: nicht erlaubte Aktionen werden **ausgeblendet** (nicht disabled). Gibt es keine erlaubte Aktion, rendert die Komponente nichts.
2. Alle Aktionen liegen im **⋮-Menü**: **Bearbeiten** bei `canEdit` **und** vorhandenem `onEdit`; **Teilen** bei vorhandenem `onShare`; **Löschen** bei `canDelete`.
3. **Löschen** läuft hinter `DeleteConfirmDialog` und führt die Löschung selbst aus (`connector.deleteItem`, defensiv auf `isWritable` gegated); `onDeleted` nur nach echtem Delete.
4. Das Gating ist eine **UI-Affordance**, keine Sicherheitsgrenze — Durchsetzung backend-/protokollseitig.

Die reine Sichtbarkeitslogik ist als `visibleDetailActions(perms, hasOnEdit, hasOnShare)` ausgelagert (testbar).

### `DeleteConfirmDialog`

**Zweck:** Bestätigung vor dem Löschen („… wird gelöscht. Das kann nicht rückgängig gemacht werden.") mit Busy-State. `onConfirm` führt die Löschung aus, der Dialog schließt danach. Wird intern von `ItemDetailActions` benutzt, ist aber eigenständig einbindbar.

Konzept/UX: [concepts/item-edit-delete-2026-06.md](../../concepts/item-edit-delete-2026-06.md).

### `ItemDetailView`

**Zweck:** Geteilte Detail-Ansicht — Read **und** inline Edit-Composer im **selben** Panel (read↔edit-Umschaltung), plus das gegatete Aktionsmenü. Hält **seinen eigenen `useItemEditor`** und abonniert das Item live (`useItem(itemId)`), sodass der Aufrufer nur deklarative Config übergibt. Wird in der Reference App vom app-weiten **Detail-Host** (`DetailHostProvider`, oberhalb des Outlets) gerendert — nicht mehr pro Modul via `openDetail`; Module **registrieren** ihre Config (`useRegisterDetail`). So überlebt die Ansicht Modulwechsel ohne Remount, und Read/Edit gehören demselben Besitzer (siehe [../../concepts/detail-host-2026-06.md](../../concepts/detail-host-2026-06.md)).

**Vertrag:**

```ts
interface ItemDetailViewProps {
  itemId: string                                   // abonniert via useItem; Skeleton bis geladen. Upstream auf itemId keyen → anderes Item startet frisch in Read.
  renderRead: (item: Item, actions: ReactNode) => ReactNode  // Read-View; bekommt das live Item + das ⋮/„Bearbeiten" (ItemPreview actions-Slot)
  contentTypes: ContentTypeConfig[]                // volle Typ-Liste; die View sperrt intern auf den Item-Typ (kein Switcher in Phase 1)
  mapper: ItemEditorMapper                         // edit-fähig (nutzt existingItem)
  editInitialData: (item: Item) => Partial<WidgetData>  // Composer-Vorfüllung aus dem live Item
  composerProps?: Partial<ContentComposerProps>    // Modul-Extras (people/tags/geocode/map-pick/…)
  renderCommentReactions?: (commentId: string) => ReactNode
  onClose: () => void
  onShare?: () => void
}
```

**Regeln:**

1. Default ist **Read** (`ItemPreview` + Aktionsmenü via `renderRead`). „Bearbeiten" (gegated über `useItemPermissions`) schaltet auf **Edit** (`ContentComposer`, `editMode`, vorbefüllt). Speichern (`useItemEditor.submit` mit `existingItem`) → zurück auf Read; Abbrechen → zurück auf Read.
2. Die View **besitzt den Editor** — Mapper + Vorfüllung kommen als Config; der Aufrufer hat keine Editor-Abhängigkeit.
3. Sie **abonniert das Item live** (`useItem(itemId)`): `renderRead`, Aktionsmenü und Edit-Vorfüllung sehen immer das aktuelle Item → Read nach Save (und bei externen Updates) **nicht stale**. Bis das Item geladen ist, zeigt sie ein `ItemPreviewSkeleton`.
4. `contentTypes` ist die volle Typ-Liste des Moduls; die View narrowt intern auf den Item-Typ (`item.type`) → kein Type-Switcher. **Kein Fallback** auf die volle Liste: matcht kein Typ (Item-Typ nicht in der Modul-Config), wird **Bearbeiten ausgeblendet** (kein `onEdit`) statt einen falschen Composer zu öffnen.
5. Löschen läuft über das Aktionsmenü (`ItemDetailActions`) im Read-Modus.
6. Registrierung beim Detail-Host ist **modul-gescoped**: `useRegisterDetail(moduleId, config)`. Nur die Config des **aktiven** Moduls wird gerendert — ein hidden-mounted Modul (z.B. die keep-alive Karte) kann die aktive Ansicht nicht überschreiben.

### `CommentSection`

**Zweck:** Comments + Replies UI mit Reply-Threading. Wird intern von `ItemDetailPanel` benutzt, kann aber auch direkt eingebunden werden.

**Vertrag:**

```ts
interface CommentSectionProps {
  itemId: string
  placeholder?: string
  /** Slot für ReactionBar pro Comment. */
  renderReactions?: (itemId: string) => ReactNode
  /** Versteckt den eingebauten Input — Caller platziert `CommentInput` selbst. */
  hideInput?: boolean
  /**
   * Reply-State an den Caller herausgeben (für externes CommentInput).
   * `CommentQuote` ist aus `@real-life/toolkit` re-exportiert.
   */
  onReplyChange?: (
    replyTo: CommentQuote | null,
    submit: (text: string) => Promise<void>,
    cancel: () => void,
  ) => void
  className?: string
}
```

**Kompositions-Konvention:** Liste und Eingabe werden als Geschwister gerendert; der Caller entscheidet das Layout. `hideInput` + `onReplyChange` erlauben das CommentInput außerhalb des Scroll-Containers zu platzieren (z.B. als gepinnte Eingabeleiste in `ItemDetailPanel`).

**Spec:** [01-app-composition.md → Module Components](../01-app-composition.md)

### `ReactionBar`

**Zweck:** Emoji-Reactions auf ein Item. Aggregiert Counts pro Emoji, zeigt was der aktuelle User reagiert hat.

**Vertrag:**

```ts
interface ReactionBarProps {
  itemId: string
  /** Anzahl distincter Emojis vor dem Einklappen. Default: 6. */
  maxVisible?: number
  /** Klick auf Count (Desktop) oder Long-Press (Mobile) öffnet Details. */
  onOpenDetails?: (emoji?: string) => void
  className?: string
}
```

**Aktionen:** Klick auf Emoji togglet die Reaction des aktuellen Users. Neue Emojis werden über einen Picker hinzugefügt. Über `onOpenDetails` kann der Caller eine Liste der Reagierenden öffnen.

**Spec:** [01-app-composition.md → Module Components](../01-app-composition.md)

### `ItemPreview`

**Zweck:** Generische Item-Card für Listenansichten. Konsolidiert das Layout, das vorher in jedem Modul dupliziert war (Feed-Card, inline `KanbanCard`, Calendar `EventCard`).

**Vertrag:**

```ts
type ItemPreviewDensity = "comfortable" | "compact" | "row" | "dense"

interface ItemPreviewProps {
  item: Item
  /**
   * Resolved item author. Wenn `undefined`, fällt die Card auf
   * `item.createdBy` als Display-Name zurück. Wenn `null`, wird der
   * gesamte Author-Block unterdrückt.
   */
  author?: User | null
  onClick?: () => void
  /** Slot neben dem Author-Namen (z.B. Type-Badge, Status-Chip). */
  headerAdornment?: ReactNode
  /** Rechtsbündige Aktionen am Ende der Header-Zeile (z.B. das Detail-⋮ via
   *  `ItemDetailActions`). Nur Detail-Ansichten füllen ihn; Listen-Cards lassen
   *  ihn leer, damit Cards aktionsfrei bleiben. */
  actions?: ReactNode
  /** Slot zwischen Title und Description (z.B. Date-Hint, Distance). */
  metaAdornment?: ReactNode
  /** Slot unter den Tag-Chips (z.B. Assignees, Comment-Count, ReactionBar). */
  footerAdornment?: ReactNode
  /** Layout-Density (siehe unten): `comfortable` | `compact` | `row` | `dense`. Default `comfortable`. */
  density?: ItemPreviewDensity
  /** Hebt eine Karten-Linse als aktuell selektiert hervor. */
  active?: boolean
  /** Erledigt: „✓ " vor dem Title (für Screenreader „Erledigt: "), Karte auf Opazität 0.55 gedimmt. */
  completed?: boolean
  /** Optionaler `#rrggbb`-Override für den Active-Glow; Default ist neutral. */
  activeGlowColor?: string
  className?: string
}
```

**Density:**

- `comfortable` (Default) — Feed-Card-Form: Avatar 10×10, font-base Title, p-4 Spacing, Description wird angezeigt, Footer mit Border-Top.
- `compact` — Kanban-/Liste-Form: Avatar 6×6, font-sm Title, p-3 Spacing, **Description wird ausgeblendet**, Footer ohne Border. Tauglich für dichte Board-Spalten, wo mehrere Cards zugleich sichtbar bleiben sollen.
- `row` — **eine Zeile** für die Rückwärts-Listen im Detail ([Detail-Anatomie](#detail-anatomie), Regel 8): `headerAdornment` (Typ-Badge), der Title gekürzt auf eine Zeile (ohne Title der Name oder der Anfang des Inhalts, sonst „Ohne Titel"), rechts `footerAdornment` (Markierung, kleiner Zusatz). Sie lässt Description, `metaAdornment`, Tags, Author-Zeile und Kommentar-Hinweis weg. `active` markiert die angezeigte Zeile (`aria-current`) ohne Schatten.
- `dense` — **Matrix-Kachel** für Raster und Bretter mit 12+ Spalten. Maße aus dem Design (*RLS System Design → Dragon Dreaming.dc.html*, Variante 1a): **112 px breit, mindestens 61 px hoch** (75 px mit drei Titelzeilen); die Kachel setzt beides selbst, ein Raster darf die Breite per `className` überschreiben, Innenabstand 7 px, Radius 6 px (`rounded-md`), Rahmen über das `border`-Token. Die Kachel zeigt **nur**:
  - den **Title**: 10.5 px, Gewicht 600, Zeilenhöhe 1.3, auf **drei Zeilen** begrenzt (Auslassung danach), mit `overflow-wrap: anywhere`, `hyphens: auto` und `lang="de"`, damit deutsche Komposita in 112 px brechen dürfen. Ohne Title steht wie bei `row` der Name oder der Anfang des Inhalts, sonst „Ohne Titel",
  - die `footerAdornment`-Zeile, ohne Border-Top, im Regelfall genau ein `ItemAssignees size="xs"`.

  Sie lässt weg, was auch `row` weglässt (Description, `metaAdornment`, Tags, Author-Zeile, Kommentar-Hinweis). `active`/`activeColor`, `onClick` und die Keyboard-Aktivierung sind identisch mit `compact`. Von den Typ-Slots rendert sie `headerAdornment` und `footerAdornment`; Caller legen in `dense` keinen `ItemTypeBadge` in den `headerAdornment`-Slot, eine Matrix-Zelle trägt ihn nicht.

  **Tags:** `dense` zeigt **keine** Tags. Ein Farbpunkt ohne Namen wäre eine zweite Tag-Darstellung neben `TagChip` und verletzt die Regel aus [07-tags.md](../07-tags.md), dass das Default-Display über alle Flächen identisch ist.

**Erledigt:** `completed` setzt ein „✓ " vor den Title (plus `sr-only`-Text „Erledigt: ") und dimmt die Karte auf Opazität 0.55, in jeder Dichte. Was „erledigt" heißt, entscheidet die Fläche (die Rückwärts-Listen: Status der Rolle `done`, [06, Regel 18](../06-schema-composition.md#feld--und-kantenregister)).

**Default-Body:** Author-Row (Avatar + Name + `RelativeTime`), Title, Description (`data.content ?? data.description`, max 4 Zeilen), Tags (chips, top-level `item.tags`, Color via `getTagColor`). Tags und Urheber teilen eine Zeile, die nie umbricht: Es stehen so viele Tags, wie neben den Urheber passen, der Rest als „+N"; der Urheber behält seinen Platz rechts. Das gilt in beiden Dichten.

**Slot-Konvention:** Module liefern modul-spezifische Cues über die drei Slots. Jeder Slot rendert **unabhängig vom Content** der Card — eine Card ohne Author kann trotzdem ein `headerAdornment` haben, eine Card ohne Title kann trotzdem ein `metaAdornment` zeigen. Slots und Datenfelder sind orthogonal. Adornments, die eigene Buttons enthalten, müssen `event.stopPropagation()` aufrufen, damit ein Button-Click nicht den Card-Click mit auslöst.

**Keyboard-Aktivierung:** Wenn `onClick` gesetzt ist, exponiert die Card `role="button"`, `tabIndex={0}` und reagiert auf Enter und Space wie ein Button — Card-Click ist damit auch ohne Maus erreichbar.

**Kartenflächen-MUSS:** Jede Kartenfläche in List, Grid, Board, Feed, Detail
oder einer künftigen Linse MUSS `ItemPreview` plus dessen Adornments
komponieren; eigene parallele Card-Markups sind nicht zulässig. Bei
Shell-Selektion setzt eine Karten-Linse `active` auf dem korrespondierenden
Preview. `active` zeichnet den Schein intern; ein Caller darf per `activeGlowColor`
z. B. seine Gruppenfarbe weiterreichen. (`getActivePanelGlow` war bis zum
19.09.2026 öffentlich und ist seither ein Internum, real-life-stack#400.)

**Daten-Pfad:** `useItemTags(item)` intern. Author-Resolution liegt beim Caller (`useItemAuthor` empfohlen).

**Sebastian-Polish-Backlog:** Visuelle Spezifikation (Spacings, Card-Höhen, Hover-Transitions, Avatar-Sizing pro Density) — heute orientiert am früheren Feed-Card-Layout.

**Code:** `packages/toolkit/src/components/preview/item-preview.tsx`. Stories: `item-preview.stories.tsx`.

### Adornment-Komponenten

Kleine, zusammensetzbare Bausteine, die Module in die Adornment-Slots von `ItemPreview` legen. Sie sind shared, weil sie modul-übergreifend dieselben Konzepte (Type, Time/Place, Comments) ausdrücken — Feed-Cards, Kanban-Cards, Calendar-Cards greifen alle darauf zu.

#### `ItemTypeBadge`

**Zweck:** Chip mit Icon + Label für den Item-Typ. Belongs in `headerAdornment`.

```ts
interface ItemTypeBadgeProps {
  type: string
  /** Override or extend the type → presentation registry. */
  config?: Record<string, ItemTypeBadgeConfig>
  /** Show a neutral raw-type badge when no registry entry exists. */
  fallback?: boolean
  className?: string
}
interface ItemTypeBadgeConfig {
  icon: ComponentType<{ className?: string }>
  label: string
  className: string
}
```

Default-Registry: `event`, `task`, `place`, `person`. Unbekannte oder Standard-Typen (`post`, `comment`, `reaction`) rendern `null` — Modul-spezifische Typen können per `config`-Prop ergänzt werden.

Mit `fallback` bleibt ein unbekannter Typ als neutraler Rohwert sichtbar. Das
ist für generische Linsen gedacht, die keinen Domain-Typ stillschweigend
ausblenden dürfen.

#### `ItemMetaRow`

**Zweck:** Inline-Zeile mit Date-Hint und Address. Belongs in `metaAdornment`. Rendert `null`, wenn weder `data.start` noch `data.address` vorhanden sind.

```ts
interface ItemMetaRowProps {
  item: Item
  className?: string
}
```

#### Type-spezifische Preview-Metadaten

**Zweck:** Kleine ergänzende Meta-Adornments für Felder, die nicht in den
generischen ItemPreview-Body gehören. Sie liegen im `preview/`-Ordner, damit
List-, Grid-, Feed- und Board-Caller keine eigene Kartenfläche bauen.

- `ItemProfileMeta` — Avatar + `displayName` für `person`.
- `ItemProjectMeta` — `website` und `repo` für `project`.
- `ItemResourceMeta` — `kind` und `availability` für `resource`.
- Events verwenden den bestehenden `ItemMetaRow` für `start`/`end`.

`getItemPreviewAdornments(item)` ordnet diese Bausteine den
`ItemPreview`-Slots zu und verwendet für sonstige Typen `ItemTypeBadge` mit
`fallback`. Read-only-Linsen komponieren ausschließlich diese Slots und
`ItemPreview`; sie führen kein eigenes Card-Markup.

Plus eine exportierte Format-Funktion `formatEventRange(i18n, start, end?)` für Caller, die den String außerhalb der Inline-Zeile brauchen (z.B. Tooltip, Tabelle). `i18n` ist das Bündel aus `useI18n()` (in Komponenten, mit Abo auf den Sprachwechsel) oder aus `getI18n()` (außerhalb von React). Die frühere Form `formatEventRange(start, end?)` bleibt als veraltete Überladung erhalten und formatiert über die gerade aktive Sprache.

#### `ItemTimeRange`

**Zweck:** Schwesterkomponente zu `ItemMetaRow` für Kontexte, in denen das Datum bereits durch die Umgebung gegeben ist (Calendar-Liste mit Tages-Gruppen, „today's events"-Panel). Zeigt nur Uhrzeit + Address.

```ts
interface ItemTimeRangeProps {
  item: Item
  /**
   * Pre-resolved location label. When omitted, falls back to
   * `data.locationName ?? data.address`.
   */
  locationLabel?: string
  className?: string
}
```

All-day-Events rendern als „Ganztägig" (in der aktiven Sprache, Schlüssel `time.allDay`). Same-day-Range als „18:00 – 20:00", ohne `end` als „18:00". Mehrtägige Range fügt das End-Datum hinzu, damit User nicht denken das Event ende noch am gleichen Tag.

Location-Auflösung: `locationLabel`-Prop hat Vorrang; sonst `data.locationName ?? data.address` (analog zu Calendar's eigener Location-Normalisierung). Dadurch wird ein Event mit nur `locationName` ebenfalls korrekt angezeigt.

Plus exportierte Format-Funktion `formatTimeRange(i18n, start, end?)`, mit denselben Regeln für `i18n` und derselben veralteten Überladung `formatTimeRange(start, end?)` wie `formatEventRange`.

#### `ItemCommentCount`

**Zweck:** Comment-Count-Badge für `footerAdornment`. Rendert `null` bei `count <= 0`.

```ts
interface ItemCommentCountProps {
  count: number
  onClick?: () => void
  className?: string
}
```

Zwei Render-Modi je nach `onClick`:

- **Mit `onClick`**: `<button>` (fokussierbar, Hover-Stil), ruft `event.stopPropagation()` damit der Card-Click nicht doppelt feuert.
- **Ohne `onClick`**: `<span>` (nicht-interaktiv, nicht im Tab-Order). Ein rein anzeigender Count taucht so nicht als Focus-Stop ohne Aktion auf.

#### `ItemAssignees`

**Zweck:** Overlapping Avatar-Stack mit kompakter Namens-Zusammenfassung. Belongs in `footerAdornment`. Rendert `null` bei leerer User-Liste.

```ts
type ItemAssigneeUser = User & { qualifier?: string; variant?: "solid" | "outline" }

interface ItemAssigneesProps {
  users: readonly ItemAssigneeUser[]
  /** `sm` (Default) mit Namens-Summary, `xs` nur Avatare (für `dense`). */
  size?: "sm" | "xs"
  className?: string
}
```

Caller löst die User-Objekte auf (typischerweise aus `assignedTo`-Relations + Member-Liste) und übergibt sie als resolved Array. Komponente ist rein präsentational. Namens-Summary: einzelner Name, „A, B" für zwei, „A + N weitere" ab drei; voller Kommaseparierter Liste im Hover-Tooltip. `qualifier` ist der Anzeigetext des Qualifiers an der Kante und steht klein hinter dem Namen („Timo lernt", wie [Detail-Anatomie](#detail-anatomie), Regel 5); ein fehlender Qualifier (`qualifier.default`) steht nicht da. Die Kanban-Karte zeigt so `assignedTo.role`.

**Größe:** `size="sm"` (Default): Avatare 5×5 plus Namens-Summary. `size="xs"`: Avatare 14 px, Initialen 6.5 px fett, Überlappung 4 px, heller Trennring 1.5 px, **ohne** Namens-Summary; die Variante für `ItemPreview density="dense"`, wo keine Textzeile mehr in die Kachel passt. Namen und Qualifier bleiben über den Tooltip erreichbar; für Screenreader steht die vollständige Liste als Text im Baum, und jede Profilbeschriftung nennt den Qualifier („Profil von Lena Berg (lernt) öffnen"). Keine zweite Komponente, damit beide Stapel nicht auseinanderlaufen.

**Anzahl:** höchstens **fünf** Avatare; ab dem sechsten stehen die übrigen Namen nur noch im Tooltip.

**Farbe und Form:** Initialen tragen die **Personenfarbe** `getUserColor(userId)`, dieselbe deterministische Palette wie Tags und Spaces, stabil über Geräte und Sitzungen. Jeder Eintrag wählt optional eine von zwei Formen:

- `solid` (Default): ohne Foto gefüllt in der Personenfarbe, Schrift in der lesbaren Gegenfarbe (`getReadableTextColor`); mit Foto das Foto in voller Deckkraft, ohne Ring.
- `outline`: ein Ring in der Personenfarbe mit einem Innenabstand im Hintergrund-Token; darin ohne Foto die Initialen in der Personenfarbe, mit Foto das Foto kleiner und mit verringerter Deckkraft.

Die Unterscheidung MUSS mit und ohne geladenes Profilfoto, im hellen und dunklen Schema und in `size="xs"` erkennbar bleiben, und sie DARF sich nicht allein auf Farbe stützen: Ring, Innenabstand und die Helligkeit des Fotos tragen sie. Die Formen tragen **keine Bedeutung**. Welche Aussage sie ausdrücken („kann ich" / „will lernen" im Karabirrdt, Zusage / Vielleicht anderswo), entscheidet die App; der Qualifier bleibt der Text dazu.

**Code:** `packages/toolkit/src/components/preview/item-{type-badge,meta-row,comment-count,assignees}.tsx`.

### `TagChip`

**Zweck:** Einheitliche Tag-Darstellung über *alle* Flächen — Post-/Preview-Cards, Filter-Picker und aktive Filter-Chips. Eine Quelle, damit ein Tag überall gleich aussieht.

```ts
interface TagChipProps {
  tag: string
  size?: "sm" | "md"
  selected?: boolean      // Toggle-Modus (Filter-Picker) / aktiv im Klick-Modus
  onToggle?: () => void
  onClick?: () => void    // Klick-Modus (Tag auf Card/Detail)
  onRemove?: () => void   // entfernbarer Modus (aktiver Filter-Chip)
  className?: string
}
```

**Prinzip:** Tags tragen **eine deterministische Farb-Palette** (`getTagColor`), über alle Flächen identisch (Posts, Filter, Kanban). Vier Modi: statisch (Post), Toggle (Filter-Picker — selektiert volle Deckkraft, sonst gedimmt; die Tag-Farbe bleibt immer sichtbar), Klick (Tag auf Card/Detail) und entfernbar (aktiver Filter-Chip mit ✕). Die Palette gehört langfristig in die Design-Tokens; bis dahin liefert sie `getTagColor` (Spec [07-tags.md](../07-tags.md)).

**Klick-Modus (Tag als Filter):** Ein Tag auf einer Card oder im Detail führt zu allem, was so verschlagwortet ist — der Klick setzt den geteilten `tags`-Filter (siehe „Modul-übergreifender Filter-State"). Regeln:

1. Ein noch nicht gesetztes Tag wird **hinzugefügt**, ein bereits aktives **entfernt**. Tags sind UND-verknüpft; der zweite Klick verengt, er ersetzt nicht.
2. Der Chip ist im Klick-Modus ein `<button>` mit `aria-pressed`, damit vorgelesen wird, ob er gerade filtert.
3. Der Klick gilt dem Tag, **nicht der Card darunter**: Der Chip stoppt die Propagation, sonst filtert er und öffnet zugleich das Item.
4. Ob Tags klickbar sind, entscheidet die App durch Montage des `TagNavigationProvider` (unter dem `FilterProvider`). Ohne ihn bleiben `ItemPreview`/`ItemDetailBody` bei statischen Chips — ein Knopf, der nichts tut, wäre schlechter als schlichter Text.

**Code:** `packages/toolkit/src/components/tag/tag-chip.tsx`, `tag-filter-chip.tsx` (Chip + `useTagLink`), `components/navigation/tag-navigation.tsx`.

### `FilterBar`

**Zweck:** Shared Filter-UI für jedes *Space Module*. Hält Tags und Item-Type als Common-Filter, exponiert zwei Slots (`chipsExtra`, `drawerExtra`) für Modul-spezifische Filter, plus exportierte Building-Blocks (`FilterChip`, `FilterMultiSelect`, `FilterToggle`, `FilterSection`) für eine einheitliche Optik. Tag-Filter (Picker + aktive Chips) nutzen `TagChip` — farbig, dieselbe Palette wie auf Posts; Typen nutzen die generischen Building-Blocks.

**Layout-Pattern (Anton + Sebastian-Konsens 11.06.2026, revidiert 12.06.2026):** Eine **Controls-Zeile** (Filter-Button + Suche in `leadingActions` + `trailingActions`) bricht nie um; die **aktiven Filter-Chips** liegen in einer eigenen Zeile darunter und wrappen frei. Ein „Filter"-Button öffnet die Auswahl im geteilten Content-Panel (`ModulePanel`, Sidebar auf Desktop / Drawer auf Mobile). Aktive Filter bleiben immer sichtbar; das Panel ist nur für die Auswahl — bewusst dasselbe Panel wie Detail und Composer.

```ts
interface FilterBarProps {
  value: FilterBarValue
  onChange: (next: FilterBarValue) => void
  availableTags?: readonly string[]
  availableTypes?: readonly FilterTypeOption[]
  chipsExtra?: ReactNode      // Modul-spezifische Active-Chips
  drawerExtra?: ReactNode     // Modul-spezifische Drawer-Sections
  leadingActions?: ReactNode  // direkt neben dem Filter-Button — hier gehört die Suche hin
  trailingActions?: ReactNode // rechtsbündig, z.B. Spalten-/View-Toggle
  className?: string
}

interface FilterBarValue {
  tags: string[]      // AND
  types: string[]     // OR
}

interface FilterTypeOption {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
}
```

**Controlled component:** der Filter-Wert lebt im Caller; das KANN View-State sein oder ein app-weiter, modulübergreifend geteilter Store (siehe „Modul-übergreifender Filter-State" unten). View-spezifische Persistierung (URL params, localStorage) bleibt Caller-Job.

**Modul-spezifische Filter:** in den Slots `chipsExtra` (Active-Chip-Row) und `drawerExtra` (Auswahl-Drawer) zusammensetzen aus den exportierten Building-Blocks (`FilterSection` + `FilterMultiSelect` / `FilterToggle`). Damit sehen Modul-Extras automatisch konsistent mit den Common-Filtern aus.

**Suche:** gehört in `leadingActions`, direkt neben den Filter-Button (Sebastian-Konsens 12.06.2026: Filter und Suche gehören visuell zusammen). `trailingActions` bleibt für rechtsbündige Modul-Aktionen (Spalten-Editor, View-Mode-Toggle).

**Hook:** `useFilterableItems(items, value)` wendet die `FilterBarValue` clientseitig an. `applyFilterBarValue(items, value)` ist als pure Funktion exportiert (Tests, non-React-Caller). Server-seitige Optimierung (Lift `tags` in `ItemFilter.hasTag`) ist bewusst nicht hier — `data-interface` Concern, siehe [02-data-interface.md](../02-data-interface.md).

**Modul-übergreifender Filter-State (geteilter Caller):** Die `FilterBar` bleibt ein Controlled Component; *wo* der `value` gehalten wird, bestimmt der Caller. Der Caller KANN ein **app-weiter** Store sein statt View-State. Dann teilen sich Feed, Kanban, Calendar und Map **einen** `FilterBarValue`, und ein gesetzter Tag-/Typ-Filter wirkt nach dem Modul-Wechsel unverändert weiter (ein in Feed gesetzter Tag filtert ohne Zutun auch Kanban, Calendar und Map).

Regeln:

1. Der geteilte State SOLLTE **neben dem persistenten Content-Panel** leben (App-Shell-Ebene, [01-app-composition.md → Overlay-Flächen Ebene 1](../01-app-composition.md)). Er ist app-weit und nicht modulgebunden, analog dazu, dass das Content-Panel beim Modul-Wechsel offen bleibt.
2. Geteilt wird der gemeinsame `FilterBarValue` (`tags`, `types`). Modul-spezifische Extras (`chipsExtra`/`drawerExtra`, z.B. Kanban „Nur meine" oder die Personen der Resonanz-Auswertung) bleiben beim jeweiligen Modul und werden NICHT app-weit geteilt: Sie bedeuten je Modul etwas anderes. Sie leben aber so lange wie der geteilte Zustand, im selben Besitzer, je Modul in einem eigenen Bereich (`useModuleFilter`). Ein Modulwechsel hin und zurück behält sie, wie er Tags und Suche behält; ein anderes Modul liest sie nie. Ansichtszustand, der kein Filter ist (Kartenausschnitt, gruppierte Ansicht), gehört nicht dazu.
3. Die `FilterBar` selbst ist die **geteilte Fläche**: jedes Modul rendert dieselbe `FilterBar` gegen denselben `value`/`onChange`. Tag-Filter nutzen durchgängig `TagChip` mit `getTagColor`, sodass ein Tag in Picker, aktiven Chips und auf den Cards modulübergreifend identisch eingefärbt ist (siehe [`TagChip`](#tagchip), [07-tags.md](../07-tags.md)).
4. Typen sind modulabhängig: ein in Feed gesetzter `types`-Filter KANN in einem Modul ohne diesen Typ zu einer leeren Auswahl führen. Das ist erwartet; die `availableTypes` jedes Moduls bestimmen, welche Typ-Chips dort sichtbar/abwählbar sind. Der geteilte `tags`-Filter ist davon unberührt.
5. View-spezifische Persistierung (URL params, localStorage) bleibt Caller-Job; ein app-weiter Store ist eine Caller-Wahl, kein Toolkit-Zwang. `emptyFilterBarValue` ist der Initialwert.
6. Der Zustand hat **genau einen Besitzer**. Eine Fläche, die auch außerhalb der App läuft (Story, Test, eingebettete Ansicht), bringt ihn mit `FilterScope` an ihrer **Wurzel** mit — um Steuerleiste *und* Inhalt herum; unter einer App-Shell reicht der Scope den vorhandenen Zustand durch. Ein Rückfall auf lokalen Zustand pro Aufrufer wäre ein zweiter Besitzer: Die Leiste schriebe in ihren, der Inhalt läse einen anderen.
7. Der **Suchtext** liegt mit im geteilten Zustand: Das Suchfeld sitzt im Kopf der Modulfläche (siehe [01-app-composition.md → Die Modulfläche ist eine Spalte](../01-app-composition.md)) und gehört damit derselben Fläche wie Filter-Knopf und Chips — nicht mehr dem einzelnen Modul.

**Code:** `packages/toolkit/src/components/filter/`. Stories: `filter-bar.stories.tsx` zeigt Default, Pre-Selected, Kanban-Toggle-Extras, Calendar-Location-Extras, Empty-State.

### `FilterPill` + Filter-Card

**Zweck:** Die Filter-Fläche eines *Space Module*. Eine Pille unten links der Modulfläche (48px, Trichter + „Filter", `bg-card`, 1px Border, `shadow-lg`, radius voll), die bei einem Klick an derselben Stelle zur **Filter-Card** wird (232px, radius `xl`, `shadow-xl`). Geschlossen wird über das kleine ✕ neben der ersten Sektion, mit Escape oder einem Klick daneben; es gibt keinen Header und keinen Bestätigen-Knopf.

Regeln:

1. Die Pille **öffnet nur**. Die aktiven Filter stehen als entfernbare Chips im **Kopf** der Modulfläche (`ModuleFilterChips`, Zeile unter Suche und Modul-Aktionen, `empty:hidden`); in der offenen Card sind dieselben Filter zusätzlich als gewählte Chips zu sehen. Eine zweite Chip-Fläche neben der Pille wäre dieselbe Auskunft an zwei Orten.
2. **Typ-Chips sind alle aktiv, solange `types` leer ist.** Der leere Wert heißt „kein Filter", also wird alles gezeigt — die Card malt das ehrlich. Ein Chip abzuwählen setzt `types` auf den **Rest**; den letzten verbliebenen abzuwählen fällt auf leer (= wieder alles) zurück, weil eine Auswahl, die nichts zeigt, eine Sackgasse wäre. Der Vertrag von `FilterBarValue` bleibt unberührt: leer ist und bleibt leer.
3. Die Farbe eines Typ-Chips ist die seines **Typ-Abzeichens** und kommt vom Aufrufer (`FilterTypeOption.badgeClassName`); die Filter-Schicht liest das Typ-Register nicht.
4. **Der Inhalt erscheint erst, wenn die Form steht.** Form und Inhalt DÜRFEN NICHT gleichzeitig animieren — der Kartentext im schmalen Pillen-Umriss liest sich als Fehler. Entweder die Form wandert und der Inhalt blendet danach ein, oder die Form springt und nur der Inhalt blendet kurz über (so umgesetzt); nie länger als 300ms, bei `prefers-reduced-motion` sofort.
5. Module mit `panelFit: "overlay"` (Karte, Graph) reichen ihren Beitrag genauso über `ModuleToolbar` ein wie alle anderen; die **Fläche** hostet ihn dort schwebend (Suche und Chips oben links, Pille unten links). Sie bauen sich weder Suche noch Pille selbst — siehe [01-app-composition.md → Die Modulfläche ist eine Spalte, Regel 5](../01-app-composition.md).

**Code:** `packages/toolkit/src/components/filter/filter-pill.tsx`, Sektionen in `filter-card.tsx` (geteilt mit dem Popover der `FilterBar`).

### `CreateFab`

Einheitlicher Floating-Action-Button für „neues Item erstellen", fixed unten-rechts in der Modul-Surface. Jedes Space-Modul (Feed, Kanban, Calendar, Map) hat damit denselben Create-Entry-Point an derselben Bildschirm-Position.

**Anatomie:** 48×48 (mobil 52), `bg-card` mit 1px Border und `shadow-lg`, „+" 22px — dieselbe Fläche wie die Filter-Pille gegenüber, mit der er eine Zeile bildet. **Kein Hover-Lift** (Design Guide: Buttons tragen keinen Schatten-Sprung).

```ts
interface CreateFabProps {
  onClick: () => void
  label?: string                              // aria-label, Default „Erstellen"
  hideWhileVisible?: RefObject<Element | null> // solange sichtbar, kein FAB
  className?: string
}
```

**Positionierung:** `fixed` unten-rechts, mit Safe-Area- und BottomNav-Abstand auf Mobile. Der rechte Rand **folgt der Panelkante** (`--adaptive-panel-edge-right`): öffnet ein rechtes Panel, wandert der FAB daneben statt darunter — und hält dabei denselben Abstand wie sonst zum Fensterrand. Nicht die Inhalts-Variable (`--adaptive-panel-margin-right`) nehmen: die enthält die Luft neben einem schwebenden Panel bereits, der eigene Rand käme doppelt dazu.

**Beziehung zu `useItemEditor`:** Der FAB ist nur das visuelle Trigger-Element. Der Caller wired `onClick` so, dass der Composer in die passende **Hülle** öffnet (siehe `ContentComposer` → Präsentation je Modul): Calendar/Map/Kanban über das Content-Panel (`useModulePanel().open({ kind: "composer", … })`), Feed über den `FeedComposerTrigger`. `onSubmit` ruft `await editor.submit(data)` und schließt auf Erfolg — das verhindert Mehrfach-Submits durch wiederholtes Klicken.

**Feed-Sonderfall:** Feed nutzt den `FeedComposerTrigger` (input-pill, morpht in Fullscreen-Composer) als primären Create-Entry — bewusst eine eigene Composer-Hülle. Die Pille scrollt aber mit: Sobald sie aus dem Bild ist, MUSS derselbe `CreateFab` wie in allen anderen Modulen einspringen, sonst hat der Feed weit unten gar keinen Create-Entry. Dafür bekommt er `hideWhileVisible` mit einer Ref auf die Pille — er erscheint genau dann, wenn sie den Scrollbereich der Modulfläche verlassen hat (`IntersectionObserver` mit `[data-module-scroll]` als Root, nicht dem Fenster). Ohne die Prop verhält sich der FAB wie überall: dauerhaft sichtbar.

**Code:** `packages/toolkit/src/components/create-fab/`.

### `ModulePanel` + `ModuleSettingsPlaceholder`

`ModulePanelProvider` stellt **eine app-weite** `AdaptivePanel`-Instanz bereit (Sidebar auf Desktop, Drawer auf Mobile). Alle Overlay-Inhalte (Filter, Detail, Composer, Einstellungen, Debug) öffnen über `useModulePanel().open({ kind, content, onClose? })` in dieselbe Instanz statt sich zu stapeln (Sebastian-Konsens 12.06.2026: ein Panel, Content-Swap statt Stapeln). Content swappt in place — Filter offen + Item-Klick ersetzt den Filter durch das Detail. Das Panel **bleibt beim Modul-Wechsel offen** (persistente Fläche, nicht modulgebunden). `onClose` feuert nur beim echten Schließen (X / Backdrop / Drawer-Drag), nicht beim Content-Swap. Dies ist **Ebene 1** des Overlay-Modells, siehe [01-app-composition.md → Overlay-Flächen](../01-app-composition.md).

```ts
type ModulePanelKind = "filter" | "detail" | "composer" | "settings" | "debug" | "custom"
interface ModulePanelEntry { kind: ModulePanelKind; content: ReactNode; onClose?: () => void }
```

**Mobile-Höhen:** Drawer und Modal bemessen ihre Höhe in dynamischen Viewport-Einheiten (`dvh`), nicht `vh`, damit die ein-/ausfahrende Browser-Toolbar die Fläche nicht abschneidet.

**Moduleinstellungen:** jedes Modul bekommt einen Zahnrad-Button (`Settings2`) in `trailingActions`, der `kind: "settings"` ins Panel öffnet. `ModuleSettingsPlaceholder` ist der geteilte Platzhalter, bis echte Settings pro Modul existieren — er reserviert Entry-Point und Fläche (`moduleLabel` + optionale `plannedItems`-Liste). Kanban nutzt ihn heute statt des früheren funktionslosen „Spalten bearbeiten"-Buttons; „Spalten bearbeiten" wird später ein Settings-Eintrag.

**Code:** `packages/toolkit/src/components/module-panel/`.

### `GroupDialog`: App-Abschnitte

Der Space-Dialog ist der eine Ort für alles, was zu einem Space gehört. Eine App trägt eigene Abschnitte dort ein, statt einen zweiten Dialog für denselben Space zu bauen ([01 → Overlay-Flächen](../01-app-composition.md), Regel 5).

```ts
interface AppSpaceSection {
  id: string                                  // eindeutig; members/invite/theme/modules sind vergeben
  label: string
  icon: LucideIcon
  visible?: (who: { isAdmin: boolean }) => boolean
  render: (ctx: AppSpaceSectionContext) => ReactNode
}
interface AppSpaceSectionContext {
  group: Group                                // wie der Aufrufer sie liefert (mode.group)
  canEdit: boolean                            // eigener Nutzer ist Admin
  patchData: (patch: Record<string, unknown>) => Promise<void>
}
// GroupDialogProps: appSections?, appSectionsTitle?, initialSection?
// AppFrameProps:    spaceSections?, spaceSectionsTitle?
```

Regeln:

1. App-Abschnitte stehen nach den eigenen Bereichen. Eine `id`, die schon vergeben ist, MUSS verworfen und gemeldet werden.
2. `patchData` ist der einzige Schreibweg eines App-Abschnitts. Er schreibt `Group.data` **flach** als Merge-Patch über `updateGroup` ([04 → Space-Metadaten](../04-items-relations-groups-spaces.md#space-metadaten), Regeln 2 und 3; `null` löscht). Ein verschachtelter Namensraum (`Group.data.<app>.<feld>`) wäre bei Tiefe 1 ein einziger Wert, und zwei Abschnitte überschrieben sich gegenseitig (rls#234).
3. Der Dialog hält keinen eigenen Schreibstand. `group` ist die Group, wie der Aufrufer sie liefert; `patchData` gibt die Zusage von `onUpdateGroup` unverändert zurück. Der Aufrufer MUSS die Group nach dem Speichern neu liefern (`AppFrame` reicht sie live aus dem Connector durch, so kommen auch Änderungen anderer Geräte an). Die eigenen Felder des Dialogs (Name, Bild, Module, Aussehen) folgen einer neu gelieferten Group, solange man sie im Dialog nicht selbst geändert hat. Scheitert das Speichern, gilt je Schreibweg:
   - **Modulliste, Farbwahl, Rundung, Flächen** (die Wahl in den Bereichen „Module“ und „Aussehen“): Die Anzeige fällt auf die **gelieferte** Group zurück, nie auf den zuletzt im Dialog gespeicherten Wert. Ein Aufrufer, der eine eingefrorene Group übergibt, sieht nach „A gespeichert, B gescheitert“ wieder den Stand vom Öffnen, bis er neu liefert.
   - **Name:** kein Rückfall. Ein ungespeicherter Name bleibt mit Fehlermeldung im Feld stehen und lässt sich erneut speichern.
   - **Bild hochladen oder entfernen:** kein Rückfall. Der lokal gesetzte Bildzustand bleibt stehen, auch ein entferntes Bild, und ebenso die dabei mitgeänderte Primärfarbe.

   Ändert sich das Bild von außen, darf eine laufende Farbermittlung aus dem alten Bild nichts mehr schreiben. Ein gescheiterter App-Patch lässt den Stand stehen; die Meldung steht je Schlüssel im Abschnitt, bis ein späterer Patch diesen Schlüssel speichert.
4. Die App wählt eindeutige Feldnamen. Das Toolkit erzwingt kein Präfix. Name, Bild, Mitglieder, Module und Aussehen gehören dem Dialog; ein App-Abschnitt SOLLTE sie nicht schreiben.
5. `initialSection` gilt bei jedem Öffnen. Gibt es den Bereich noch nicht (das Adminrecht lädt noch), steht der erste Bereich da, bis er erscheint.
6. Jeder App-Abschnitt steht in einer eigenen Fehlergrenze; ein Fehler darin lässt Menü und Dialog bedienbar. Wirft `visible`, fällt nur dieser Abschnitt weg.
7. Auf schmalen Schirmen bricht die Bereichsleiste um. Kein Eintrag DARF nur durch seitliches Scrollen erreichbar sein.

**Code:** `packages/toolkit/src/components/layout/group-dialog.tsx`.

## Item-Detail aus dem Register

**Status:** Normativer Entwurf (S0, 26.09.2026). Die Umsetzung folgt in S1–S6; bis dahin weicht `ItemDetailBody` hiervon ab. Gilt für `ItemDetailBody`, `ItemDetailView`, `ItemDetailPanel` und den `ContentComposer` im Edit-Modus. Die Inhalte kommen aus dem Feld- und Kantenregister ([06 → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister)); die Flächen verzweigen nicht nach `type`.

### Detail-Anatomie

Jedes Item öffnet in derselben Anatomie. Sie besteht aus neun Slots in fester Reihenfolge:

| # | Slot | Lesen | Bearbeiten |
|---|---|---|---|
| 1 | `head` | Typ-Badge, Space-Badge (nur außerhalb des eigenen Space), ⋮ und ✕, Titel; bei `person` Avatar, Name und Untertitel | Typ fest, Space wählbar (wenn der Connector verschieben kann, sonst fest) und ✕, siehe [Edit-Regeln](#edit-regeln), Regel 3; Titelfeld (bei `person` Avatar-Feld und Name) |
| 2 | `meta` | Meta-Box: eine Zeile je Feld oder Kante | Schreibformen derselben Felder in derselben Reihenfolge |
| 3 | `actions` | Selbstaktion als Pill-Zeile (C2) | entfällt |
| 4 | `content` | Beschreibung (Markdown), Medien | Text-Widget, Medien-Widget |
| 5 | `reverse` | Rückwärts-Listen aus kompakten `ItemPreview`s | entfällt |
| 6 | `tags` | TagChips und Urheberzeile | Tag-Widget |
| 7 | `bar` | Reaktionen und Kommentieren (C7) | entfällt |
| 8 | `comments` | Thread mit gepinnter Eingabe | entfällt; stattdessen Fußzeile Löschen · Abbrechen · Speichern |
| 9 | `note` | Nur-lesen-Hinweis (Modus) | entfällt; der Fehler beim Speichern steht als Banner unter dem Kopf des Formulars |

Regeln:

1. Die Reihenfolge der Slots ist fest. Ein Slot ohne Inhalt erzeugt nichts: keine leere Fläche, keine Überschrift, keinen Abstand.
2. Ein leeres Feld erzeugt keine Zeile. Es gibt keine 0-Zähler und keinen Platzhaltertext.
3. Die Meta-Box hat eine Zeile je Feld oder Kante, jede mit Icon. Die Zeilen stehen in dieser Reihenfolge: Menschen → Zeit → Ort → Item-Kanten → Werte. Innerhalb einer Gruppe gilt die Reihenfolge des Registers.
4. Eine Item-Referenz erscheint als Chip in der Farbe ihres Typs. Ein Klick darauf öffnet das Ziel in derselben Panel-Instanz. Ein Wert erscheint als Text; führt er zu einer Sicht, gilt [01 → Ein Feld führt zu seiner Sicht](../01-app-composition.md#ein-feld-führt-zu-seiner-sicht).
5. Menschen stehen in **einer Zeile je Personen-Kante**. Ist ein Qualifier-Wert gesetzt, steht er klein hinter dem Namen am Chip (etwa „Maria zugesagt" für `going`, „Timo lernt" für `learns`). Gespeichert wird die Id, das Wort kommt über die Intl-Schicht. Stammt die geltende Aussage nicht von der Person selbst, sagt der Chip, von wem: „Timo zugesagt · eingetragen von Anton" ([08 → Qualifier an Kanten](../08-relation-records.md#qualifier-an-kanten)). Ein Qualifier an einer Item-Kante (C3) steht ebenso klein hinter dem Chip. Ein Wert, den das Register nicht kennt, erscheint ohne Zustandstext und wird nie verworfen. Das Event führt Eingeladene (`invited`) und Zusagen (`attends`) in einer Zeile. Eine Person mit geltendem `declined` erscheint nicht in der Zeile und nicht in ihrer Zusammenfassung, nur in der vollständigen Liste („Alle").
6. Position im Modul (Spalte, Stufe, Reihenfolge) steht nicht in der Meta-Box.
7. Eine Selbstaktion ist eine Kante von mir zum Item. Sie steht als eigene Pill-Zeile direkt unter der Meta-Box: vor der Aktion neutral („Zusagen · Vielleicht · Absagen"), danach mit meinem Zustand („✓ Zugesagt" für `going`). Auch `declined` ist ein Zustand und bleibt als meiner sichtbar. Die Pill meines Zustands ist ein Umschalter; der zweite Klick nimmt ihn zurück. Deklariert die Kante eine Folgeaktion ([06 → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister), Regel 9), steht sie nach meinem Zustand. Die Aufgabe: niemand zugewiesen „Übernehmen"; andere zugewiesen, ich nicht „Mitmachen"; ich allein „✓ Übernommen · Erledigt"; ich mit anderen „✓ Dabei · Erledigt"; erledigt nur Zustände, keine Aktionen: „✓ Übernommen · ✓ Erledigt" oder „✓ Dabei · ✓ Erledigt", wer nicht zugewiesen ist, nur „✓ Erledigt" — alle als Status lesbar, keiner ein Knopf ([06, Regel 19](../06-schema-composition.md#feld--und-kantenregister)). Klick auf „✓ Übernommen" oder „✓ Dabei" gibt ab, solange die Aufgabe nicht erledigt ist. Wieder öffnen geht nur über Bearbeiten oder das Kanban. Den Status beim Übernehmen, Mitmachen, Abgeben und Erledigen regelt [06, Regel 19](../06-schema-composition.md#feld--und-kantenregister): Übernehmen setzt eine offene Aufgabe auf „In Arbeit", und wer als letzte Person eine Aufgabe in Arbeit abgibt, setzt sie auf offen zurück. Der Umschalter meines Zustands trägt `aria-pressed`, gedrückt nennt die Beschriftung die Rücknahme („Übernahme zurückgeben", „Nicht mehr mitmachen"). „Erledigt" sieht nur eine Person an der Kante, und nur mit Schreibrecht am Item (Modi, Regel 1); alle anderen ändern den Status im Formular oder im Modul.
8. Rückwärts-Listen deklariert der Typ des angezeigten Items (Register, `itemRole: "to"`, Slot `list`, oder eine benannte Abfrage in `lists`). Sie zeigen alle Einträge, jeden einmal, ohne Kappung, als kompakte `ItemPreview`s (Kartenflächen-MUSS, siehe [`ItemPreview`](#itempreview)). Trägt eine Liste eine Aktion, steht sie im Listenkopf; hat die Liste keinen Eintrag außer dem Item selbst, steht die Aktion allein an ihrer Stelle. Die Liste einer Kante DARF rechts in der Zeile den Wert eines Felds zeigen (`list.trailing`) und ihre Einträge nach einem Feld gliedern (`list.group`), mit Zwischenüberschrift und Anzahl je Gruppe ([06 → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister), Regel 22). Die Liste `family` eines Statements heißt „Fassungen N"; je Zeile stehen ein Badge („Ausgang" oder „Variante"), der Titel, „diese" bei der angezeigten Fassung und eine kleine Stimmleiste. Ihre Aktion ist „+ Variante" ([resonance.md → Varianten](resonance.md#varianten)).
9. Die Karte (`ItemPreview`) zeigt aus demselben Register: Titel, erste Meta-Zeile, Avatar-Stack, Tags gekappt. Ein Feld mit Item-Verweis (B15) steht auf der Karte als Chip („Variante von …"). Im Detail entfällt seine Meta-Zeile, wenn eine Liste des Typs es abdeckt (`covers`); beim Statement zeigt die Liste `family` die Herkunft.
10. Ob `bar` und `comments` erscheinen, sagt das Register des Typs. Für `person` entfallen beide.

**Zustände.** Jeder Zustand trägt dieselbe Anatomie:

| Zustand | Verhalten |
|---|---|
| Normal | wie oben |
| Viele | Eine Menschen-Zeile fasst ab einer Schwelle je Qualifier zusammen: drei Avatare, „12 zugesagt" (`going`), „Alle" |
| Laden | Skeleton in der Anatomie, kein Spinner |
| Minimal | nur Felder mit Inhalt (Regeln 1 und 2) |
| Fehler | Banner inline unter dem Kopf des Formulars mit „Erneut" und, wenn der Connector einen liefert, dem Grund; Eingaben bleiben erhalten. „Erneut" setzt an einem schon angelegten Item fort |
| Mobil | Drawer von unten, gleiche Slots; Kopf fix, der Rest scrollt |

### Widget-Paare

Jedes Feld und jede Kante hat eine Lese- und eine Schreibform auf **einem** Datenvertrag. Ein Widget, das schreibt, MUSS eine Leseform im Detail haben, und umgekehrt.

**Wert-Widgets (Feld):**

| # | Widget | Lesen | Schreiben |
|---|---|---|---|
| B1 | `title` | Kopfzeile | Titelfeld, fokussiert |
| B2 | `text` | Markdown-Inhalt | Editor; `#tag` setzt ein Tag, `@name` verlinkt ein Item; eingeklappt als „+ Beschreibung", wenn leer |
| B3 | `date` | Zeile mit Sprung in den Kalender; Wiederholung als zweite Zeile | Datum und Uhrzeit, Ende, Wiederholung als Auswahl |
| B4 | `location` | Ort-Item als Chip oder Adresse als Text mit Sprung auf die Karte | ein Feld; die Autovervollständigung mischt Ort-Items und Adressen; Karten-Pick daneben |
| B5 | `media` | Bildreihe im Inhalt | Chips „+ Bilder hinzufügen" |
| B6 | `status` | Chip mit Punkt im Ton der Option (Pastellgrund, Schrift und Rand im Ton) | Pillen (bis 4 Optionen), jede mit Punkt im Ton, die gewählte wie der Chip; sonst Liste |
| B7 | `number` | Text mit Einheit („12 h · 300 €"), ungerundet | ein Zahlenfeld je Wert, nebeneinander |
| B8 | `select` | Chip wie B6 | Pillen wie B6 (bis 4 Optionen); sonst Dropdown |
| B9 | `url` | Link mit Globus-Icon | Textfeld mit Icon |
| B10 | `chips` | Chip-Reihe mit Label | Chips mit Vorschlägen und „+ eigenes" |
| B11 | `avatar` | Kopf-Avatar | Bild wählen, Resize auf 512 px |
| B12 | `contact` | Zeile mit Sprung „Anrufen" | Textfeld mit Sichtbarkeits-Hinweis |
| B13 | `group` | Space-Badge im Kopf, nur außerhalb des Space | Space-Auswahl im Kopf des Formulars |
| B14 | `tags` | TagChips | Chips „+ Tag" |
| B15 | `item-ref` | Chip in Typfarbe wie C3 („Variante von …") auf der Karte; im Detail nur ohne abdeckende Liste; fehlendes Ziel als Text („nicht verfügbare Aussage") | nur soweit der Typ es erlaubt; bei `edit: "fixed"` feste Anzeige (siehe unten) |

**Kanten-Widgets:**

| # | Widget | Lesen | Schreiben |
|---|---|---|---|
| C1 | `people` | eine Zeile: Chips mit Avatar, Name und Qualifier; ab Schwelle Zusammenfassung je Qualifier | Chips mit Qualifier-Text, Antippen wechselt den Qualifier, „Einladen…" |
| C2 | self-action | Pill-Zeile im Slot `actions`, neutral („Übernehmen", mit anderen an der Kante „Mitmachen") oder mein Zustand („✓ Übernommen", mit anderen „✓ Dabei"), danach die Folgeaktion (nur für mich); mein Zustand ist Umschalter; erledigt nur Zustände, keine Aktionen | entfällt (die Pill-Zeile schreibt selbst) |
| C3 | `item-relation` | eine Zeile je Prädikat mit Label und Chips in Typfarbe, gekappt „+N"; Ziele mit Status der Rolle `done` durchgestrichen | Chips und „@ … suchen oder im Modul klicken…" |
| C4 | `vote` | Balken grün/gelb/rot, Prozent, „12 von 14", Namen je Stufe | Pills Dafür · Skeptisch · Dagegen (als C2) |
| C7 | comment/reaction | Aktionsleiste (`bar`) und Thread (`comments`) | inline, nie im Formular |

Später, nicht Teil dieses Entwurfs: C5 `membership` (Mitglieder-Stack im Projekt, Projekt-Chips im Profil), C6 `verification` („verifiziert mit …", Pill öffnet den QR-Flow), C8 `origin` (Herkunft gespiegelter Items, [09](../09-mirror-bridge.md)/[12](../12-profile.md)), C9 `confirmations` (Liste mit Level und Anlass) und C10 `activity` (Verlauf als Projektion).

Regeln:

1. Es gibt ein Widget je Datentyp, nicht je Fachfeld. `number` deckt Stunden, Euro und Punkte ab. Beschriftung, Einheit und Optionen kommen aus dem Register.
   Zahlenfelder (`number`), die in der Reihenfolge der Meta-Box aufeinander folgen und dasselbe `label` tragen, teilen eine Zeile („Aufwand 12 h · 300 €") und im Formular eine Gruppe mit einem Zahlenfeld je Wert. Ein Wert erscheint ungerundet.
   Chip und Pillen von `status` und `select` tragen den Ton der Option ([06, Regel 21](../06-schema-composition.md#feld--und-kantenregister)): Jede Pille hat links einen Punkt im Ton; nicht gewählt steht sie hell mit Rand und gedämpfter Schrift, gewählt und als Chip mit Pastellgrund, Schrift und Rand im Ton, halbfett. Im Dunkeln ist der Pastellgrund getönt statt hell.
2. Beschriftungen kommen über die Intl-Schicht (DE/EN), nicht aus dem Widget.
3. `blocks` heißt in allen Typen von beiden Enden gleich: „Braucht" (eingehend) und „Ermöglicht" (ausgehend).
4. Ein Record ist nie eine Karte. Er wird über das Item gelesen, das er berührt.

### Modi

Der Modus ergibt sich aus Rechten und Instanz, nicht aus dem Typ. Er bestimmt ⋮-Menü, Aktionszeile, Kommentar-Eingabe und Hinweis.

| Modus | ⋮ Bearbeiten/Löschen | Aktionszeile (`actions`) | Kommentar-Eingabe | Kopf und Hinweis |
|---|---|---|---|---|
| Eigenes | ja | ja, mit meinem Zustand | ja | – |
| Mitglied | nach `useItemPermissions` | ja, neutral bis zur eigenen Aktion | ja | Space-Badge außerhalb des Space |
| Nur lesen | nein | nein | nein | Nur-lesen-Hinweis im Slot `note` |
| Eingefroren | „Bearbeiten" für den Inhalt entfällt; das Menü bleibt, „Löschen" erscheint, wenn der Schreibweg es erlaubt | ja | ja | Hinweis an der Stelle der Liste mit Aktion |

Regeln:

1. Selbstaktionen (C2, C4) sind auch ohne Bearbeitungsrecht am Item möglich, wenn Schreibrecht im Space besteht. Ohne Schreibrecht entfällt die Aktionszeile ganz.
2. Im Modus „Nur lesen" sagt der Hinweis, warum das Item nicht bearbeitbar ist.
3. „Eingefroren" gilt, solange der Inhalt eines Items nach [08 → Einfrieren](../08-relation-records.md#inhaltsgebundene-bezugnahme-und-einfrieren) nicht mehr geändert werden darf. Es kommt zu „Eigenes" oder „Mitglied" hinzu. Es entfällt nur „Bearbeiten" für den Inhalt. Alles andere bietet die UI an, wenn der Schreibweg es technisch erlaubt: Löschen, und was außerhalb des Inhalts liegt (etwa Tags).
4. Der Hinweis „Wortlaut eingefroren" steht an der Stelle der Liste, deren Aktion eine neue Fassung anlegt, zusammen mit dieser Aktion (Statement: „+ Variante" an `family`). Hat der Typ keine solche Liste, steht er im Slot `note`.
5. Menüaktionen des Typs (`menuActions`, [06 → Feld- und Kantenregister](../06-schema-composition.md#feld--und-kantenregister)) stehen im ⋮-Menü neben Bearbeiten, Teilen und Löschen und folgen denselben Sichtbarkeitsregeln wie [`ItemDetailActions`](#itemdetailactions).
6. Die Modi gespiegelter Items (Spiegel mit und ohne Schreibrecht, Herkunfts-Badge) sind nicht Teil dieses Entwurfs. Sie folgen mit [09](../09-mirror-bridge.md) und [12](../12-profile.md).

### Edit-Regeln

1. Bearbeiten tauscht die Slots `meta` bis `comments` in derselben Card gegen die Schreibformen. Kommentarliste und Kommentar-Eingabe entfallen. Das ✕ bleibt.
2. Das Formular hat diese Reihenfolge: Kopf (Typ, Space) → Titel → Beschreibung → Felder in der Reihenfolge der Meta-Zeilen → Tags. Die Beschreibung ist als „+ Beschreibung" eingeklappt, wenn sie leer ist; ohne Titelfeld (Beitrag) ist sie der Inhalt und nie eingeklappt. Lesen bleibt Titel → Meta-Box → Beschreibung: Titel und Text schreibt man in einem Zug, beim Lesen stehen die Fakten zuerst.
3. Typ und Space stehen im Kopf als kompakte Auswahlfelder. Der Space steht oben, weil er Sichtbarkeit sowie Personen- und Tag-Vorschläge bestimmt. Beim Erstellen sind Typ und Space wählbar. Beim Bearbeiten steht der Typ fest; der Space ist wählbar, wenn der Connector Items verschieben kann (`moveItemToGroup`), sonst steht er fest da. Was der Space im Formular bestimmt und wann er Pflicht ist, regelt [Space des Formulars](#space-des-formulars).
4. Die Fußzeile klebt am Ende der Card. Sie hat Löschen links (nur mit Recht, hinter Bestätigung) und Abbrechen und Speichern rechts. Speichern schließt nur bei Erfolg. Ein Fehler erscheint inline, die Eingaben bleiben. Beim Schließen mit ungespeicherten Änderungen fragt ein Unsaved-Guard nach.
5. Position, Reihenfolge und System-Felder (`pos: "module"` und `pos: "system"` im Register) erscheinen nicht im Formular.
6. Ein Qualifier-Chip wechselt beim Antippen zum nächsten Wert, den das Register für die Kante deklariert. Einen unbekannten Wert schreibt das Formular unverändert zurück, bis jemand den Chip antippt.
7. Eine Item-Relation (C3) wird über eine `@`-Suche über die Items des Formular-Space gesetzt ([Space des Formulars](#space-des-formulars)). Der zweite Weg ist der Modul-Pick (Brett-Klick, Marker-Klick); ihn liefert das Modul.
8. Es gibt keinen zweiten Editor neben dem Item-Edit.
9. Ein Feld mit `edit: "fixed"` erscheint fest: sichtbar, nicht bearbeitbar, mit einem Symbol dafür. Beispiele: „Variante von" (Chip) und „Space" im Formular einer Variante.

### Space des Formulars

Das Formular führt den Space als eigenen Zustand, den **Formular-Space**. Er ist der Space, in dem das Item nach dem Speichern liegt. Er gilt für Erstellen und Bearbeiten gleich.

Regeln:

1. **Vorauswahl.** Beim Erstellen ist der Formular-Space der geöffnete Space. Ist keiner geöffnet (Übersicht), ist er „Privat" (`getPersonalGroupId()`). Hat der Connector keinen persönlichen Space, ist der einzige mögliche Space vorausgewählt; gibt es mehrere, ist keiner gesetzt. Ein Kontext DARF ihn fest vorgeben (Varianten, [Edit-Regeln](#edit-regeln), Regel 9). Beim Bearbeiten ist er der Space des Items (`getItemGroupId()`).
2. **Eine Quelle.** Nach dem Öffnen DARF das Formular den Space nur aus dem Formular-Space lesen, nie aus dem geöffneten Space (`getCurrentGroup()`). Nur die Auswahl im Kopf ändert ihn. Wechselt die App den geöffneten Space, während das Formular offen ist, bleibt der Formular-Space.
3. **Weitergabe.** Jeder Teil des Formulars, der vom Space abhängt, bekommt den Formular-Space:

    | Teil | Verwendung des Formular-Space |
    |---|---|
    | `@`-Suche einer Item-Kante (C3) | `ItemFilter.group` ([02 → Lesen in einem bestimmten Space](../02-data-interface.md#lesen-in-einem-bestimmten-space-group)) |
    | Personen-Vorschläge (C1) | Mitglieder dieses Space (`observeMembers(space)`) |
    | Tag-Vorschläge (B14) | Tags dieses Space |
    | Prüfung einer Verknüpfung (Suche, Modul-Pick, gewählte Chips) | Das Ziel liegt in diesem Space; ein `item:`-Target ist space-lokal ([04 → Target-Konventionen](../04-items-relations-groups-spaces.md#target-konventionen)) |
    | Speichern | Das Item liegt danach in diesem Space |

4. **Wechsel im Formular.** Wechselt der Formular-Space, gelten Suche, Vorschläge und Prüfung sofort für den neuen Space. Personen-Kanten und Tags sind nicht betroffen; ihr Ziel ist nicht space-lokal.
5. **Ein Item mit Beziehungen bleibt in seinem Space.** Hat ein Item Beziehungen, ist die Space-Auswahl im Kopf deaktiviert: feste Anzeige wie beim festen Space einer Variante ([Edit-Regeln](#edit-regeln), Regel 9), ohne Rand und Chevron, gedämpft, mit einem kurzen Grund als Tooltip („Hat Verknüpfungen, Stimmen oder Zusagen – bleibt in diesem Space“). Das Formular zeigt keinen weiteren Hinweis und sperrt Speichern nicht. Als Beziehung zählen:

    - Item-Kanten (C3) in beiden Richtungen, eingebettet wie als Record (etwa `blocks`, `partOf`);
    - feste Item-Verweise (B15 `item-ref`) in beiden Richtungen: eine Variante mit `variantOf` und eine Aussage, auf die Varianten zeigen. Das Ziel von `variantOf` MUSS im selben Space liegen ([resonance.md → Varianten](resonance.md#varianten), Regel 2);
    - Records von Personen, die sich auf das Item beziehen, auch eigene und stellvertretend eingetragene: Stimmen (`votesOn`), Zusagen (`attends`), Kommentare und Reaktionen (C7).

    Eingebettete Personen-Kanten (`assignedTo`, `invited`) und Tags zählen nicht; sie gehören zum Item und ziehen mit um. Beim Anlegen ist die Space-Auswahl fest, sobald eine Item-Kante gewählt ist, und wieder wählbar, wenn sie entfernt ist. Begründung: Ein Verweis zwischen Spaces zeigt ins Leere, und Mitglieder des neuen Space sehen Items des alten nicht. Fremde Aussagen mitzunehmen würde sie ohne Einwilligung ihres Autors einem neuen Kreis zeigen (im WoT für einen Kreis signiert). Ein Item, das den Space nur halb wechselt, gibt es nicht. Wer ein solches Item woanders braucht, legt es dort neu an (später als Spiegel, [09](../09-mirror-bridge.md)).
6. **Anlegen in einem Schritt.** Das Formular legt ein neues Item mit `createItem(item, { group })` direkt im Formular-Space an ([02 → Anlegen in einem bestimmten Space](../02-data-interface.md#anlegen-in-einem-bestimmten-space)), nie durch Anlegen und Verschieben. Ohne `hasGroupScope()` bietet es beim Erstellen nur den Space an, in dem der Connector ohne `group` anlegt. Beim Bearbeiten verschiebt ein Wechsel des Space das Item (`moveItemToGroup`).
7. **Kein Vortäuschen.** Kann der Connector nicht im Formular-Space lesen (`hasGroupScope()` fehlt) und ist dieser nicht der geöffnete Space, sagt die Suche das, statt leer zu bleiben oder Items des geöffneten Space anzubieten. Dasselbe gilt für Personen- und Tag-Vorschläge.
8. **Pflicht nur beim Anlegen.** Hat der Connector Spaces und ist beim Erstellen keiner gesetzt, ist das Feld markiert und Speichern gesperrt. `composer.groupRequired` gilt nur beim Erstellen. Beim Bearbeiten ist der Space nie Pflicht: Ein Item ohne bekannten Space bleibt speicherbar.

## Hooks

Reine Item-Ableitungen, von beliebigen Komponenten benutzbar.

### `useItemEditor`

**Zweck:** Konsolidiert Composer-Modal-State, `@context`-Ableitung und createItem/updateItem-Dispatch. Module liefern einen `mapSubmission`-Mapper; der Hook orchestriert.

**Vertrag (Options + Result):**

```ts
interface UseItemEditorOptions {
  currentUserId: string | undefined
  mapSubmission: ItemEditorMapper
  onCreated?: (item: Item) => void | Promise<void>
  onUpdated?: (item: Item) => void | Promise<void>
  onDeleted?: (itemId: string) => void | Promise<void>
}

type ItemEditorMapper = (
  submission: ContentComposerSubmitData,
  ctx: { mode: "create" | "edit"; existingItem: Item | null },
) => ItemEditorPayload | null

interface UseItemEditorResult {
  isOpen: boolean
  mode: "create" | "edit"
  currentItem: Item | null
  error: Error | null
  isSubmitting: boolean
  openCreate(): void
  openEdit(item: Item): void
  close(): void
  submit(
    submission: ContentComposerSubmitData,
    options?: { existingItem?: Item },
  ): Promise<Item | null>
  remove(itemId?: string): Promise<void>
}
```

**Schlüssel-Verhalten:**

1. Der Mapper gibt eine `ItemEditorPayload` zurück (`type`, `data`, optional `tags`, `relations`, `@context`, `createdBy`) oder `null` zum Abbruch.
2. Wenn `@context` fehlt, ruft der Hook `deriveContext(type, data)`.
3. `submit(submission, { existingItem? })` und `remove(itemId?)` akzeptieren Inline-Overrides, damit Views mit eigener Open-State-Logik (z.B. Kanban's `panelState`) den Hook ohne `openEdit`-Round-Trip benutzen können.
4. Fire-and-await — kein Optimistic-Update. Optimistic kann als opt-in Mode später ohne API-Bruch ergänzt werden.

**Spec-Anker:** [06-schema-composition.md](../06-schema-composition.md) (für `deriveContext`).

### Item-Daten-Hooks

Pure Hooks, die Item-Felder normalisiert ausliefern. Module benutzen sie statt manueller Field-Reader.

| Hook | Signatur | Zweck |
|---|---|---|
| `useItemAuthor` | `(item, users) => User \| undefined` | Resolved `createdBy` gegen User-Liste |
| `useItemTags` | `(item) => readonly string[]` | Normalisierte Tag-Liste; stabile Identity (Spec [07-tags.md](../07-tags.md)) |

`useItemDateHint`, `useItemPosition` und `formatItemDateHint` gab es hier bis zum
19.09.2026. Sie wurden entfernt (real-life-stack#400), weil keine Fläche sie las:
Zeit und Ort werden dort gebraucht, wo sie angezeigt werden, und das ist
`ItemMetaRow` (Spec [event/v1](../schemas/vocab/event/v1/schema.json) und
[place/v1](../schemas/vocab/place/v1/schema.json)). Wer die rohen Werte selbst
braucht, nimmt die reinen Funktionen: `isAllDayDate`, `parseEventDate`, `formatDay`
und `formatClock` aus `lib/date-utils`, `isPoint` und `latLngFromPoint` aus `lib/geo`.
Sie sind keine Hooks, weil daran nichts reaktiv ist.

### `useOpenProfile` + `OpenProfileProvider`

**Zweck:** Imperative Handle für „Profile-Open"-Aktion. Der Toolkit liefert nur den Vertrag; die App Shell entscheidet, was „Open Profile" konkret macht (eigenes Profil editieren wenn `userId === currentUser.id`, sonst Read-Only-View).

**Vertrag:**

```ts
type OpenProfile = (userId: string) => void
interface OpenProfileProviderProps {
  openProfile: OpenProfile
  children: ReactNode
}
function useOpenProfile(): OpenProfile  // no-op fallback ohne Provider
```

**Fallback-Semantik:** Ohne Provider liefert `useOpenProfile()` einen No-op. Avatar-Klick-Stellen können den Hook unbedingt aufrufen, ohne Stories oder Test-Harnesses zu brechen.

**`ProfileLink`:** Wrapper, der ein Avatar-Element klickbar macht (`userId`-Prop → `useOpenProfile`). Keyboard-aktivierbar (Enter/Space) und per Default mit `stopPropagation`, damit ein Avatar-Klick in einer klickbaren Card (z.B. `ItemPreview`) nicht das Detail öffnet, sondern das Profil. Eingesetzt in `ItemPreview` (Autor), `ItemAssignees`, `CommentBubble` (via `authorId`), `ReactionDetails`, `ContactCard`.

**`ProfilePanelContent`:** Geteilter Profil-Inhalt mit `mode: "edit" | "view"`. `edit` = eigenes Profil (Avatar-Upload, Name/Bio-Inputs, Save); `view` = read-only Projektion (Avatar/Name/DID, Bio nur wenn vorhanden). Wird ohne eigene Dialog-Hülle gerendert — die App Shell hängt ihn in ihre geteilte `AdaptivePanel`-Instanz.

**App-Shell-Mechanik (Referenz-App):** Die App Shell hostet **eine** `AdaptivePanel`-Instanz mit `allowedModes={["modal"]}` (`modal` auf Desktop und Mobile). Der `OpenProfileProvider` erzeugt das Panel nicht — er liefert nur den `openProfile(userId)`-Callback (no-op ohne Provider), der diese gehostete Instanz öffnet. (Bewusst kein `drawer`: auf Mobile öffnet das Item-Detail bereits als Drawer; ein zweiter Drawer darüber wäre als gestapelte Ebene unklar. Ein zentriertes Modal liegt sichtbar abgehoben über dem Item-Drawer.) `openProfile(userId)` öffnet sie; eigener User → `edit`, fremder → `view` (lädt via `connector.getUser`). Modal liegt über einem offenen Item-Detail-Panel (z-Stacking), statt es zu ersetzen.

## Composability

Module nutzen mehrere shared Components zusammen. Die Verträge sind so geschnitten, dass Komposition direkt funktioniert — keine impliziten Annahmen über Render-Reihenfolge oder DOM-Struktur:

- **Detail mit Edit-Modus:** `ItemDetailPanel` mit `ContentComposer` als `children`, `useItemEditor` für Submit-Routing.
- **Preview mit Adornments:** `ItemPreview` (Phase 2) mit Modul-Adornments, `useItemAuthor`/`useItemTags` als Datenquelle und `ItemMetaRow` für Zeit und Ort.
- **Filter:** Module nutzen `useItemTags` für die verfügbare Tag-Aggregation und übergeben das an die `FilterBar` (Phase 3).

## Nicht-Ziele

- Visuelle Spezifikation. Diese Spec bindet keine Farben, Spacings oder Hover-States. Polish liegt in der UI-Schicht.
- Modul-spezifische Komponenten. `KanbanBoard`, `CalendarView`, `MapAdapter` (siehe [map.md](map.md)) bleiben in ihrem Modul.
- App-Shell-Flächen. `WorkspaceSwitcher`, `Navbar` sind in [01-app-composition.md](../01-app-composition.md) spezifiziert, nicht hier. (Die Profil-*Mechanik* `useOpenProfile`/`ProfileLink`/`ProfilePanelContent` ist shared und oben definiert; wie die App Shell sie einhängt, ist app-spezifisch.)
- Backend-Verträge. Diese Spec definiert UI-Composition, nicht den DataInterface-Vertrag (siehe [02-data-interface.md](../02-data-interface.md)).
