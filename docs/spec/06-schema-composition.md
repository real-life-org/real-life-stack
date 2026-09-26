# Schema-Composition

**Status:** Normativer Entwurf v0.1

Diese Spec beschreibt, wie ein RLS-Item seine Struktur und Bedeutung trägt — über **kompositorische `@context`-Vokabulare** statt über eine starre Type-Hierarchie.

Die orthogonale Achse **Kategorisierung** (welchem Thema gehört ein Item an) liegt in [07-tags.md](07-tags.md).

Diese Spec ergänzt [02-data-interface.md](02-data-interface.md) (Core Item) und [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md) (Items, Relations, Groups, Spaces).

Code-Referenz: `packages/data-interface/src/index.ts`

## Motivation

Die frühere Datenmodellierung (insbesondere in Utopia-Map) hat **Layer** in einer Doppelrolle benutzt:

1. Struktur (welche Felder hat ein Item: Event, Ort, Person, Aufgabe)
2. Kategorisierung (zu welchem Thema gehört ein Item: Permakultur, Bildung, regionale Karte)

Diese Doppelrolle führt zu Konflikten: User legen viele Layer an, um Themen abzubilden, brauchen aber denselben Strukturtyp; ein Item kann immer nur in einem Layer sein, obwohl es gleichzeitig Ort UND Event sein könnte.

RLS trennt diese Aspekte:

- **Struktur** ergibt sich aus den **`@context`-Schemas**, die ein Item komponiert (mehrere parallel möglich) — Gegenstand dieser Spec.
- **Klasse** trägt **`type`** — JSON-LDs `@type`, eine **ungeordnete Menge**; die Vorlage beim Erstellen und der User-Filter hängen daran, siehe „Die Rolle von `type`".
- **Kategorisierung** läuft über **Tags** (frei oder URN-basiert, optional in einem Kategoriebaum strukturierbar) — siehe [07-tags.md](07-tags.md).
- **Modul-Sichtbarkeit** folgt aus den Feldern — siehe „Verhältnis zwischen Schema- und Feldfiltern".
- **Thematische Klammer** ist der **Space** selbst — verschiedene Communities haben verschiedene Spaces mit eigenen Schwerpunkten.

## Schema-Composition über `@context`

Ein RLS-Item trägt eine `@context`-Liste, die festlegt, welche Vokabulare seine Felder definieren. Das Pattern ist analog zu [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/), wie auch im WoT-Spec für Attestations verwendet.

### Item mit `@context`

```ts
interface Item {
  id: string
  '@context': string[]            // ordered list of vocabulary URLs
  type?: string | string[]         // Klasse(n) = @type, ungeordnete Menge; siehe „Die Rolle von `type`"
  createdAt: string
  createdBy: string
  data: Record<string, unknown>
  tags?: string[]                  // tag identifiers (free strings or URNs, see 07-tags.md)
  relations?: Relation[]
}
```

Regeln:

1. `@context[0]` ist immer `https://real-life-stack.org/vocab/base/v1` — definiert die RLS-Item-Basis-Felder (`id`, `createdAt`, `createdBy`, `data`, ...).
2. Weitere Einträge erweitern das Vokabular und damit die in `data` zulässigen Felder.
3. **Property-Namen MÜSSEN über alle Vokabularien eindeutig sein.** JSON-LD's last-wins-Verhalten gilt nur für reine Property-Identifier-Auflösung; die JSON-Schema-Validierung läuft über `allOf` (Schnittmenge) und kennt keine Überschreibung. Vocabulary-Autoren vermeiden Kollisionen aktiv: gleiche Semantik → gleicher Name (Konvention), unterschiedliche Semantik → unterschiedlicher Name. Validator-Verhalten bei einer Kollision ist undefined und gilt als Vokabular-Bug.
4. Semantisch gleiche Properties aus verschiedenen Vokabularen tragen denselben Namen (z.B. `start` für Beginn-Zeitpunkt, egal ob Event oder Task).
5. `type` ist per `base/v1` ein Alias für JSON-LDs **`@type`** — es benennt die **Klasse** eines Items, und jede Klasse hat eine IRI (siehe „Klassen haben IRIs"). Welche Items ein Modul zeigt, entscheidet **Feld-Präsenz** oder eine **im Manifest deklarierte Affordanz der Klasse** — nie der Typ-Name als freier String (siehe „Die Rolle von `type`").

### Beispiel: Workshop in der Markthalle

```json
{
  "id": "uuid-abc",
  "@context": [
    "https://real-life-stack.org/vocab/base/v1",
    "https://real-life-stack.org/vocab/event/v1",
    "https://real-life-stack.org/vocab/place/v1"
  ],
  "type": "event",
  "createdAt": "2026-06-05T14:00:00Z",
  "createdBy": "did:key:z6Mki…",
  "data": {
    "title": "Permakultur-Workshop",
    "start": "2026-07-15T18:00",
    "duration": "PT2H",
    "position": { "type": "Point", "coordinates": [9.5, 51.3] },
    "address": "Markthalle 7"
  },
  "tags": ["urn:rls:tag:permaculture", "urn:rls:tag:education"]
}
```

Dieses Item erscheint **gleichzeitig auf der Map** (wegen `place`-Schema → `position`-Feld) und **im Calendar** (wegen `event`-Schema → `start`-Feld). Keines der Module muss vom anderen wissen.

### Klassen haben IRIs

**Status: umgesetzt, rls#414 (21.09.2026).** Klassen-IRIs in den Kontexten, `normalizeItemType`/`itemTypes`/`hasItemType`/`typeSpellings` und die Eingangsregel `canonicalItem` in `data-interface`; jeder Connector normalisiert an seinem Trichter (Regel 7), die Darstellung wählt über die normalisierte Klassenmenge (Regel 9). Anton: JSON-LD sichert unsere Dateninteroperabilität — eine interne Regel darf sie nicht einschränken.

`base/v1` definiert `"type": "@type"`. Damit ist unser `type` kein RLS-eigenes Feld, sondern JSON-LDs Klassen-Slot: `"type": "event"` heißt für jeden JSON-LD-Prozessor *dieses Item ist ein Event*. Bis zum 21.09.2026 fehlte die zweite Hälfte — kein Kontext definierte einen Klassenbegriff, `event` wurde zu keiner IRI, und ein fremder Prozessor sah eine Klasse ohne Identität. JSON-LD der Form, nicht der Wirkung nach.

Regeln:

1. Jedes Vokabular, das eine Klasse einführt, definiert in seinem Kontext den **Klassenbegriff in der Schreibweise der Items**: `"event": "rls:Event"`, `"place": "rls:Place"`, `"statement": "rls:Statement"`. Die Kleinschreibung ist der Begriff, die IRI trägt die Klasse. Bestehende Items brauchen dafür keine Änderung — das ist der Grund für die Kleinschreibung, nicht Geschmack.
2. Klassen ohne eigenes Vokabular stehen in `base/v1`: `post`, `comment`, `reaction`, `feature`.
3. Der Typ-Manifest-Eintrag nennt die IRI seiner Klasse; das Manifest bleibt die einzige Quelle für Typ-Identität (siehe Typ-Register).
4. Ein Vokabular besteht aus Begriffen. Ein Vokabular **ohne** Begriffe, das nur in `@context` steht, um etwas zu markieren, gibt es nicht mehr — die Klasse steht in `@type`, wo JSON-LD sie erwartet. `statement/v1` war das einzige und ist jetzt ein Vokabular mit genau einem Begriff, seiner Klasse.
5. Sobald Typen je Space konfigurierbar sind, bringt ein Space eigene Klassen mit eigenen IRIs in seinem eigenen Namensraum mit — nicht in `rls:`. Regel 1 ist das Gerüst dafür.

