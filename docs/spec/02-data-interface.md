# DataInterface Core

**Status:** Normativer Entwurf v0.1

Diese Spec beschreibt den kleinsten gemeinsamen RLS-Vertrag zwischen UI, Hooks und Connectoren. Der Core ist bewusst klein und read-only. Alles, was schreibt, authentifiziert, Gruppen verwaltet, Relations auflöst oder Trust-Daten bereitstellt, liegt in separaten Capabilities.

Code-Referenz: `packages/data-interface/src/index.ts`

## Zweck

`DataInterface` macht RLS backend-agnostisch:

```text
App Shell / Space Modules -> hooks -> DataInterface -> connector -> data source
```

Eine UI-Fläche darf gegen diesen Vertrag arbeiten, ohne zu wissen, ob die Daten aus Mock-Daten, IndexedDB, GraphQL, Supabase, WoT/Yjs oder einer anderen Quelle kommen.

## Core Types

### Item

Ein `Item` ist die generische Datenstruktur des RLS.

```ts
interface Item {
  id: string
  type: string
  createdAt: string
  createdBy: string
  "@context"?: string[]
  schema?: string
  schemaVersion?: number
  data: Record<string, unknown>
  relations?: Relation[]
  tags?: string[]
  _source?: string
}
```

Regeln:

1. `createdAt` ist ein ISO-8601-String, kein `Date`-Objekt.
2. Fachliche Felder liegen in `data`, nicht top-level. Ausnahmen: `@context`, `tags`, `relations` — orthogonale Achsen, nicht Inhalt.
3. `tags` ist eine top-level Liste von String- oder URN-Identifiern. Siehe [07-tags.md](07-tags.md).
4. `type` ist offen. RLS kennt Beispiele wie `task`, `event`, `post`, `place`, `person`, `comment` oder `reaction`, aber Connectoren dürfen weitere Typen liefern.
5. `@context` deklariert die aktiven Vocabularies. Siehe [06-schema-composition.md](06-schema-composition.md).
6. `schema` und `schemaVersion` können maschinenlesbare Schemata anzeigen, sind aber nicht erforderlich.
7. `_source` ist ein optionaler Hinweis auf die Datenquelle; UI darf daraus keine Trust-Aussage ableiten.

### Relation

```ts
interface Relation {
  predicate: string
  target: string
  meta?: Record<string, unknown>
}
```

Relations verbinden Items mit anderen Items, Personen, Spaces oder externen Zielen. Details stehen in [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md).

### Group und User

```ts
interface Group {
  id: string
  name: string
  members?: string[]
  data?: Record<string, unknown>
}

interface User {
  id: string
  displayName?: string
  avatarUrl?: string
}
```

`Group` ist der technische RLS-Begriff. In WoT- und RLNP-Kontexten entspricht das häufig einem Space. Details stehen in [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md).

## Observable

```ts
interface Observable<T> {
  current: T
  subscribe(callback: (value: T) => void): Unsubscribe
  loaded?: boolean
}
```

Regeln:

1. `current` liefert synchron den letzten bekannten Wert.
2. `subscribe()` registriert Änderungen und gibt eine Unsubscribe-Funktion zurück.
3. `loaded` zeigt, ob der **initiale lokale Bestand gelesen** ist. Synchrone Quellen sind ab Erzeugung geladen; eine async Quelle (netz-/persistenzgestütztes `observe`) ist `false`, bis ihr erster Read settled — auch wenn das Ergebnis leer ist. Optional und „loaded by default": `false` heißt lädt-noch, alles andere geladen. So lässt sich **leer-weil-lädt** von **leer-weil-wirklich-leer** unterscheiden (Skeleton vs. Empty-State). Ein async Connector MUSS `loaded` nach Abschluss des ersten Reads setzen (auch bei leerem Resultat).
4. Hooks übersetzen Observables in React State; `isLoading` leitet sich aus `loaded` ab, nicht aus „Liste leer".
5. UI-Flächen sprechen den Connector nicht direkt an, wenn ein Hook existiert.
6. Reaktive Detailregeln stehen in [reaktivitaet.md](reaktivitaet.md).

### Readiness vs. Sync