**Normalisierung — der Vertrag an der Grenze** (rls#413, 21.09.2026). Ein JSON-LD-Prozessor darf dieselbe Klasse als Kontextbegriff (`statement`) oder als volle IRI (`https://real-life-stack.org/vocab/statement/v1#Statement`) liefern, und `@type` ist eine ungeordnete Menge. RLS MUSS beides so behandeln, dass keine Semantik davon abhängt:

6. **Identität ist die IRI.** Zwei Klassen sind gleich, wenn ihre über den Kontext expandierten IRIs gleich sind. Der Kurzname ist eine Schreibweise, keine zweite Identität.
7. **Kanonische Form im Stack ist der Kurzname** — die Schreibweise der Items und des Manifests. An der **Eingangsgrenze** (Connector liest, Import, Sync) MUSS eine volle IRI, die ein bekanntes Vokabular der Registry auflöst, auf ihren Kurznamen normalisiert werden. Eine IRI, die kein bekanntes Vokabular auflöst, bleibt **unverändert** als volle IRI stehen: Sie ist eine fremde Klasse und wird weder verworfen noch umgedeutet.
8. **Alle Klassen zählen für Affordanzen.** Ob ein Item die Affordanz `votesOn` hat, entscheidet die **Vereinigung** der Affordanzen aller Klassen, die es trägt. `["post","statement"]` und `["statement","post"]` sind dieselbe Menge und haben dieselben Affordanzen. Filter (`type` im `ItemFilter`), Hinweise (`moduleHintsFor`) und der Host-Filter aus dem Ladevertrag vergleichen **Mengen auf Kurznamen nach Normalisierung**, nie Strings in Reihenfolge.
9. **Die Vorlage ist eine UI-Wahl, keine Klassensemantik.** Der Composer braucht beim Erstellen genau eine Vorlage und beim Bearbeiten genau eine, um die Widgets zu bestimmen. Er nimmt die **erste Klasse, für die das Darstellungs-Register eine Vorlage kennt**; sind es mehrere, ist die Wahl eine Konvention der Fläche und DARF keine andere Aussage über das Item tragen. Wer einen Filter, eine Aktivierung oder eine Affordanz an „die erste Klasse" hängt, hat einen Fehler gegen Regel 8 vor sich.
10. **Unbekannte Klassen** aktivieren kein Modul, tragen keine Affordanz und bekommen die generische Darstellung — sie bleiben am Item erhalten (Regel 7) und laufen beim Sync unverändert weiter.

Abnahmefälle: (a) `type: "statement"` und `type: "https://real-life-stack.org/vocab/statement/v1#Statement"` unter demselben `@context` erscheinen beide in der Resonanz; (b) Vertauschen zweier Klassen ändert weder Affordanzen noch Modul-Zugehörigkeit; (c) eine fremde IRI bleibt nach Lesen und Zurückschreiben byteweise erhalten; (d) `matchesFilter({ type: "statement" })` trifft beide Schreibweisen aus (a). JSON-Schema-Tests prüfen das nicht; es braucht Tests gegen `matchesFilter` und `moduleHintsFor`, mit B0.

### Überlagerung statt Konflikt

Wenn zwei `@context`-Schemas dieselbe Semantik treffen (z.B. `start` für Beginn), wird das Feld **geteilt**, nicht dupliziert. Beispiel: ein Item, das gleichzeitig Event und Task ist, hat ein gemeinsames `start`. Strukturelle Überlagerung ist beabsichtigt.

Wenn semantisch unterschiedliche Konzepte denselben Property-Namen tragen würden, ist das ein **Schema-Design-Fehler**, der durch Aliasing im Vocabulary-Context behoben wird (z.B. `event:start` vs. `subscription:start`).

### Die Rolle von `type`

`type` benennt die **Art**, als die ein Item erstellt wurde (`post`, `event`, `task`) — die Intention beim Erstellen. Aus ihr wählt der Composer ein **Template** (Widget-Set beim Erstellen, Karten-Darstellung beim Anzeigen); sie bleibt am Item, damit Module und User sich darauf beziehen können. `type` ist eine **Menge** von Klassen, meist mit einem Element. Sie ist **ungeordnet** — JSON-LD gibt `@type` keine Reihenfolge, und keine Regel dieser Spec DARF von einer abhängen (siehe „Klassen haben IRIs", Normalisierung). Pro Klasse gehört **ein** Template (Erstellen-Widgets und Anzeige-Karte zusammen); heute als `ContentTypeConfig` je Modul-View definiert; das kanonische, modulübergreifend geteilte **Typ-Register** (nächster Abschnitt) löst diese Streuung ab.

`type` darf tragen: die Composer-Vorlage, die Karten-Wahl in aggregierenden Sichten (Feed, Suche) und **User-Filter** („zeig mir nur Veranstaltungen"). Für die **Modul-Aktivierung** gilt eine zweiteilige Regel:

- **Ein Feld aktiviert das Modul, das es darstellt.** Ob ein Item im Calendar erscheint, entscheidet `data.start`, nie der Typ-Name — sonst verschwände ein Task mit Fälligkeitsdatum zu Unrecht. Ein Task mit Deadline und ein Event tragen beide `start`; „die Veranstaltungen" sind aus Feldern allein nicht herauszufiltern, das ist der User-Filter.
- **Eine Klasse aktiviert das Modul, dessen Affordanz sie im Manifest deklariert.** Was eine Aussage zur Aussage macht, ist kein Feld, sondern dass sie Stellungnahmen entgegennimmt — im Manifest: `relations: [{ predicate: "votesOn", itemRole: "to" }]`. Die Resonanz zeigt Items, deren Klasse diese Affordanz deklariert. Das ist keine Aktivierung über den Typ-**Namen**, sondern über eine Angabe im Register — dieselbe Art Angabe wie `presents` am Modul (Spec 01).
- **Der Typ-Name als freier String aktiviert nichts.** Ein Composer kann ihn setzen, wie er will; eine Fläche, die darauf schaltet, verwechselt eine Vorlage mit einer Wahrheit über das Item.

*Bis zum 21.09.2026 hieß es hier nur: „`type` aktiviert nie." Der Satz war für Felder richtig und für Klassen falsch; um ihn nicht zu brechen, gab es das „Marker-Vokabular" `statement/v1` — eine zweite Aussage derselben Klasse in `@context`. Das war eine Umgehung, und sie hat die Interoperabilität gekostet, für die `@context` da ist.*

### Typ-Register

Das Typ-Register löst die oben genannte Ausbaustufe ein: **ein** kanonischer Eintrag pro `type`, geteilt von allen Modulen und Flächen. Es beantwortet genau eine Frage — *was folgt daraus, dass ein Item diesen `type` trägt?* — und beantwortet sie an genau einer Stelle.

Motivation aus der Praxis: dieselbe Frage wurde bisher an vier Stellen unabhängig beantwortet (Typ-Guards in `data-interface`, `ContentTypeConfig` je App-View, `ItemTypeBadge`, `getItemPreviewAdornments`). Die vier Listen kennen unterschiedliche Typ-Mengen — `project` und `resource` haben eine Preview-Darstellung, aber keinen Composer-Eintrag; `post` das Umgekehrte — und sind nachweislich auseinandergelaufen (Kalender-Detail mit abweichender Meta-Komponente; Task-Assignees nur im Kanban sichtbar).

**Begriff:** Ein **Toolkit-Typ** ist ein Typ, dessen Register-Einträge das Toolkit mitliefert — in v0.1: `post`, `event`, `place`, `task`, `person`, `project`, `resource`, `statement`. *(Bis zum 21.09.2026 „Core-Typ"; „Core" hieß im Stack schon `wot-core` und den Pflichtteil des `DataInterface`, und RLS hat keinen Kern.)* Systemtypen ohne eigenständige Karte (`reaction`, `comment`, `relation`) brauchen keinen Registereintrag; sie erscheinen ausschließlich über ihre Flächen (ReactionBar, Kommentarliste, Graph).

#### Zwei Schichten, eine Identitätsquelle

Das Register besteht aus zwei Schichten entlang der Paketgrenze. Die Abhängigkeitsrichtung des Stacks (`toolkit` → `data-interface`, nie umgekehrt) erzwingt das; zugleich trennt es die zwei Änderungsgründe sauber — Datensemantik und Darstellung ändern sich unabhängig voneinander:

| Schicht | Paket | hält | ändert sich wenn |
|---|---|---|---|
| **Typ-Manifest** | `data-interface` (UI-frei) | `id`, Vokabular-Bindung, `relations` | die Datensemantik eines Typs sich ändert |
| **Darstellungs-Register** | `toolkit` | `label`, `icon`, `badge`, `fields`, `edges`, `composer`, `preview` | die Darstellung sich ändert |

Das Manifest ist die **einzige Quelle für Typ-Identität**: die Typ-Guards und `KnownItemType` in `data-interface` werden aus ihm abgeleitet, nicht daneben gepflegt. Das Darstellungs-Register hängt seine Einträge an Manifest-Ids an und DARF KEINE Typen einführen. Konsumenten lesen nur ihre Schicht: ein Connector oder Validator braucht das Manifest und zieht keine React-Abhängigkeit; eine Fläche liest die Slots.

#### Eintrag

| Feld | Schicht | Zweck |
|---|---|---|
| `id` | Manifest | stabile Typ-Identität; zugleich der Schlüssel für Lokalisierung |
| Vokabular-Bindung | Manifest | welche `@context`-Schemas der Composer beim Erstellen setzt |
| `relations` | Manifest | welche Kanten der Typ eingehen kann: `{ predicate, itemRole, otherKind }`, keyed by (`predicate`, `itemRole`), siehe „Verhältnis zu Relations" |
| `label` | Darstellung | Anzeigename (Badge, Composer-Auswahl, User-Filter); Anzeigename und Lokalisierung sind Darstellungsgründe, darum nicht im Manifest |
| `icon` | Darstellung | Typ-Icon |
| `badge` | Darstellung | Icon und Farbe des Typ-Badges; zugleich die Typfarbe der Item-Chips |
| `fields` | Darstellung | Feldliste (`FieldEntry[]`), siehe „Feld- und Kantenregister" |
| `edges` | Darstellung | Kantenliste (`EdgeEntry[]`), keyed by (`predicate`, `itemRole`), siehe „Feld- und Kantenregister"; Widgets sind UI und gehören darum nicht ins Manifest |
| `lists` | Darstellung | Rückwärts-Listen über eine benannte Abfrage (`ListEntry[]`), keyed by `query` |
| `menuActions` | Darstellung | zusätzliche Aktionen im ⋮-Menü (`MenuActionEntry[]`), keyed by `id` |
| `composer` | Darstellung | was nur der Composer braucht und kein Feld ist: `submitLabel`, `groupRequired` |
| `composerWidgets` | Darstellung | abgeleitet aus `fields` und `edges`; nur noch für Typen ohne Feldliste gesetzt |
| `preview` | Darstellung | knappe Darstellung für Karten und Zeilen; abgeleitet aus `fields` und `edges`, eigener Slot nur als Ausnahme |

`preview` liefert Slot-Inhalte für die geteilte `ItemPreview`-Hülle, keine eigene Karte. Karten-Markup bleibt Sache der Fläche.

*Bis zum Entwurf S0 (26.09.2026) hatte der Eintrag vier Slots (`composerWidgets`, `preview`, `detail`, `footer`) und `relationWidgets`. `relationWidgets` geht in `edges` auf. `detail` und `footer` entfallen: Meta-Box, Aktionszeile und Rückwärts-Listen leiten sich aus `fields` und `edges` ab. `statusOptions` und `widgetLabels` wandern aus `composer` in die Feldeinträge (`options`, `label`).*

#### Regeln

1. Das Typ-Manifest MUSS in `data-interface` leben und UI-frei sein; das Darstellungs-Register MUSS im Toolkit leben und ist über die Typ-Id an das Manifest gebunden. Apps DÜRFEN Einträge ergänzen und app-spezifische Felder (Gruppen-Optionen, Submit-Labels) über registrierte Einträge legen. Das Ersetzen bestehender Einträge ist in v0.1 nicht vorgesehen — siehe „Erweiterung und Merge".
2. Jede Fläche, die ein Item darstellt, MUSS ihre typabhängigen Anteile aus dem Register beziehen. Flächen steuern **Dichte und Rahmen** bei (`compact`/`comfortable`, Karte/Panel/Zeile). Der Typ sagt *was*, die Fläche sagt *wieviel*.
3. Module DÜRFEN KEINE eigene Typ-Verzweigung besitzen: kein `if (type === …)` in Modul-Code, keine typabhängige Komponentenwahl am Register vorbei. Modul-eigene **Mechanik** (Drag im Kanban, Pins auf der Karte, Zeitraster im Kalender) bleibt Modulsache — sie verzweigt über Felder und Capabilities, nie über `type`.
4. Das Register DARF NICHT die Modul-Aktivierung tragen (kein `showIn`-Feld). Die bleibt feldbasiert, siehe „Die Rolle von `type`". Ebenso wenig trägt es Capabilities oder Rechte: ob eine Interaktion (Reagieren, Bearbeiten, Kommentieren) verfügbar ist, entscheiden Connector-Capability und Autorisierung — nicht der Typ. Einzige Ausnahme: Ein Typ DARF Reaktionen und Kommentare für sich ausschließen (`person`: ein Profil trägt keine Kommentare und Reaktionen). Er DARF sie nicht einschalten, wo Capability oder Autorisierung fehlen.
5. Ein unbekannter `type` — und ebenso ein Manifest-Eintrag ohne Darstellungs-Eintrag — MUSS auf einen generischen Eintrag zurückfallen (Titel, Beschreibung, `base/v1`-Felder, neutrales Badge). Jeder Registereintrag MUSS auf jeder Fläche darstellbar sein; ein Eintrag, der nur auf einer Fläche funktioniert, ist ungültig. Ein Item ohne Registereintrag darf nie unsichtbar oder kaputt sein — sonst bestraft das Register die Erweiterbarkeit, die es ermöglichen soll.
6. Ein neuer Typ wird durch genau **einen Manifest-Eintrag** eingeführt. Andere Schichten hängen Einträge an dessen Id an; fehlt einer, greift Regel 5 — sichtbar generisch, nie kaputt. Wenn die Einführung eines Typs die Pflege einer zweiten **unabhängigen** Liste erfordert (eine, die Typen einführen oder widersprechen kann), ist das ein Fehler in dieser Spec.

#### Feld- und Kantenregister

**Status:** Normativer Entwurf (S0, 26.09.2026). Erweitert das Darstellungs-Register um eine Feld- und eine Kantenliste je Typ. Daraus leiten sich Composer-Defaults (`ContentTypeConfig`), Meta-Box, Aktionszeile, Rückwärts-Listen und Karte ab ([shared-components.md → Item-Detail aus dem Register](modules/shared-components.md#item-detail-aus-dem-register)).

```ts
type WidgetId =
  | "title" | "text" | "date" | "location" | "media" | "status" | "number"
  | "select" | "url" | "chips" | "avatar" | "contact" | "group" | "tags"   // B1–B14
  | "item-ref"                                                             // B15

interface FieldEntry {
  key: string                    // data-Schlüssel, z. B. "start", "hours"
  widget: WidgetId
  pos: "head" | "meta" | "content" | "tags" | "badge" | "system" | "module"
  label?: string                 // Intl-Schlüssel
  required?: boolean
  unit?: string                  // number (B7)
  options?: { id: string; label: string; tone?: string }[]   // status (B6), select (B8)
  edit?: false | "create"        // false: nie editierbar; "create": nur beim Anlegen
  ref?: { type: string; missing: string }   // item-ref (B15): Zieltyp, Intl-Schlüssel für ein fehlendes Ziel
}

interface EdgeEntry {
  predicate: string              // zusammen mit itemRole: Schlüssel einer Manifest-Kante
  itemRole: "from" | "to" | "either"
  storage: "embedded" | "record"
  widget: "people" | "item-relation" | "membership" | "vote" | "origin" | "confirmations" | "activity"
  pos: "meta" | "actions" | "list" | "badge"
  label: string                  // Intl-Schlüssel: „Braucht", „Teil von", „Findet hier statt"
  qualifier?: { key: string; values: { id: string; label: string; tone?: string }[] }
  selfAction?: { label: string; mine: string; qualifiers?: string[] }   // C2
  list?: { filter?: "open" | "upcoming"; sort?: string }                // für itemRole "to"
  count?: "one-per-person" | "collect-accepted"                         // nur storage "record"
}

interface ListEntry {
  query: string                  // Name einer Abfrage, z. B. "family"
  label: string                  // Intl-Schlüssel
}

interface MenuActionEntry {
  id: string                     // z. B. "create-variant"
  label: string                  // Intl-Schlüssel: „Variante anlegen"
  replacesEditWhenFrozen?: boolean
}
```

Regeln:

1. Jeder `EdgeEntry` MUSS eine Kante adressieren, die das Manifest für den Typ deklariert, über denselben Schlüssel (`predicate`, `itemRole`). Was am anderen Endpunkt steht, sagt das Manifest (`otherKind`); der Eintrag wiederholt es nicht.
2. `relationWidgets` geht in `edges` auf. Das Widget einer Kante ist `EdgeEntry.widget`.
3. Es gibt ein Widget je Datentyp, nicht je Fachfeld. Beschriftung, Einheit und Optionen stehen im Eintrag, nicht im Widget.
4. `pos: "module"` (z. B. `order`, `stage`) und `pos: "system"` (z. B. `did`, `id`, `createdBy`) erscheinen nie im Formular. `system` erscheint als Fußnote im Kopf.
5. Die Body-Feld-Regel ist ein Feldeintrag, kein `if`: `post` führt `content` als `text @content`, die anderen Typen `description`.
6. `storage` hält fest, wo die Kante liegt. Der Wert MUSS den Regeln aus [04](04-items-relations-groups-spaces.md) und [08, Regel 9](08-relation-records.md#relationrecord-als-item) folgen; das Register wählt den Mechanismus nicht frei. Lese- und Schreibform lesen und schreiben dort.
7. Ein Qualifier liegt bei `storage: "embedded"` als `meta.role` an der Relation, bei `storage: "record"` als Feld `qualifier.key` am Record. `qualifier.values` ist die Menge der erlaubten Werte ([08 → Qualifier an Personen-Kanten](08-relation-records.md#qualifier-an-personen-kanten)).
8. `count` deklariert für Record-Kanten, wie mehrere Aussagen über dieselbe Person zusammenwirken ([08 → Qualifier an Personen-Kanten](08-relation-records.md#qualifier-an-personen-kanten), Regel 9). Eine Record-Kante mit Qualifier MUSS `count` setzen.
9. Eine Kante mit `selfAction` erscheint im Slot `actions` als Pill-Zeile. `qualifiers` nennt die Werte, die die Pills setzen; `mine` ist die Beschriftung meines Zustands.
10. Rückwärts-Listen (`itemRole: "to"`, `pos: "list"`) deklariert der Typ, dessen Detail sie zeigt, mit Filter und Sortierung. Es werden alle Einträge gezeigt.
11. **Feld mit Item-Verweis (B15 `item-ref`):** Ein Datenfeld, dessen Wert ein Item-Target ist (`item:<id>`), ist ein Feld und keine Kante, wenn es zum Inhalt des Items gehört (etwa zum signierten Wortlaut, 08). Lesend erscheint es wie C3 als Chip in der Farbe des Zieltyps in der Meta-Box. Ein nicht auflösbares Ziel erscheint als Text (`ref.missing`), nie als Fehler. Schreibbar ist es nur, soweit `edit` es erlaubt; `edit: "create"` heißt: nur beim Anlegen, danach unveränderlich.
12. **Liste über benannte Abfrage:** Statt einer direkten eingehenden Kante DARF ein Typ eine Rückwärts-Liste über eine benannte Abfrage deklarieren (`lists`). Das Register nennt nur den Namen; was die Abfrage liefert, definiert die Spec des Typs oder Moduls. Die Liste zeigt alle Einträge, jeden einmal.
13. **Menüaktionen des Typs:** Ein Typ DARF zusätzliche Aktionen im ⋮-Menü deklarieren (`menuActions`). Mit `replacesEditWhenFrozen` ersetzt die Aktion „Bearbeiten", solange das Item eingefroren ist (08, Einfrieren); sonst erscheint sie zusätzlich. Was die Aktion tut, definiert die Spec des Typs oder Moduls. Sichtbar ist sie nur, wenn Capability und Autorisierung sie erlauben (Typ-Register, Regeln, Regel 4).
14. Apps liefern Einträge, keine Mappings. Die Abbildung Composer ↔ Item (`composer-mapping.ts`) und die Detail-Leseansicht liegen im Toolkit und lesen nur das Register.
15. `ContentTypeConfig` wird abgeleitet: `defaultWidgets` aus den Feldern und Kanten mit `pos` `head`, `meta`, `content`, `tags` oder `badge` und ohne `edit: false`, in der Reihenfolge der Meta-Box; `peopleRelations` aus den Kanten mit `widget: "people"` und `pos: "meta"`; `statusOptions` aus `options` des `status`-Feldes; `widgetLabels` aus `label`.
16. **Übergang:** In S1 lesen die Flächen `detail` und `footer` noch für Typen ohne Feldliste. Mit S6 entfallen beide. Bis dahin DARF ein Typ sie weiter setzen (etwa die Resonanz-Varianten, rls#505); die Stimmleiste zieht mit S2 von `footer` nach `actions`.

**Register je Typ (nichtnormativ).** So sehen die Einträge der Toolkit-Typen und eines App-Typs aus. Schreibweise: Feld `key` Widget @`pos`; Kante `predicate` (→ `from`, ← `to`) Widget @`pos`.

| Typ | Felder | Kanten | Selbstaktion | Rückwärts-Listen |
|---|---|---|---|---|
| `post` | content B2 @content · media B5 @content · tags B14 | reactsTo/commentOn C7 @bar | – | – |
| `event` | title B1 · description B2 · start/end/rrule B3 @meta · meetingLink B9 @meta · group B13 @badge · tags B14 | →locatedAt place C3 @meta · →invited person C1 @meta (eingebettet, angezeigt „eingeladen") und ←attends person C1 @meta (Record, `role` `going` · `maybe` · `declined`, `tense`, `count: one-per-person`) in einer Zeile | attends: `going` · `maybe` · `declined` (Zusagen · Vielleicht · Absagen) | – |
| `place` | title · description · address/position B4 @meta · tags | ←locatedAt C3 @list | – | „Findet hier statt" (Events, upcoming) |
| `task` | title · description · status B6 @meta · dueAt B3 @meta · tags · order @module | →assignedTo person C1 @meta · →partOf project C3 @meta („Teil von") · →blocks task C3 @meta („Ermöglicht") · ←blocks task C3 @meta („Braucht") | assignedTo: Übernehmen | – |
| `person` | displayName B1 @head · avatarUrl B11 @head · bio B2 · address/position B4 @meta · skills/offers/needs B10 @meta („Kann", „Bietet", „Sucht") · phone/email B12 @meta · did @system | keine Kommentare, keine Reaktionen | – | „Nächste Termine" (upcoming) · „Aufgaben" (←assignedTo, open) |
| `project` | title · description · website/repo B9 @meta · address/position B4 @meta · tags | ←partOf C3 @list | – | „Offene Aufgaben" (←partOf task, open) · „Nächste Termine" (←partOf event, upcoming) |
| `resource` | title · description · kind B8 @meta · availability B8 oder B2 @meta · tags | – | – | – |
| `statement` | title B1 („Aussage") · description B2 („Begründung") · variantOf B15 @meta (Ziel `statement`, `edit: "create"`, „Variante von …", fehlend „nicht verfügbare Aussage") · tags | ←votesOn person C4 @actions, Qualifier `value`: `green` · `yellow` · `red` | votesOn: Dafür · Skeptisch · Dagegen | Liste `family` („Fassungen"); Menüaktion `create-variant` („Variante anlegen", `replacesEditWhenFrozen`) |
| App: Karabirrdt-Karte (`task`) | title · description · status B6 @meta (Offen · Erledigt) · hours/euros B7 @meta („Aufwand") · stage @module · tags | →assignedTo person C1 @meta (`meta.role` `can` · `learns`) · ←blocks task C3 @meta („Braucht") · →partOf project C3 @meta („Führt zu") | assignedTo: Übernehmen (`can`) · Will lernen (`learns`) | – |
| App: Karabirrdt-Ziel (`project`) | title · description („Traumsatz") · priority B8 @meta (Hoch · Mittel · Niedrig) · order @module | ←partOf C3 @list, je Stufe gruppiert | – | „Karten" (←partOf task, je Stufe) |

Hinweise zur Tabelle: Die Kanban-Aufgabe hat nur „Übernehmen"; `can`/`learns` bleibt eine Funktion der Karabirrdt-App. Qualifier-Werte sind englische Ids; deutsche Wörter in Klammern sind Anzeigebeispiele. `project` hat keine Selbstaktion „Beitreten". Mitgliedschaft (`memberOf`, C5), Verifizieren (C6) und Herkunft (C8) folgen später. Die Teilnahme am Event regelt [08 → Teilnahme am Event](08-relation-records.md#teilnahme-am-event-attends-und-invited). Typ-Ids und Code-Namen bleiben Englisch; deutsche Beschriftungen kommen über die Intl-Schicht. Neue Prädikate (`partOf`, `locatedAt` am Event, `attends`) kommen erst mit ihrer Relation-Typ-Definition ins Manifest (Verhältnis zu Relations, Regel 3).

#### Erweiterung und Merge

Register-Einträge werden in deterministischer Reihenfolge zusammengesetzt: **Core → App → Space.** Eine Schicht liefert Beiträge in genau einer von zwei Formen:

1. **Typdefinition** — führt eine neue `id` ein. Eine bereits vergebene `id` ist ein **Konflikt** und MUSS abgelehnt werden.
2. **Erweiterungsfragment** — adressiert eine vorhandene `id` und ergänzt sie additiv. Mengen-Felder (Kanten keyed by (`predicate`, `itemRole`), Vokabular-Bindung als Menge, `fields` keyed by `key`, `edges` keyed by (`predicate`, `itemRole`)) werden vereinigt; neue Keys/Member sind erlaubt, das Entfernen oder Umdefinieren vorhandener ist ein Konflikt. Skalare Felder (`label`, `icon`, Slots) DARF ein Fragment nur setzen, wenn die Basis sie nicht setzt — sonst Konflikt.
3. **Override** ist in v0.1 nicht vorgesehen: Konflikte werden abgelehnt, nicht aufgelöst. Eine spätere Version KANN eine explizite Override-Operation mit Ziel-Key und Prioritätsregel einführen; bis dahin gibt es kein Shadowing, still oder ausdrücklich.

Die zusammengesetzte Sicht ist pro Space deterministisch: gleiche Schichten, gleiches Ergebnis, unabhängig von Lade- oder Registrierungsreihenfolge — Vereinigung und Konfliktprüfung sind ordnungsunabhängig definiert.

#### Verhältnis zu den Schemas

Register und Vokabulare bleiben getrennt: Schemas (`@context`) definieren die **Feldstruktur**, das Register die **Intention** (`type`) und ihre Folgen für Composer und Darstellung. Die Vokabular-Bindung im Manifest benennt, welche Schemas der Composer beim Erstellen setzt (`event` → `base/v1` + `event/v1` + optional `place/v1`), damit Template und Schema nicht divergieren.

#### Verhältnis zu Relations

Das `relations`-Feld deklariert, **welche Kanten ein Typ eingehen kann** — als Composer-/UI-Affordance, **nicht als Validitäts-Whitelist**: `predicate` bleibt offen (Regel aus 04); eine Kante mit einem Prädikat außerhalb des Registers ist gültig und wird generisch dargestellt. Die Arbeitsteilung:

| Frage | Antwortet | Ort |
|---|---|---|
| Welche Relationen bietet die UI für einen `task` an? | Typ-Register | dieses Kapitel |
| Was bedeutet `assignedTo`? Symmetrisch? Sichtbarkeit? | Relation-Typ-Definition | [08-relation-records.md](08-relation-records.md), Regel 3 |
| Eingebettet oder eigenes Relation-Item? | Forward/Reverse-Regeln | [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md) |

Regeln:

1. Ein `relations`-Eintrag besteht aus `predicate`, `itemRole` und `otherKind` (was am anderen Endpunkt steht: `person`, `place`, `item`, …); der Schlüssel ist das Paar (`predicate`, `itemRole`). `itemRole` ist `"from"`, `"to"` oder `"either"`:
   - `"from"` / `"to"` für gerichtete Kanten — welche Rolle **dieses Item** hat. Beide Rollen desselben Prädikats DÜRFEN am selben Typ koexistieren: `task` deklariert `{ blocks, from, task }` **und** `{ blocks, to, task }`, denn ein Task kann blockieren und blockiert werden.
   - `"either"` für symmetrische Prädikate — `person` → `{ knows, either, person }`. Eine symmetrische Kante hat keine Richtung; 08 kanonisiert ihre Endpunkte gerade deshalb. `"either"` und `"from"`/`"to"` schließen sich für dasselbe Prädikat am selben Typ aus (Konflikt), und `itemRole` MUSS zur Symmetrie-Deklaration der Relation-Typ-Definition passen: symmetrisch ⇒ `"either"`, gerichtet ⇒ `"from"`/`"to"`.

   Beispiele, nichtnormativ: `task` → `{ assignedTo, from, person }`; `statement` → `{ votesOn, to, person }` (eingehende Stimmen; das `vote`-Widget weiß darüber, dass es Records **zu** diesem Item abfragt). Welches Widget eine Kante bedient, deklariert das Darstellungs-Register (`edges`, gleicher Schlüssel) — Kanten ohne Widget entstehen anderswo, z.B. per Karten-Pick oder Modul-Interaktion. Normativ wird ein Prädikat erst durch seine Relation-Typ-Definition.
2. `otherKind` bindet an die Target-Konventionen aus 04: `person` persistiert als `global:`-Target (User-Id oder DID), item-artige Kinds (`place`, `project`, …) als `item:` bzw. `space:{id}/item:`. Composer und Abfrage leiten die Target-Form der Gegenstelle aus `otherKind` ab, nie umgekehrt.
3. Das Typ-Register definiert **keine** Prädikat-Semantik. Gerichtetheit, Symmetrie und Sichtbarkeit eines Prädikats gehören in die Relation-Typ-Definition (08, Regel 3) — heute App-Konfiguration, Ziel ist die versionierte RelationTypeDefinition im Space. Ein Prädikat, das im Typ-Register auftaucht, MUSS dort definiert sein.
4. Ob eine Kante eingebettet (`item.relations[]`) oder als Relation-Record persistiert wird, entscheiden die Forward/Reverse-Regeln aus 04 und 08 (Regel 9) — nicht das Typ-Register. Das Manifest deklariert die Möglichkeit; `EdgeEntry.storage` hält den Mechanismus fest, den diese Regeln vorgeben, damit Lese- und Schreibform wissen, wo die Kante liegt.
5. Personen-Kanten sind ein Fall unter vielen, kein Sonderfall: `peopleRelation` aus `ContentTypeConfig` geht auf in einem Manifest-Eintrag `{ assignedTo, from, person }` plus einem `EdgeEntry` mit `widget: "people"` im Darstellungs-Register. Ein Typ KANN mehrere Personen-Kanten führen (`peopleRelations`, siehe [shared-components.md → Personenfelder](modules/shared-components.md)) — je Kante ein eigenes Feld, alle über dieselbe Widget-Zuordnung.

#### Nicht-Ziele des Registers

- Modul-Aktivierung (feldbasiert, s.o.)
- Capabilities, Rechte, Interaktions-Verfügbarkeit
- Karten-/Panel-Markup (Sache der Flächen; das Register liefert Slot-Inhalte)
- Feld-Validierung (Sache der Schemas)
- Relation-Gültigkeit (Prädikate bleiben offen; das Register listet Affordances)

## Vocabulary-Registry

### Phase 1: zentral hosted (Standard für v0.1)

RLS-Vokabulare sind als JSON-LD und JSON-Schema unter `https://real-life-stack.org/vocab/{name}/v{version}` erreichbar:

- `https://real-life-stack.org/vocab/base/v1` — Basis-Item-Felder
- `https://real-life-stack.org/vocab/place/v1` — geografische Position
- `https://real-life-stack.org/vocab/event/v1` — Zeitpunkt + Dauer
- `https://real-life-stack.org/vocab/task/v1` — Status, Assignee
- `https://real-life-stack.org/vocab/person/v1` — Profil-Felder
- `https://real-life-stack.org/vocab/relation/v1` — eigenständige RelationRecords
- `https://real-life-stack.org/vocab/project/v1` — Projekt-Felder
- `https://real-life-stack.org/vocab/resource/v1` — Ressourcen-Felder
- `https://real-life-stack.org/vocab/statement/v1` — Klasse `statement`: Aussage zur Gruppen-Stellungnahme (Resonance); keine eigenen Felder, verlangt `base/v1 title`; aktiviert über die Affordanz `votesOn` im Manifest, nicht über `@context`

Jede Vocabulary-URL liefert:

1. Eine JSON-LD-Context-Datei `context.jsonld` — definiert Property-Namen und Datentypen
2. Eine JSON-Schema-Datei `schema.json` — erlaubt formale Validierung
3. Optional `examples/valid/*.json` — well-formed Beispiel-Items für Tooling und Tests

Connectoren und UI-Code dürfen Vocabularies cachen. Versionierung erfolgt über den `/v{n}/`-Pfad-Segment; nicht-rückwärtskompatible Änderungen erzwingen eine neue Major-Version.

### Phase 2: verteilte Registry (offen für spätere Migration)

Späterer Migrationspfad zu einer dezentralen Registry ist konzeptuell vorgesehen, aber außerhalb der v0.1-Spec:

- **Option B:** Vocabularies als Items in einem dedizierten Schema-Space (`type: "vocabulary"`)
- **Option C:** URN-basierte Identifier (`urn:rls:vocab:event:v1`) mit pluggable Resolver (zentral, P2P, content-addressed)

Bestehende `@context`-URLs behalten ihre Gültigkeit, nur die Auflösungs-Schicht ändert sich.

## Standardvokabulare (v0.1)

Diese Vokabulare gehören zum RLS-Core und werden von Standard-Modulen erwartet.

### `base/v1`

Wird **immer** als erstes `@context` geführt. Definiert:

- `id`, `createdAt`, `createdBy`, `data`
- `title` (String) — Anzeigetext, Default-Sortier-/Suchfeld
- `description` (String) — längere Beschreibung, optional Markdown

### `place/v1`

- `position` (GeoJSON-Geometry, mindestens `Point`)
- `address` (String, optional)
- `locationName` (String, optional)

Aktivierung durch Map-Modul: Items mit `data.position` werden auf der Map gerendert; konsequente `@context`-Nutzung würde `hasSchema: ['…/place/v1']` als äquivalenten Filter erlauben (siehe „Verhältnis zwischen Schema- und Feldfiltern" unten).

### `event/v1`

- `start` (ISO-8601-DateTime **mit UTC-Offset**, z. B. `2026-09-19T14:00:00+02:00`, oder -Date `2026-09-19` für ganztägig) — Beginn
- `end` (gleiche Form, optional) — Ende

Ein Zeitpunkt trägt den Offset des Autors: jeder Leser sieht denselben Augenblick, die Wanduhrzeit des Autors bleibt ablesbar. Ein Datum ohne Uhrzeit ist ganztägig und ohne Zone. Werte ohne Offset aus älteren Items werden in der Zone des Lesers gedeutet und beim nächsten Speichern mit Offset geschrieben. (Entschieden 2026-09-19; eine eigene Zonenangabe für Wiederholungen über Zeitumstellungen hinweg bleibt offen.)
- `duration` (ISO-8601-Duration, optional; gegenseitig exklusiv mit `end`)
- `rrule` (RFC 5545 RRULE-String, optional)
- `meetingLink` (URL, optional) — siehe Discussion zur Frage „wohin gehört Online-Treffen"

Aktivierung durch Calendar-Modul.

### `task/v1`

- `status` (Enum: `open` | `in-progress` | `done` | `archived`)
- `assignee` (Identifier wie `createdBy`, optional; Einzelwert oder Array für mehrere)
- `dueAt` (ISO-8601-DateTime, optional)
- `priority` (Integer ≥ 0, optional)
- `order` (Integer ≥ 0, optional) — modul-spezifischer Sortier-Index, primär für Kanban innerhalb einer Status-Spalte. Andere Views (Feed, Calendar) ignorieren ihn. Kandidat für ein eigenes kanban-Vokabular in einer späteren Version.

Aktivierung durch Kanban-Modul.

### `person/v1`

- `displayName` (String)
- `avatarUrl` (String, optional)
- `bio` (String, optional)

Aktivierung durch Contacts/Profile-View.

Weitere Vokabulare können von Connectoren oder Modulen ergänzt werden.

## DataInterface-Erweiterungen

`ItemFilter` wird um ein schema-orientiertes Filter-Feld ergänzt:

```ts
interface ItemFilter {
  // ... bestehende Felder (type, hasField, createdBy, source, limit, offset)
  hasSchema?: string[]    // alle genannten @context-Vokabulare müssen aktiv sein
}
```

Bedeutung: Item ist nur Match, wenn sein `@context` jede der genannten URLs enthält.

Der analoge `hasTag`-Filter ist in [07-tags.md](07-tags.md) definiert.

`type` bleibt im Filter erhalten — für **User-Filter** (siehe „Die Rolle von `type`"), nicht als Struktur- oder Aktivierungsfilter.

### Verhältnis zwischen Schema- und Feldfiltern

Module aktivieren ein Item primär **feldbasiert** (das benötigte Feld ist in `data` vorhanden), weil das die Wahrheit über die Renderbarkeit ist. `hasSchema` ist ein **schnellerer Vorfilter** im Connector, der das gleiche Ergebnis liefert, wenn Vocabularies konsistent angewendet werden:

- Map zeigt Items mit `data.position` (= entspricht `hasSchema: ['…/place/v1']` falls Items das Vocab korrekt deklarieren)
- Calendar zeigt Items mit `data.start` (= entspricht `hasSchema: ['…/event/v1']`)
- Kanban zeigt Nicht-Relation-Items mit einem verwertbaren konfigurierten
  `data[statusField]`, dessen Wert einer konfigurierten Spalte entspricht;
  beim Standard `statusField: 'status'` entspricht das `hasSchema:
  ['…/task/v1']` für Task-Items. `archived` gehört nicht zu den Default-
  Spalten und erscheint daher ohne explizite Konfiguration nicht.

Für Vokabulare mit eigenem Feld gilt: Da `@context`-Konsistenz nicht erzwingbar ist, **müssen Module den Feldfilter verwenden** und dürfen `hasSchema` nur als zusätzliche Optimierung anbieten.

**Klassen ohne eigenes Feld** aktivieren über ihre im Manifest deklarierte **Affordanz**, nicht über `hasSchema` (siehe „Die Rolle von `type`" und „Klassen haben IRIs"). Der Connector-Filter dafür ist `type`, verglichen gegen die Klassen, deren Manifest die Affordanz trägt — der Host leitet die Liste aus dem Manifest ab (Spec 01, Ladevertrag), kein Modul zählt sie auf. `hasSchema` bleibt, was es für alle anderen ist: ein schnellerer Vorfilter, nie die einzige Wahrheit.

*Bis zum 21.09.2026 stand hier die Ausnahme „Marker-Vokabular": ein Vokabular ohne eigene Begriffe, das nur in `@context` stand, um eine Intention zu markieren, mit `hasSchema` als einzigem Filter. Es gab genau eines, `statement/v1`. Es ist entfallen — die Klasse steht in `@type`.*

> **Status:** `hasSchema` ist implementiert: `matchesFilter` in `data-interface` prüft, dass alle gelisteten Vokabulare in `@context` aktiv sind; die lokal filternden Connectoren (Local, Mock, WoT) erben das, der GraphQL-Pfad transportiert Filter und `@context` end-to-end.

## Modul-Konsequenzen

| Modul | Primärer Filter (heute) | Optimierung (sobald implementiert) | Was es zeigt |
|---|---|---|---|
| Map | `hasField: ['position']` | `hasSchema: ['…/place/v1']` | alles räumlich Darstellbare |
| Calendar | `hasField: ['start']` | `hasSchema: ['…/event/v1']` | alles zeitlich Darstellbares |
| Kanban | konfiguriertes `hasField: [statusField]` (Default: `['status']`) plus Spaltenwert-Prüfung | bei Default `hasSchema: ['…/task/v1']`; bei anderem Feld keine Task-Vokabular-Annahme | Nicht-Relation-Items mit verwertbarem konfiguriertem Spaltenfeld; `archived` nur bei expliziter Spalte |
| Feed | kein Feldfilter — jedes Item mit eigener Karte | — | alles Neue im Space |
| Resonance | `type` in den Klassen, deren Manifest `votesOn` deklariert (heute: `statement`) | `hasSchema: ['…/statement/v1']` | Aussagen zur Gruppen-Stellungnahme |
| Contacts | `hasSchema: ['…/person/v1']` | — | Personen-Profile |

Ein Item mit mehreren Schemas erscheint in jedem zuständigen Modul gleichzeitig. Jedes Modul rendert nur den Schema-Anteil, den es kennt.

Der Feed ist als einziger Eintrag der Tabelle **keine feldaktivierte Sicht**, sondern eine aggregierende (oben, „Verhältnis zwischen Schema- und Feldfiltern", zusammen mit der Suche): er beantwortet „was ist hier neu", nicht „welches Feld kann ich rendern". Deshalb MUSS er alle Items des Scopes zeigen, die dort einen eigenen Eintrag bilden, und darf sie nicht nach Feldern oder Typen auswählen. Keinen eigenen Eintrag bilden ausschließlich die System-Typen (`comment`, `reaction`, `relation` — sie werden über das Item gelesen, zu dem sie gehören) und `feature` als Geometrie-Marker; das Prädikat dafür ist `isAggregateVisibleItemType` in `data-interface`.

Das Prädikat beantwortet **nur** die Aggregations-Frage. Es sagt nicht, dass ein solches Item unselbständig wäre: Relation-Records sind nach [08-relation-records.md](08-relation-records.md) eigenständige, autorisierte Datensätze — sie werden nur über die Items gelesen, die sie verbinden, und haben in einer Neuigkeiten-Liste nichts verloren. Und es sagt nichts über die Darstellung: ob eine Fläche aus einem Eintrag eine Karte, eine Zeile oder einen Kartenpin macht, entscheidet sie selbst. Ein Feed, der Typen aufzählt, verliert jeden neuen Typ lautlos — er hat kein Register zu führen.

## Migrationspfad von Utopia-Map

Bestehende Layer-basierte Daten werden so überführt:

1. **Layer-Strukturteil** → entsprechendes Schema im `@context` + `type` (Event-Layer → `event/v1`, `type: "event"`).
2. **Layer-Themenanteil** → Tag. Aus „Layer: Permakultur-Orte" wird ein Tag (`"permaculture"` oder `urn:rls:tag:permaculture`) + `place/v1`-Schema. Tag-Modell siehe [07-tags.md](07-tags.md).
3. **Item-Inhalt** → wird gegen die Schemas validiert; Felder, die in keinem aktiven Schema definiert sind, landen in `data` aber sind nicht offiziell spezifiziert.
4. **Layer-Profile** → Templates (Composer-Vorlagen, referenziert über `type`); die Feldstruktur liefern die Schemas.

Ein Migrations-ETL-Script erzeugt aus Directus-Items neue RLS-Items mit korrektem `@context` und Tags und schreibt sie in den Ziel-Space.

## Nicht-Ziele

Diese Spec definiert **nicht**:

- Vocabulary-Inhalte über die in „Standardvokabulare" genannten hinaus
- Validierungs-Runtime (gehört in `toolkit` oder einen Schema-Validator)
- Tag-Identität, Tag-Display, Tag-Hierarchie (siehe [07-tags.md](07-tags.md))
- Trust-Modell für Vokabular-Definitionen
- Rendering-Details der einzelnen Module (gehören in `modules/{name}.md`)
- Wie genau `@context` URLs aufgelöst werden, wenn die Registry offline ist (Resilience-Strategie ist Connector-Detail)