`loaded` betrifft nur die **lokale Lese-Ebene** („ist der Bestand des Scopes gelesen?"), nicht die Netzwerk-Konvergenz. Bei local-first ist lokal die Wahrheit; das CRDT konvergiert, wann es kann. Drei komplementäre, nicht überlappende Signale:

| Signal | Ebene | Frage |
|---|---|---|
| `Observable.loaded` | Lesen | Initialer lokaler Bestand gelesen? → Skeleton vs. Empty-State |
| `getOutboxPendingCount()` | Schreiben | Wie viele eigene Änderungen warten aufs Netz? → Pending-Badge |
| `isProfileSyncPending()` | Schreiben (Profil) | Läuft gerade ein Profil-Publish? |

Die vierte denkbare Frage — „bin ich gegenüber dem Netz aktuell?" — beantwortet bei local-first bewusst niemand.

## Core Methods

```ts
interface DataInterface {
  init(): Promise<void>
  dispose(): Promise<void>
  getItems(filter?: ItemFilter): Promise<Item[]>
  getItem(id: string): Promise<Item | null>
  observe(filter: ItemFilter): Observable<Item[]>
  observeItem(id: string): Observable<Item | null>
}
```

Regeln:

1. `init()` bereitet den Connector vor. Hooks und Apps dürfen erst danach stabile Daten erwarten.
2. `dispose()` gibt lokale Ressourcen, Subscriptions oder Verbindungen frei.
3. `getItems()` und `getItem()` laden einmalig.
4. `observe()` und `observeItem()` liefern reaktive Sichten.
5. Der Core schreibt nie. Schreiben liegt in `ItemWriter`.
6. Der Core verwaltet keine Auth, Groups, Relations, Contacts, Profile, Messaging oder Confirmations.

## Filter

```ts
interface ItemFilter {
  type?: string
  hasField?: string[]
  hasTag?: string[]
  createdBy?: string
  source?: string
  group?: string
  bbox?: [number, number, number, number]
  limit?: number
  offset?: number
}
```

Mindestbedeutung:

| Feld | Bedeutung |
|---|---|
| `type` | Nur Items mit diesem `type` |
| `hasField` | Nur Items, deren `data` alle genannten Felder enthält |
| `hasTag` | Nur Items, deren top-level `tags` alle genannten Strings enthält (AND, leeres Array matched alle) — siehe [07-tags.md](07-tags.md) |
| `createdBy` | Nur Items dieser Autor-ID |
| `source` | Optionaler Quellenfilter, wenn ein Connector mehrere Quellen unterscheidet |
| `group` | Nur Items dieses Space, unabhängig vom geöffneten Space; siehe [Lesen in einem bestimmten Space](#lesen-in-einem-bestimmten-space-group) |
| `bbox` | Nur Items mit Position innerhalb der Bounding-Box `[west, south, east, north]` (GeoJSON-Längen-/Breitengrade). Viewport-begrenzte Abfrage (v.a. Karte); ein Connector ohne Geo-Index DARF clientseitig filtern, ein backend-gestützter Connector SOLLTE serverseitig einschränken. |
| `limit` / `offset` | UI-Paginierung über eine bereits geladene oder beobachtbare Menge |

`limit` und `offset` sind UI-Optimierungen. Sie ersetzen keine Trust-, Sichtbarkeits- oder Berechtigungslogik.

`bbox` ist der Daten-Seam für skalierende Karten: dieselbe Abfrage liefert lokal (voller Satz, clientseitig gefiltert) wie später backend-gestützt (z.B. GraphQL, serverseitig eingeschränkt) nur die Items im sichtbaren Ausschnitt. Serverseitiges **Clustering** bei sehr großen Mengen (Rückgabe aggregierter Cluster statt Einzel-Items) ist eine **zukünftige, separate Query** und nicht Teil von `ItemFilter` (der `Item[]` zurückgibt) — siehe [modules/map.md](modules/map.md) → Datenquelle.

### Lesen in einem bestimmten Space (`group`)

Ohne `group` liest ein Connector im Scope des geöffneten Space: im Space von `GroupManager.getCurrentGroup()`; ist keiner geöffnet (Übersicht) oder trägt der geöffnete Space `scope: "aggregate"`, in allen zugänglichen Spaces. `group` setzt den Space für eine einzelne Abfrage ausdrücklich. Wer die Menge des geöffneten Space nachträglich nach `getItemGroupId()` filtert, findet in einem anderen Space nichts; das ersetzt `group` nicht.

Regeln:

1. Mit `group` liefern `getItems()` und `observe()` die Items, die im Space `group` liegen und die der Nutzer lesen darf. Das gilt unabhängig davon, welcher Space geöffnet ist und ob einer geöffnet ist. Die übrigen Filterfelder gelten zusätzlich.
2. `group` ist die Id einer Group aus `GroupManager.getGroups()` oder die Id des persönlichen Space (`ItemGroupCapable.getPersonalGroupId()`, „Privat"). Ein unbekannter oder nicht zugänglicher Space ergibt eine leere Menge, nie Items eines anderen Space.
3. Items ohne Space, die ein Connector jedem Space zurechnet (etwa globale `feature`-Items), rechnet er mit `group` genauso zu wie im geöffneten Space.
4. Eine Abfrage mit `group` DARF den geöffneten Space NICHT wechseln (`setCurrentGroup`) und keinen anderen App-Zustand ändern.
5. `observe({ group, … })` MUSS Änderungen in diesem Space melden, auch solange er nicht geöffnet ist. `loaded` gilt wie in [Observable](#observable), Regel 3.
6. `group` versteht nur ein Connector, der es zusagt: `GroupScopeCapable` mit Type Guard `hasGroupScope()` ([03](03-capabilities.md)). Dieselbe Zusage deckt das Anlegen in einem Space ([Anlegen in einem bestimmten Space](#anlegen-in-einem-bestimmten-space)). Ein Connector übergeht unbekannte Filterfelder; ohne die Zusage würde er die Items des geöffneten Space liefern, als wären es die des angefragten. Eine Fläche DARF `group` darum NICHT an einen Connector ohne `hasGroupScope()` geben. Sie zeigt stattdessen, dass sie in diesem Space nicht lesen kann ([shared-components → Space des Formulars](modules/shared-components.md#space-des-formulars)).
7. `hasGroupScope()` und `hasItemGroups()` sind unabhängig. `ItemGroupCapable` beantwortet für ein bekanntes Item, in welchem Space es liegt, und verschiebt es; `GroupScopeCapable` liest die Items eines Space und legt in ihm an. Ein Connector mit `GroupManager` SOLLTE `GroupScopeCapable` erfüllen.

### Anlegen in einem bestimmten Space

```ts
interface GroupScopeCapable {
  readonly groupScope: true
  createItem(item: CreateItemInput, options?: { group?: string }): Promise<Item>
}
```

`ItemWriter.createItem(item)` legt im geöffneten Space an; ist keiner geöffnet, bestimmt der Connector den Space (etwa „Privat"). `options.group` nennt den Space ausdrücklich.

Regeln:

1. Mit `options.group` MUSS der Connector das Item unmittelbar im Space `group` anlegen. Das Anlegen ist atomar: Das Item liegt zu keinem Zeitpunkt in einem anderen Space und ist dort für niemanden sichtbar. Scheitert es, gibt es kein Item.
2. Anlegen und anschließendes `moveItemToGroup` erfüllt Regel 1 nicht und DARF NICHT als Anlegen mit `group` gelten.
3. `group` ist eine Id wie in [Lesen in einem bestimmten Space](#lesen-in-einem-bestimmten-space-group), Regel 2. Ist der Space unbekannt oder darf der Nutzer dort nicht schreiben, lehnt der Connector mit einem Fehler ab und legt nirgends an.
4. Das Anlegen mit `group` DARF den geöffneten Space NICHT wechseln.
5. Eine Fläche DARF `options.group` nur an einen Connector mit `hasGroupScope()` geben. Ein Connector ohne Zusage übergeht das zweite Argument und legte das Item im falschen Space an.

## Ändern eines Items

**Status:** Normativer Entwurf (01.10.2026). Noch nicht umgesetzt; der Übergang steht unten.

Mehrere Personen und Geräte ändern dasselbe Item: eine im Formular, eine andere mit einer Selbstaktion, eine dritte im Modul. Keine Änderung DARF eine andere still überschreiben, die sie nicht gesehen hat. Dafür gibt es drei Stufen. Jede baut auf der vorigen auf. Stufe 1 und 3 gelten für jeden Connector, Stufe 2 ist optional.

### Stufe 1: Nur Geändertes schreiben

```ts
interface ItemPatch {
  /** Merge-Patch der Tiefe 1 (RFC 7386): genannte Schlüssel setzen, `null` löscht. */
  data?: Record<string, unknown>
  /** Änderungen je Kante; eine Kante ist durch (predicate, target) bestimmt. */
  relations?: { add?: Relation[]; remove?: Pick<Relation, "predicate" | "target">[] }
  tags?: { add?: string[]; remove?: string[] }
}

interface ItemWriter {
  patchItem(id: string, patch: ItemPatch, options?: PatchItemOptions): Promise<Item>
}
```

Nach dem Übergang ist `patchItem` der einzige Weg, ein bestehendes Item zu ändern. Es löst `updateItem(id, Partial<Item>)` ab, das `data`, `relations` und `tags` als Ganzes ersetzt ([Übergang](#übergang)).

Regeln:

1. **Ein Patch, kein Ersatz.** `patchItem` ändert nur, was der Patch nennt. Schlüssel von `data`, die der Patch nicht nennt, Kanten, die er weder hinzufügt noch entfernt, und Tags, die er nicht nennt, bleiben, wie sie im gespeicherten Stand sind, nicht wie sie der Schreiber gelesen hat.
2. **`data`.** Der Connector führt `data` zusammen wie `Group.data` ([04 → Space-Metadaten](04-items-relations-groups-spaces.md#space-metadaten), Regel 3): Ein genannter Schlüssel ersetzt den gespeicherten Wert, `null` löscht ihn. Ein Wert, der selbst ein Objekt ist (etwa `position`), wird als Ganzes ersetzt.
3. **Kanten.** `add` fügt eine Kante hinzu. Gibt es die Kante mit demselben `predicate` und `target` schon, ersetzt `add` ihr `meta`. `remove` entfernt sie; eine fehlende Kante zu entfernen ist kein Fehler. Kanten, die der Patch nicht nennt, bleiben.
4. **Tags.** `add` und `remove` wirken je Tag. Ein vorhandenes Tag hinzuzufügen oder ein fehlendes zu entfernen ist kein Fehler.
5. **Atomar.** Ein Patch wirkt ganz oder gar nicht. Das gilt auch, wenn er `data`, Kanten und Tags zugleich ändert (Selbstaktion: Kante und Status in einem `patchItem`, [06](06-schema-composition.md#feld--und-kantenregister), Regel 19).
6. **Das Formular sendet nur Geändertes.** Das Formular merkt sich beim Öffnen den **Ausgangsstand** des Items. Beim Speichern sendet es nur Schlüssel, Kanten und Tags, die sich gegenüber dem Ausgangsstand geändert haben. Hat sich nichts geändert, schreibt es nicht.
7. **Selbstaktionen senden nur ihre Kante und ihren Status.** Eine Selbstaktion schreibt ihre eigene Kante (`add` oder `remove`) und, wo eine Regel es verlangt, den Status-Schlüssel. Ganze `relations` oder ganze `data` sendet sie nicht.
8. **Kein Space im Patch.** Ein Patch verschiebt kein Item. Den Space ändert nur `moveItemToGroup`.
9. **Wer und wann.** Jeder Connector MUSS bei jedem `patchItem` `updatedBy` und `updatedAt` des Items aus der Sitzung setzen. Mehr hält ein Item über seine Änderungen nicht fest: Wer welches Feld geändert hat, regelt dieser Abschnitt nicht (Historie, rls#263).

### Stufe 2: Konflikte erkennen

Stufe 2 ist optional. Ein Connector, der sie nicht meldet, erfüllt Stufe 1 und Stufe 3 trotzdem vollständig.

```ts
interface PatchItemOptions {
  /** Erwartete Werte der geänderten Felder, so wie der Schreiber sie gelesen hat. */
  expect?: {
    data?: Record<string, unknown>
    /** Erwartetes `meta` einer Kante, deren `meta` der Patch ändert; `null` = Kante fehlt. */
    relations?: { predicate: string; target: string; meta: Relation["meta"] | null }[]
  }
}

interface ConditionalWriteCapable {
  readonly conditionalWrite: true
}
```

Regeln:

1. **Der gelesene Stand reist mit.** Wer ein Feld ändert, das er vorher gelesen hat, SOLLTE dessen gelesenen Wert in `expect` mitgeben. Das Formular gibt für jeden geänderten Schlüssel den Wert aus dem Ausgangsstand mit, eine Selbstaktion den frisch gelesenen Wert des Status und ihrer Kante.
2. **Ablehnen statt überschreiben.** Ein Connector mit `hasConditionalWrite()` MUSS vor dem Schreiben prüfen, ob jedes Feld in `expect` im gespeicherten Stand noch den erwarteten Wert hat (Vergleich der Werte nach RFC 8785). Weicht eines ab, lehnt er den ganzen Patch mit einem Konfliktfehler ab, der die abweichenden Felder und ihren gespeicherten Wert nennt. Prüfen und Schreiben sind ein Schritt; dazwischen DARF kein anderer Schreiber schreiben.
3. **Hinzufügen und Entfernen von Kanten und Tags kollidieren nicht.** Sie sind idempotent und vertauschbar. Nur eine Änderung des `meta` einer Kante (etwa des Qualifiers) wird geprüft.
4. **Nur melden, was gilt.** Ein Connector meldet `conditionalWrite` nur, wenn sein Vergleich gegen den Stand läuft, gegen den auch alle anderen Schreiber geprüft werden. Ein Connector, der Schreibvorgänge erst später mit anderen Geräten zusammenführt, prüft nur gegen seinen lokalen Stand; er DARF die Fähigkeit dann NICHT melden. Das gilt für den WoT-Connector (Yjs): Er meldet `conditionalWrite` nicht. Dort schützen Stufe 1 (Yjs führt verschiedene Schlüssel zusammen, weil nur Geändertes geschrieben wird) und Stufe 3 (das Formular zeigt eintreffende fremde Änderungen). Ohne die Fähigkeit übergeht der Connector `expect`, und eine Fläche DARF sich auf keine Ablehnung verlassen.

### Stufe 3: Konflikte zeigen

Regeln:

1. **Das Formular beobachtet sein Item.** Solange ein Formular ein bestehendes Item bearbeitet, beobachtet es dieses Item (`observeItem`).
2. **Fremde Änderungen sichtbar machen.** Ändert sich das gespeicherte Item gegenüber dem Ausgangsstand, zeigt das Formular, welche Felder betroffen sind und wer zuletzt geändert hat (`updatedBy`, `updatedAt` des Items, Stufe 1, Regel 9). Haben seit dem Ausgangsstand mehrere Personen geändert, nennt es nur die letzte.
    - Ein Feld, das der Nutzer nicht geändert hat, zeigt den neuen Wert und einen Hinweis darauf. Der neue Wert wird Teil des Ausgangsstands.
    - Ein Feld, das der Nutzer und jemand anderes geändert haben, ist ein **Konflikt**. Das Formular zeigt beide Werte. Der Nutzer übernimmt den fremden Wert oder behält seinen. Behält er seinen, wird der fremde Wert Ausgangsstand und `expect` dieses Felds.
    - Speichern ist gesperrt, solange ein Konflikt nicht entschieden ist.
3. **Abgelehnt heißt: zeigen.** Lehnt der Connector ein Speichern nach Stufe 2 ab, zeigt das Formular die genannten Felder als Konflikt nach Regel 2. Die Eingaben bleiben.
4. **Gelöscht oder verschoben.** Wird das Item gelöscht oder in einen anderen Space verschoben, während das Formular offen ist, sagt das Formular das. Es speichert nicht in ein gelöschtes Item.

### Übergang

1. `ItemPatch` und `patchItem` kommen dazu. Jeder Connector erfüllt Stufe 1; die geteilte Contract-Suite prüft es.
2. Alle Aufrufer stellen auf `patchItem` um: Formular, Selbstaktionen, Module und Apps. `updateItem` ist ab dann veraltet (`@deprecated`).
3. Ruft niemand `updateItem` mehr auf, entfällt es aus `ItemWriter`.
4. Connectoren mit serverseitigem Schreiben (Supabase) DÜRFEN `ConditionalWriteCapable` erfüllen; Formular und Selbstaktionen geben dann `expect` mit.
5. Das Formular zeigt Konflikte nach Stufe 3.

## Nicht-Ziele

`DataInterface` definiert bewusst nicht:

- das soziale Modell von RLNP,
- Spielregeln des Real Life Game,
- WoT-Kryptografie oder Attestation-Formate,
- Auth- und Account-Lebenszyklen,
- Schreib-, Sync-, Delivery- oder Retry-Status.

Diese Fähigkeiten werden über Capabilities, Connectoren oder andere Repositories beschrieben.
