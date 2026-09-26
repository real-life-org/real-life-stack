# Relation Records

**Status:** Normativer Entwurf v0.1 (P0 der Netzwerk-App, stack-weit gültig)

Diese Spec definiert Relationen als eigenständige, autorisierte Datensätze
(RelationRecords) und den Vertrag `RelationStoreCapable`. Sie ergänzt die
eingebetteten Relations aus [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md)
und ersetzt sie nicht.

Code-Referenzen:

- `packages/data-interface/src/index.ts` (`Relation`, `RelationCapable`)
- [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md) (Target-Konventionen, Forward/Reverse-Regel)
- [05-confirmations-and-trust.md](05-confirmations-and-trust.md) (`ConfirmationView`, Trust-Level)

## Motivation

Eingebettete Relations (`item.relations[]`) gehören dem Item, das sie trägt:
kein eigener Autor, keine eigene Berechtigung, kein explizites `from`, keine
eigene Beobachtbarkeit. Für Kanten, die selbst Inhalt sind (knows, attends,
partOf), gilt deshalb die bestehende Regel aus 04: eigenständige, wachsende
Inhalte werden eigene Datensätze — so wie Kommentare und Reaktionen bereits
eigene Items sind.

RelationRecords führen dabei keine zweite Pointer-Syntax ein: ihre
Endpunkte sind selbst eingebettete Relations. Es gibt im Stack genau einen
Ort für Item-Referenzen (`item.relations[]`) und ein Reifikations-Muster
(eigenes Item + eingebettete Relation), das Kommentare und Reaktionen
bereits verwenden — hier angewandt auf Kanten.

## RelationRecord als Item

Ein RelationRecord ist ein Item mit `type: "relation"`. Es gibt keinen
zweiten Persistenz-Pfad und keine zweite Pointer-Syntax: die Endpunkte
liegen als eingebettete Relations im Relation-Item, so wie die Verbindung
eines Kommentars zu seinem Post.

```ts
// Item im Space-Doc
{
  id: "rel-8f2a",
  type: "relation",
  createdBy: "did:key:z6Mk...",   // Autor der Kante
  createdAt: "2026-07-15T10:00:00Z",
  data: {
    predicate: "knows",
    level: "met",                  // domänenspezifisches Kanten-Feld, flach
    confirmationRef: "conf-123"    // optional, s. Trust-Bindung
  },
  relations: [
    { predicate: "from", target: "item:person-anton" },   // Target-Konventionen aus 04
    { predicate: "to",   target: "item:person-kaliya" }
  ]
}
```

Regeln:

1. Ein RelationRecord ist ein Item mit `type: "relation"`. Alle Item-Verträge
   (ItemWriter, AuthorizationCapable, ItemGroupCapable, Sync, Activity-Log,
   Mirror/Bridge) gelten unverändert.
2. Die Endpunkte liegen als eingebettete Relations mit den reservierten
   Prädikaten `from` und `to` in `relations[]` — genau ein Eintrag je
   Prädikat. Die Targets MÜSSEN den Target-Konventionen aus 04 folgen
   (`item:`, `space:{id}/item:`, `global:`).
3. `predicate` ist offen. Gerichtetheit und Symmetrie deklariert die
   Relation-Typ-Definition der App, nicht der Record. Bei symmetrischen
   Prädikaten MÜSSEN die Endpunkte kanonisch geordnet gespeichert werden
   (lexikographisch: `from` ≤ `to` als Target-String). Spiegel-Records sind
   damit strukturell ausgeschlossen, auch bei gleichzeitiger
   Offline-Erzeugung. Die Symmetrie-Deklaration als lokale App-Konfiguration
   ist eine Übergangslösung (P1b); Ziel ist eine **versionierte
   RelationTypeDefinition im Space** (Malleable-Phase), damit alle Clients
   eines Space garantiert dieselbe Kanonisierung anwenden.
4. Die Item-`id` MUSS deterministisch aus dem Tupel
   `(createdBy, predicate, from, to)` abgeleitet werden:
   `"rel-" + hex(sha256(JCS([createdBy, predicate, from, to])))` — die
   vier Strings als JSON-Array, serialisiert nach **RFC 8785 (JCS)**,
   UTF-8. Die Array-Form ist eindeutig (eine `\n`-Verkettung wäre es
   nicht, solange Komponenten Zeilenumbrüche enthalten dürfen) und
   konsistent mit der Snapshot-Kanonisierung in 09. Keine
   Unicode-Normalisierung (kein NFC/NFD, kein Trimming, kein
   Case-Folding); `hex` ist **lowercase**. Nur so erzeugen alle
   Connectoren für dasselbe Tupel dieselbe `id`.
   **ID-Scope:** Relation-IDs sind **space-lokal** wie alle Item-IDs
   (`item:`-Targets sind relativ zum Space, dasselbe Tupel in zwei Spaces
   ist zwei verschiedene Kanten); `spaceId` gehört NICHT in den Hash.
   Jeder space-übergreifende Index MUSS deshalb den zusammengesetzten
   Schlüssel `(spaceId, id)` verwenden (vgl. 09, Invariante 1).
   Damit konvergieren offline doppelt erzeugte Kanten desselben Autors auf
   denselben Record, und pro Autor existiert höchstens ein Record je Tupel.
   Records verschiedener Autoren über dieselben Endpunkte bleiben bewusst
   getrennt (perspektivischer Graph). Konsequenz: der Schreibpfad MUSS für
   Relation-Items client-bestimmte `id`s akzeptieren (additive Erweiterung
   von `ItemWriter.createItem`, s. Fassaden-Regel 2).
5. `predicate`, `from` und `to` sind nach Erstellung unveränderlich (sie
   definieren die `id`). Umhängen ist Delete + Create. Veränderbar sind nur
   die domänenspezifischen Kanten-Felder in `data` und `confirmationRef`.
6. Domänenspezifische Kanten-Felder (z. B. `tense: "coming"`) liegen flach
   in `data.*`, wie überall im Stack (04: gemeinsame Felder liegen in
   `data`) — `hasField`-Filter, Schema-Validierung und Editoren arbeiten
   ohne Sonderfall. Die Vertragsfelder `predicate`, `confirmationRef` und
   `claim` (s. „Autorbindung: SignedClaims“) sind reserviert; neue
   Vertragsfelder kommen nur mit einer neuen Vokabular-Version
   (`relation/v2`), nie still in `v1`.
7. Ein RelationRecord SOLLTE im selben Space liegen wie sein `from`-Ziel.
   Endpunkte in anderen Spaces werden über `space:{id}/item:` adressiert.
8. Records mit nicht auflösbaren oder fehlerhaften Endpunkten (kein oder
   mehr als ein `from`-/`to`-Eintrag) MÜSSEN von Leseflächen ignoriert
   werden (kein Crash, keine Phantom-Knoten). Aufräumen ist eine explizite
   Handlung des Autors bzw. der App, kein impliziter GC.
9. Eingebettete Relations bleiben für wenige, feste Forward-Beziehungen
   erlaubt (04): Anzahl durch die Item-Definition begrenzt, gesetzt vom
   Item-Autor beim Editieren (z. B. `assignedTo`). Kanten MÜSSEN
   RelationRecords sein, wenn ihre Menge mit der Nutzung unbegrenzt wächst
   (jede neue Kante schriebe sonst das Trägeritem um) oder wenn sie einen
   anderen Autor als das Trägeritem haben. Feste Beziehungen DÜRFEN
   ebenfalls als Records geführt werden (die Netzwerk-App tut das für alle
   Relationsarten, auch `takesPlaceAt`).
10. Relation-Items SOLLTEN das Vokabular `relation/v1` deklarieren
    (`@context`, s. [06-schema-composition.md](06-schema-composition.md));
    die Schema-Definition folgt in `schemas/vocab/relation/v1/` (validiert
    u. a. genau einen `from`- und einen `to`-Eintrag, die ID-Regel und die
    reservierten Vertragsfelder `predicate`/`confirmationRef`/`claim`).

## RelationRecordCapable und RelationRecordWriterCapable (der „RelationStore")

```ts
interface RelationRecord {
  id: string
  predicate: string
  from: string
  to: string
  /** alle domänenspezifischen data-Felder (flach gespeichert, ohne die
      Vertragsfelder predicate/confirmationRef/claim) */
  fields?: Record<string, unknown>
  confirmationRef?: string
  /** kompakte SignedClaim-JWS (s. „Autorbindung: SignedClaims") — eigenes
      Feld, nie Teil von fields */
  claim?: string
  createdBy: string
  createdAt: string
}

interface RelationRecordInput {
  predicate: string
  from: string
  to: string
  fields?: Record<string, unknown>
  confirmationRef?: string
}

/** predicate/from/to sind immutable (Regel 5) — Update nur für den Rest.
    fields ersetzt vollständig; confirmationRef: null entfernt die Referenz. */
interface RelationRecordUpdate {
  fields?: Record<string, unknown>
  confirmationRef?: string | null
}

interface RelationRecordFilter {
  predicate?: string
  from?: string
  to?: string
  /** matcht Records, deren from ODER to gleich diesem Target ist */
  endpoint?: string
}

// Lesen und Schreiben sind getrennte Capabilities (analog Confirmations, 05)
interface RelationRecordCapable {
  getRelationRecords(filter?: RelationRecordFilter): Promise<RelationRecord[]>
  observeRelationRecords(filter?: RelationRecordFilter): Observable<RelationRecord[]>
  /**
   * Projektion „Endpunkt → verbundene Items über RelationRecords".
   * `endpoint` in Target-Schreibweise (04). RelationCapable leistet das
   * NICHT (s. Regel 6).
   */
  getRelationNeighbors(endpoint: string, predicate?: string): Promise<Item[]>
  observeRelationNeighbors(endpoint: string, predicate?: string): Observable<Item[]>
}

interface RelationRecordWriterCapable {
  createRelationRecord(input: RelationRecordInput): Promise<RelationRecord>
  updateRelationRecord(id: string, updates: RelationRecordUpdate): Promise<RelationRecord>
  deleteRelationRecord(id: string): Promise<void>
}
```

Regeln:

1. `RelationRecord` ist die typisierte Projektion des Relation-Items: die
   Endpunkt-Relations werden auf die Strings `from`/`to` abgebildet, die
   domänenspezifischen `data`-Felder (alles außer den Vertragsfeldern
   `predicate`, `confirmationRef` und `claim`) auf `fields`; `data.claim`
   wird auf das eigene Feld `claim` projiziert und erscheint NIE in
   `fields`. Der RelationStore ist eine Fassade,
   kein eigener Speicher. Lesen und Schreiben sind getrennte Capabilities
   (analog Confirmations, 05): read-only Connectoren bieten nur
   `RelationRecordCapable`, ohne Schreib-Stubs.
2. Der Vertrag MUSS durch eine generische Default-Implementierung über
   `DataInterface` + `ItemWriter` erfüllbar sein
   (`observe({ type: "relation" })` + Projektion + Filter). Connectoren
   DÜRFEN mit indizierten Implementierungen überschreiben. **Damit die
   deterministische `id` schreibbar ist, wird `ItemWriter.createItem`
   additiv erweitert:** das Eingabe-Item DARF eine `id` mitbringen
   (`Omit<Item, "id" | "createdAt"> & { id?: string }`; Code-Änderung in
   `data-interface`, P1b). Connectoren, die RelationStore anbieten, MÜSSEN
   eine mitgelieferte `id` für Relation-Items übernehmen. Existiert die
   `id` bereits, MUSS `createItem` das bestehende Item unverändert
   zurückgeben (idempotent; eine inhaltliche Kollision ist ausgeschlossen,
   weil die `id` das identitätsstiftende Tupel hasht).
3. Autor-Quelle: `createdBy` stammt NIE vom Aufrufer — deshalb fehlt es in
   `RelationRecordInput` bewusst. Der Connector setzt `createdBy` aus
   seiner authentifizierten Identität (`Authenticatable`), und die
   deterministische `id` wird aus genau dieser Identität berechnet. Die
   `id`-Berechnung liegt damit im Connector bzw. in der
   Default-Implementierung, nie in der App. Ausnahme: privilegierte
   Fixture-/ETL-Pfade eines Connectors (z. B. Seed-Injection) schreiben
   Relation-Items direkt als Items an der Fassade vorbei; sie MÜSSEN
   dieselbe ID-Regel und Endpunkt-Form anwenden. Laufzeit-Schreibvorgänge
   der App laufen ausschließlich über den auth-gebundenen RelationStore.
4. `createRelationRecord` ist idempotent: existiert der Record des Autors
   zum selben Tupel bereits, wird er unverändert zurückgegeben (Angleichen
   von `fields` ist ein explizites Update). `updateRelationRecord` ändert
   nur `fields`/`confirmationRef`; Umhängen ist Delete + Create.
   Update-Semantik: `fields` ersetzt das Objekt VOLLSTÄNDIG (kein
   Deep-Merge); `confirmationRef: null` entfernt die Referenz;
   `fields`-Schlüssel, die mit Vertragsfeldern kollidieren (`predicate`,
   `confirmationRef`), werden abgelehnt.
5. Type Guards: `hasRelationRecords(c)` und `hasRelationRecordWriter(c)`,
   analog zum Confirmations-Paar in
   `packages/data-interface/src/index.ts` (BaseConnector-Defaults zählen
   nicht als Unterstützung).
6. `RelationCapable` (`getRelatedItems`) bleibt unverändert und operiert
   auf eingebetteten Relations. Es löst RelationRecords NICHT auf:
   `getRelatedItems(person, "knows")` filtert nach `relations[].predicate`,
   Relation-Items tragen dort aber `from`/`to`, und das Kanten-Prädikat
   liegt in `data.predicate` — die Standard-Traversierung fände höchstens
   das Relation-Item, nie die Gegenseite. Die Projektion „Endpunkt →
   verbundene Items" leistet deshalb der RelationStore selbst
   (`getRelationNeighbors`/`observeRelationNeighbors`, ableitbar aus
   Records + `getItem`). UI-Flächen, die Kanten kennen, benutzen den
   RelationStore, nicht `RelationCapable`.
7. Berechtigung: `item/create|edit|delete` über `AuthorizationCapable` auf
   dem Relation-Item; Default creator-owns, keine separaten
   Relation-Berechtigungen. `can()` ist dabei nur UI-Affordance (02/03):
   der Connector MUSS unautorisierte Schreiboperationen auf Relation-Items
   im Schreibpfad selbst ablehnen. Wo das Protokoll keine harte Grenze
   zieht (im CRDT-Space kann jedes Mitglied technisch schreiben), ist die
   Vertraulichkeits-Grenze die Space-Wahl — s. Trust-Bindung Regel 6.

## Qualifier an Personen-Kanten

**Status:** Normativer Entwurf (S0, 26.09.2026).

Ein Qualifier präzisiert eine Personen-Kante mit einem Wert aus einer festen Menge: `assignedTo` mit kann · lernt, die Teilnahme am Event mit zugesagt · vielleicht · eingeladen, `votesOn` mit green · yellow · red. Er ist kein zweites Prädikat.

Regeln:

1. Der Qualifier lebt an der Kante. Aus einem Qualifier wird kein eigenes Prädikat (nicht `assignedTo` und `wantsToLearn` für dieselbe Zuweisung).
2. **Eingebettete Kante:** Der Qualifier liegt als `meta.role` an der Relation (`{ predicate: "assignedTo", target: "global:…", meta: { role: "…" } }`). `meta` ersetzt das Ziel nicht (04, Regel 3).
3. **Eigener Datensatz:** Bei Kanten, die RelationRecords sind (Zusage, Stimme), liegt der Qualifier als Feld in `data` des Records, also in `fields` der Projektion. Den Schlüssel nennt das Register (`EdgeEntry.qualifier.key`). Er heißt `role`, passend zu `meta.role`; `votesOn` behält seinen Bestandsschlüssel `value` ([modules/resonance.md](modules/resonance.md)).
4. Die erlaubten Werte deklariert das Darstellungs-Register je Kante (`EdgeEntry.qualifier.values`, [06 → Feld- und Kantenregister](06-schema-composition.md#feld--und-kantenregister)). Gespeichert wird die `id` des Werts, nie seine Beschriftung.
5. Eine Kante ohne Qualifier ist gültig und wird ohne Qualifier gezeigt.
6. Jedes Mitglied darf den Qualifier einer eingebetteten Kante setzen und ändern, auch für andere Personen. Es schreibt dafür das Trägeritem nach dessen Rechten.
7. **Aussagen über andere sind erlaubt.** Ein Record DARF eine andere Person als `from` tragen als seinen Autor: `createdBy` ist der Sprecher, der ihn signiert, `from` die Person, über die er spricht. Weil die `id` `createdBy` enthält (Regel 4), ist die Aussage eines anderen ein eigener Record neben dem der Person. Ändern und löschen darf jeder nur seine eigenen Records (Fassaden-Regel 7, creator-owns).
8. Leseflächen MÜSSEN eine Aussage über andere als solche zeigen: „Timo zugesagt · eingetragen von Anton". Sie DÜRFEN sie nicht als Selbstaussage der Person ausgeben.
9. **Zählregel.** Wie mehrere Records zur selben Person und demselben Item zusammenwirken, deklariert das Register je Kante (`EdgeEntry.count`):
   - `one-per-person` („eine je Person, eigene gewinnt"): Je Person gilt ihre Selbstaussage (`createdBy` = Identität von `from`). Fehlt sie, gilt die jüngste Aussage eines anderen. Die Person überstimmt jede fremde Aussage durch eine eigene. Form für Zusagen, die in der Zukunft liegen.
   - `collect-accepted` („sammeln, Person nimmt an"): Die Aussagen addieren sich, keine überstimmt eine andere. Öffentlich angezeigt wird eine Aussage über eine Person erst, wenn diese sie angenommen hat ([05 → UI-Regeln](05-confirmations-and-trust.md#ui-regeln), Regel 5, `isAccepted`). Das ist die Form für spätere Teilnahme-Bestätigungen („war dabei, bestätigt von Maria und Jonas"); Bestätigungen selbst regelt 05, nicht dieser Abschnitt.
10. Wer Personen-Kanten neu schreibt (Composer-Mapper), MUSS `meta.role` jeder Person erhalten, deren Kante bestehen bleibt ([shared-components.md → Personenfelder](modules/shared-components.md#personenfelder-people), Regel 6).

### Teilnahme am Event: `attends` und `invited`

1. Eine Zusage ist ein RelationRecord `attends` von der Person (`from`) zum Event (`to`), Zählregel `one-per-person`.
2. `fields.role` trägt den Qualifier: zugesagt oder vielleicht. `fields.tense` trägt die Zeitform wie in der Netzwerk-App ([netzwerk-app.md](netzwerk-app.md)): `coming`, `currently`, `has-been`.
3. „Absagen" löscht den eigenen `attends`-Record.
4. „Eingeladen" ist die eingebettete Kante `invited` am Event (Event → Person). Sie bleibt, wie sie ist; Mitglieder setzen sie nach Regel 6.
5. Das Event zeigt `invited` und `attends` in **einer** Menschen-Zeile. Hat eine Person eine gültige `attends`-Aussage, zeigt die Zeile deren Qualifier statt „eingeladen".
6. `attends` ist im Claim-Katalog `authorial` (siehe „Zwei Profile"): Der Sprecher signiert, nur er ändert.
8. Wer Personen-Kanten neu schreibt (Composer-Mapper), MUSS `meta.role` jeder Person erhalten, deren Kante bestehen bleibt ([shared-components.md → Personenfelder](modules/shared-components.md#personenfelder-people), Regel 6).

## Trust-Bindung

`knows(verified)` trägt keine eigene Kryptografie. Der Nachweis lebt bei den
Confirmations (05), der Graph leitet ab.

Regeln:

1. Ein Verifikationsstatus wird NIE als Feld gespeichert, weder als
   Kanten-Feld in `data` noch anderswo.
2. Ein Record DARF `confirmationRef` tragen: die `id` einer Confirmation
   (`ConfirmationView`, 05).
3. Identitäts-Auflösung eines Endpunkts: ein `global:`-Target ist die
   Identität selbst; ein `item:`-/`space:{id}/item:`-Target liefert die
   Identität aus `data.did` des aufgelösten Items. `data.did` ist ein
   optionales Feld; `person/v1` wird dafür additiv um `did` erweitert.
   Liefert ein Endpunkt keine Identität, ist `verified` nicht ableitbar
   (Regel 5).
4. `verified` gilt genau dann, wenn die referenzierte Confirmation (a) über
   `ConfirmationCapable` auflösbar ist, (b) nicht abgelehnt wurde
   (`isAccepted !== false`) und (c) `issuerId`/`subjectId` den aufgelösten
   Identitäten der beiden Endpunkte entsprechen (Richtung egal). Das
   anzeigbare Vertrauensniveau ist der `trustLevel` der Confirmation.
5. Fehlt die Referenz oder eine Endpunkt-Identität, oder bricht eine
   Bedingung, fällt die Darstellung ohne Fehler auf die niedrigere Stufe
   zurück (z. B. `met`). Widerruf wirkt dadurch automatisch.
6. Sensible Relationen (z. B. `livesAt`) regeln Sichtbarkeit über die Wahl
   des Space und bestehende Berechtigungen, nicht über ein neues
   Krypto-Feld.

## Autorbindung: SignedClaims

**Status:** Normativer Entwurf (rls#209, Interop-Vertrag rls#227). Motivation:
Die Store-Fassade bindet ehrliche Clients an ihre Identität, aber ein geteiltes
CRDT-Dokument ist eine physische Schreibgrenze — ein manipulierter Client eines
Mitglieds kann per rohem `createItem` einen Record mit fremdem `createdBy` und
passender kanonischer ID fälschen. Die Sync-Schicht signiert jedes Update als
Ganzes (Ed25519-JWS über den Log-Eintrag, `authorKid` relay-verifiziert),
verliert diese Bindung aber bei `applyUpdate`, und Snapshot-Bootstraps tragen
kein Log. SignedClaims schließen die Lücke auf Datenebene: die Autorschaft
reist **im Record selbst**.

### Geltungsbereich: Claim-Modi pro Connector

Die Bedrohung existiert nur dort, wo mehrere Schreiber denselben Storage ohne
zentrale Autoritätsprüfung mutieren. Der Vertrag ist deshalb
**capability-gescoped** — jeder Connector hat höchstens einen Claim-Modus:

| Modus | wer | Pflichten |
|---|---|---|
| `signed` | Multi-Writer-Sync ohne zentrale Autorität (WoT/shared CRDT) | MUSS `authorial`-Claims schreiben, re-signieren und verifizieren |
| `authoritative` | Backends mit erzwungener Autorbindung | `trusted` DARF ein Connector NUR beanspruchen, wenn **jeder Ingress-Pfad** seines Stores (`createItem`, Update, Import, Mirror/Bridge) `createdBy` verbindlich an die authentifizierte Identität bindet — das ist MUSS, nicht SOLLTE. Privilegierte Fixture-/Seed-Pfade sind ausgenommen, MÜSSEN aber als solche gekennzeichnet und im Produktionspfad unerreichbar sein (analog Fassaden-Regel 3). |

Ein Connector, der keinen der beiden Modi erfüllt (z. B. ein GraphQL-Server,
dessen Store client-gesetztes `createdBy` akzeptiert), hat KEINEN Claim-Modus:
er bietet die Verifikations-Capability nicht an, und seine Records gelten in
authorial-Aggregaten als unverifiziert (Leseregel L1 — fail closed). „Nur ein
Schreiber" allein beweist keine Identitätsbindung. Ein `signed`-Connector ohne
verfügbaren Signer (nicht authentifiziert) MUSS Schreibversuche für
`authorial`-Prädikate ablehnen — nie unsigniert schreiben.

### Verifikations-Capability

Die normative Grenze, über die Leseflächen Verdikte beziehen:

```ts
type ClaimVerdict =
  | "valid"     // signed: Claim vorhanden, Signatur gültig, Payload == Record
  | "invalid"   // signed: Claim fehlt, Signatur/typ/Version falsch, Payload-
                //         oder ID-Mismatch, fremder Signer
  | "trusted"   // authoritative: der Store erzwingt die Autorbindung (MUSS)

interface ClaimVerificationCapable {
  /** Verdikt für einen projizierten Record. Deterministisch und cachebar:
      (record.id, contentHash(record)) → Verdict ändert sich für unveränderte
      Records nie. */
  verifyRecordClaim(record: RelationRecord): Promise<ClaimVerdict>
}

function hasClaimVerification(c: DataInterface): c is DataInterface & ClaimVerificationCapable
```

Regeln:

1. `signed`- und `authoritative`-Connectoren MÜSSEN die Capability anbieten;
   `authoritative` antwortet konstant `trusted`, `signed` prüft kryptografisch.
   Connectoren ohne die Capability liefern kein Verdikt — ihre Records sind in
   authorial-Aggregaten unverifiziert (L1).
2. Der Verdikt-Cache liegt beim Connector. Die **Re-Emission** liegt beim
   Aggregator: sein abgeleitetes Observable (z. B. die Vote-Summary) MUSS nach
   Abschluss ausstehender Verifikationen erneut emittieren; die Record-Streams
   (`observeRelationRecords`) selbst bleiben verdikt-frei.
3. Die `RelationRecord`-Projektion wird additiv um `claim?: string` (die
   kompakte JWS) erweitert — als eigenes Feld, nie in `fields` (s. Primitive).

### Das Primitive

Ein SignedClaim ist eine kompakte Ed25519-JWS nach den bestehenden
WoT-Konventionen (kein neues Signaturformat, s. Nicht-Ziele):

- **Header:** `{ "alg": "EdDSA", "typ": "rls-claim+jws", "kid": "<createdBy>#sig-0" }` —
  `typ` ist die Domänentrennung gegen jede andere JWS-Anwendung des Stacks.
- **Payload:** JCS-kanonisiert (RFC 8785), exaktes Schema s. u.
- **Signer:** die Identität des Autors (im WoT-Connector die interne
  `IdentitySession`; die generische Default-Fassade nimmt Signer/Verifier als
  Option entgegen — `signed`-Connectoren injizieren sie, `authoritative` nicht).
- **Verifikation MUSS prüfen:** `typ`-Header, gültige Signatur unter dem aus
  `kid` aufgelösten Schlüssel (did:key: rein lokal auflösbar),
  `didOrKidToDid(kid) === payload.createdBy`, Payload-Version, dass jedes
  Payload-Feld dem gespeicherten Record entspricht (Mismatch = ungültig),
  UND dass `record.id` der kanonischen ID-Regel 4 für
  `(createdBy, predicate, from, to)` entspricht — ein Record unter falschem
  Schlüssel ist ungültig, auch mit intakter Signatur.

Der Claim wird als Vertragsfeld `data.claim` gespeichert (reserviert wie
`predicate`/`confirmationRef`, Fassaden-Regel 6) und ist damit aus jedem
Storage- und Sync-Pfad re-verifizierbar — auch nach Snapshot-Bootstrap.
`relationRecordFromItem` MUSS `claim` aus `fields` ausfiltern (wie die anderen
Vertragsfelder); `claim` erscheint NIE im signierten Payload — das Payload ist
nie selbstreferenziell.

### Payload-Schema `rls-claim/1` (relation-authorial)

```json
{
  "v": "rls-claim/1",
  "profile": "relation-authorial",
  "id": "rel-…",
  "predicate": "votesOn",
  "from": "global:did:key:…",
  "to": "item:…",
  "fields": { },
  "confirmationRef": null,
  "createdBy": "did:key:…",
  "createdAt": "2026-08-04T12:00:00.000Z"
}
```

Regeln des Schemas (Interop-Vertrag, rls#227):

1. **Alle zehn Member sind IMMER präsent.** `fields` ist `{}` wenn leer und
   enthält `data` OHNE die Vertragsfelder `predicate`/`confirmationRef`/`claim`;
   `confirmationRef` ist `null` wenn nicht gesetzt. Kein optionales Weglassen —
   Verifier vergleichen strukturgleich.
2. Zulässige Werte sind **I-JSON** (RFC 7493): Strings, endliche Zahlen,
   Boolean, `null`, Objekte, Arrays; kein `undefined`, keine Nicht-UTF-8-Keys.
   JCS kanonisiert genau diese Menge deterministisch.
3. `v` versioniert das Schema; unbekannte Versionen sind für Verifier
   **ungültig** (fail closed), neue Versionen kommen nur additiv als
   `rls-claim/2`.
4. Kanonische **Testvektoren** (positiv und negativ: Create, Update,
   Feld-Mismatch, fremder Signer, falscher `typ`, Snapshot-Reverifikation)
   liegen unter `schemas/claims/vectors/` und sind für Implementierungen
   verbindlich.

### Zwei Profile

Welches Profil ein Prädikat trägt, kommt in v0.1 aus dem **geschlossenen
Katalog dieser Spec** — nicht aus Space-Daten, damit kein manipulierter oder
abweichend konfigurierter Client denselben Record anders einstufen kann. Die
künftige space-definierte RelationTypeDefinition MUSS das Feld `claimProfile`
tragen und DARF Katalog-Einträge nicht überschreiben (additiv wie das
Typ-Register, 06).

| Profil | Payload | Mutation | Katalog v0.1 |
|---|---|---|---|
| `authorial` | `relation-authorial` (Identität **+ Inhalt** inkl. `fields` und `confirmationRef`) | nur der Autor; jedes `updateRelationRecord` (auch `confirmationRef`-Änderung) MUSS re-signieren | `votesOn`, `knows`, `connectedWith`, `takesPlaceAt`, `attends` |
| `structural` | kein Record-Claim; als eigenständiges Relation-Item trägt der Record den **Item-Herkunfts-Claim** (unten) | kollaborativ | — (heute keine Record-Prädikate; eingebettete `assignedTo`/`invited`/`blocks`/`childOf` deckt der Herkunfts-Claim des Trägeritems) |
| `item-authorial` | Item-Claim über Identität **+ Inhalt** einer Aussage einer Person (unten) | nur die Autorin; jede Änderung des Inhalts MUSS neu signieren | Items der Typen `statement`, `comment`, `reaction` |

**Exklusivität (ein Claim pro Datensatz):** `data.claim` trägt genau EINEN
Claim — kein Array, keine parallelen Felder. Ein `authorial`-Record trägt
ausschließlich `relation-authorial`; er ERSETZT den Herkunfts-Claim, dessen
unveränderliche Felder (`id`, `createdBy`, `createdAt`) er bereits mitbindet.
Items eines Typs aus dem Katalog der Aussagen einer Person tragen
ausschließlich `item-authorial` (unten). `structural`-Records und alle übrigen
Items tragen (mit dem Item-Provenance-Slice) `item-provenance`. Verifier dispatchen anhand
`payload.profile`; ein Profil, das nicht zur Datensatz-Klasse passt
(`item-provenance` auf einem Katalog-`authorial`-Record oder
`relation-authorial` außerhalb von Relation-Records), ist `invalid`.

Prädikate außerhalb des Katalogs haben KEIN definiertes Claim-Profil:
`signed`-Connectoren MÜSSEN Schreibversuche dafür ablehnen, solange kein
Katalog-/Definitionseintrag existiert; Leseflächen behandeln vorhandene Records
solcher Prädikate wie unverifizierte (Regel L2).

**Item-Herkunfts-Claim** (`profile: "item-provenance"`, Gegenstück für
kollaborative Objekte, Umsetzung separat): Payload
`{ "v": "rls-claim/1", "profile": "item-provenance", "id", "type", "createdBy", "createdAt" }` —
nur die unveränderlichen Felder. Beglaubigt die Herkunft, überlebt jeden
legitimen Fremd-Edit (zwei parallel gemergte Edits hätten keinen Zustand, den
je jemand signiert hat). Er gilt für alle Items, die kein anderes Profil
tragen: nicht für Katalog-`authorial`-Relation-Records (`relation-authorial`)
und nicht für Items eines Katalogtyps der Aussagen einer Person
(`item-authorial`). Eigenständige `structural`-Records bekommen so eine
Herkunftsbindung.

### Aussagen einer Person: `item-authorial`

**Status:** Normativer Entwurf. Manche Items sind die Aussage einer Person:
Was drinsteht, hat jemand gesagt, und nur diese Person darf es ändern. Für
diese Typen signiert die Autorin den Inhalt, so wie bei `relation-authorial`.
Alle anderen Items sind kollaborativ und tragen den Herkunfts-Claim.

**Katalog (geschlossen, v0.1).** Welche Typen Aussagen einer Person sind und
was ihren Inhalt bildet, steht ausschließlich hier und nie in Space-Daten,
damit kein Client einen Typ anders einstufen kann. Zum Inhalt gehören
**Inhaltsfelder** aus `data` und **Inhaltsrelationen**: eingebettete
Relationen (`item.relations`), deren Ziel zur Aussage gehört, etwa worauf
sich ein Kommentar bezieht.

| Typ | Inhaltsfelder | Inhaltsrelationen | Beleg erforderlich |
|---|---|---|---|
| `statement` | `title`, `description`, `variantOf` ([modules/resonance.md](modules/resonance.md)) | — | ja |
| `comment` | `content`, `replyTo`, `replyToComment` | `commentOn` | vorerst nein |
| `reaction` | `emoji` | `reactsTo` | vorerst nein |

`post` ist nicht im Katalog und bleibt gemeinsam bearbeitbar (rls#263). Wird
die Einstufung später je Space oder Item konfigurierbar, MUSS sie so gebunden
sein, dass kein Client einen Typ nachträglich zwischen „Aussage einer Person"
und „kollaborativ" umstufen kann.

**Inhalt und Inhalts-Hash.** Der Inhalt eines Items ist das Objekt
`{ "data": …, "relations": … }`:

- `data` enthält die Inhaltsfelder des Typs, jedes aus `data`, fehlende als
  `null`.
- `relations` enthält für jedes Prädikat der Inhaltsrelationen des Typs die
  Liste der Ziele (`target`) aller eingebetteten Relationen mit diesem
  Prädikat, sortiert nach UTF-16-Codeeinheiten wie die Schlüssel in JCS,
  ohne `meta`. Gibt es keine, ist die Liste leer. Ein Typ ohne
  Inhaltsrelationen hat `"relations": {}`.

Alles andere gehört nicht zum Inhalt, insbesondere vom Connector gepflegte
Zählungen wie `reactions`, `myReaction` und `commentCount`, Relationen mit
anderen Prädikaten, `tags` und Vertragsfelder wie `data.claim`. Der Inhalts-Hash ist
`"sha256:" + hex(SHA-256(UTF-8(JCS(Inhalt))))`, Hex in Kleinbuchstaben. Es wird
nicht normalisiert: Editoren DÜRFEN NICHT den Inhalt beim Öffnen
normalisiert zurückschreiben, denn jede Byte-Änderung ändert den Hash.

```json
{
  "v": "rls-claim/1",
  "profile": "item-authorial",
  "id": "…",
  "type": "comment",
  "createdBy": "did:key:…",
  "createdAt": "2026-09-25T15:00:00.000Z",
  "content": {
    "data": { "content": "…", "replyTo": null, "replyToComment": null },
    "relations": { "commentOn": ["item:…"] }
  }
}
```

1. Alle Member sind IMMER präsent. `content.data` enthält genau die
   Inhaltsfelder des Typs, fehlende als `null`; `content.relations` enthält
   genau die Prädikate seiner Inhaltsrelationen. Damit ist auch gebunden,
   worauf sich eine Aussage bezieht: Wird ein Kommentar oder eine Reaktion
   an ein anderes Ziel gehängt, ist der Claim ungültig.
2. Das Profil ist nur auf Items eines Katalogtyps gültig, und `type` im
   Payload MUSS dem Item entsprechen. Sonst ist es `invalid`.
3. Der Claim ersetzt für Katalogtypen den Herkunfts-Claim, dessen
   unveränderliche Felder er mitbindet (Exklusivität wie oben). Gespeichert
   wird er als Vertragsfeld `data.claim`.
4. Verifier prüfen wie bei `relation-authorial`: Schlüssel aus `kid`,
   `kid === "<createdBy>#sig-0"`, jedes Payload-Member gleich dem
   gespeicherten Item, `content` gleich dem gespeicherten Inhalt. Abweichung
   ist `invalid`.
5. Den Inhalt, also Inhaltsfelder und Inhaltsrelationen, ändert nur die
   Autorin, und jede Änderung MUSS neu signiert werden. Alles außerhalb des
   Inhalts darf nach den allgemeinen Item-Regeln geschrieben werden; der
   Claim bleibt dabei gültig.
6. Claim-Modi wie oben: `signed`-Connectoren MÜSSEN den Claim schreiben und
   prüfen; ein Item eines Katalogtyps ohne Claim ist dort `invalid`.
   `authoritative`-Connectoren schreiben keinen Claim; `trusted` DÜRFEN sie
   nur beanspruchen, wenn jeder Ingress-Pfad die Autorbindung erzwingt und
   Änderungen am Inhalt auf die Autorin beschränkt. Ohne Claim-Modus
   ist ein solches Item unverifiziert.
7. Leseregeln analog L1/L2: Ein Item mit `invalid`-Claim zählt in keiner
   Auswertung, Bezugnahmen darauf ebenso wenig. Anzeigeflächen DÜRFEN es mit
   Kennzeichnung („verändert") zeigen. Die Abwesenheit eines Claims beweist
   keine Herkunft und kann in einem Multi-Writer-Store jederzeit hergestellt
   werden. Ob ein Item ohne Claim trotzdem angezeigt wird und zählt, regelt
   allein die Spalte „Beleg erforderlich" (unten); eine Ausnahme nach Datum
   oder Herkunft gibt es nicht.
8. Kanonische **Testvektoren** liegen unter
   `schemas/claims/vectors/item-authorial-1.json` und sind für
   Implementierungen verbindlich.

**Beleg erforderlich.** Die Spalte im Katalog legt fest, was mit einem Item
ohne Claim geschieht. Für jedes Item eines Katalogtyps gilt, in dieser
Reihenfolge:

1. Verdikt `valid` oder `trusted`: Das Item ist **belegt**. Es wird angezeigt
   und zählt in Auswertungen.
2. Kein Claim (`data.claim` fehlt) und der Typ verlangt **keinen** Beleg: Das
   Item ist **unsigniert**. Es wird angezeigt und zählt in Auswertungen.
   Anzeigeflächen SOLLTEN es dezent als unsigniert kennzeichnen, nicht als
   Warnung.
3. Sonst ist es **ungültig** und zählt in keiner Auswertung. Trägt es einen
   Claim, der nicht passt, DÜRFEN Anzeigeflächen es mit Kennzeichnung
   („verändert") zeigen.

Für `comment` und `reaction` ist die Belegpflicht **vorerst aus**. Diese
Typen gab es schon, bevor sie signiert wurden, und ihr Bestand soll sichtbar
bleiben. Die Belegpflicht wird später eingeschaltet. Ab dann sind
unsignierte Kommentare und Reaktionen ungültig. Das Einschalten ist eine
Änderung dieses Katalogs mit einem Release, kein Laufzeitschalter und nichts,
was ein Client oder Space-Daten ändern können.

Solange die Belegpflicht aus ist, gilt für diese Typen: Ein unsigniertes Item
ist unbelegt. `createdBy` und `createdAt` sind ohne Claim frei schreibbar, und
wer bei einem signierten Kommentar den Claim entfernt, macht ihn zu einem
unsignierten. Die Kennzeichnung als unsigniert macht das sichtbar. Ein
automatisches Nachsignieren findet nicht statt, weil es untergeschobene
Items beglaubigen würde.

Die Gruppe `standing` in `item-authorial-1.json` legt die drei Ergebnisse
fest.

**Schreibweg.** Den Claim verwaltet der Connector im allgemeinen Schreibweg,
gesteuert allein durch den Katalog:

1. Connectoren DÜRFEN dafür keine typspezifische Logik enthalten. Sie lesen
   aus dem Katalog, ob ein Typ eine Aussage einer Person ist und welche
   Inhaltsfelder und Inhaltsrelationen seinen Inhalt bilden.
2. Beim regulären Anlegen und Ändern wird ein vom Aufrufer mitgegebenes
   `data.claim` ignoriert. Pfade, die ein bestehendes Item unverändert
   übernehmen (Sync, Snapshot, Mirror/Bridge), übernehmen seinen Claim
   unverändert und signieren nie im Namen der Autorin.
3. **Anlegen:** Im Modus `signed` signiert der Connector mit der
   angemeldeten Identität; ohne Identität lehnt er ab und schreibt nie
   unsigniert.
4. **Ändern:** Bleibt der Inhalt gleich, behält der Connector den bestehenden
   Claim, auch wenn `updateItem` `data` vollständig ersetzt. Ändert sich der
   Inhalt, MUSS der Connector prüfen, dass die angemeldete Identität die
   Autorin ist und das Item nicht eingefroren ist, und neu signieren. Sonst
   lehnt er ab.

### Inhaltsgebundene Bezugnahme und Einfrieren

1. Ein Relation Record, dessen `to` auf ein Item eines Katalogtyps zeigt,
   DARF `fields.contentHash` tragen: den Inhalts-Hash des Ziels, auf den
   sich die Bezugnahme bezieht. Sie gilt dann nur für genau diesen Inhalt.
   Stimmt der Hash nicht mit dem gespeicherten Inhalt überein, bezieht sie
   sich auf eine andere Fassung und gilt nicht. In `relation-authorial` ist
   `fields` mitsigniert, die Autorin der Bezugnahme bezeugt also genau
   diesen Inhalt.
2. Welche Prädikate inhaltsgebunden sein MÜSSEN, legt die Spec des Prädikats
   oder Moduls fest. `votesOn` MUSS inhaltsgebunden sein (Resonanzmodul).
3. **Einfrieren:** Existiert zu einem Item eine inhaltsgebundene Bezugnahme
   einer anderen Person, ist es eingefroren, und sein Inhalt DARF nicht mehr
   geändert werden. Clients und Connectoren MÜSSEN solche
   Änderungen ablehnen. Gegen manipulierte Clients schützt Regel 1: Eine
   spätere Änderung lässt die Bezugnahmen nicht mehr gelten.
4. Wie ein eingefrorenes Item neu gefasst wird, regelt sein Typ. Beim
   Statement sind es Varianten ([modules/resonance.md](modules/resonance.md#varianten)).

### Schreibregeln (Fassade)

1. `createRelationRecord` MUSS für Katalog-`authorial`-Prädikate den Claim
   erzeugen und speichern; `updateRelationRecord` MUSS re-signieren (auch bei
   `confirmationRef`-Änderungen). Die Fixture-/ETL-Ausnahme (Fassaden-Regel 3)
   MUSS ebenfalls gültige Claims schreiben.
2. **Idempotenz repariert:** Trifft `createRelationRecord` auf den bereits
   existierenden kanonischen Record der EIGENEN Identität ohne gültigen Claim
   (Altbestand, Fremdbesetzung des eigenen Slots), gibt es ihn nicht unverändert
   zurück, sondern MUSS ihn per Update mit gültigem Claim reparieren
   (dasselbe Konvergenzmuster wie die Value-Reparatur, rls#211). Fremde
   Identität bleibt eine Kollision (Fehler).

### Leseregeln (Aggregation)

Verifikation ist asynchron (WebCrypto) und cachebar
(`(recordId, contentHash) → verdict` — für unveränderte Records ändert sich
das Verdikt nie). Der reaktive Vertrag ist deterministisch:

- **L1:** Aggregierende Leseflächen (z. B. `votesFromRelationRecords`-Konsumenten)
  zählen einen Record erst NACH positivem Verdikt (`valid` oder `trusted`) —
  **fail closed ab dem ersten Frame**: ausstehende Verifikation zählt wie
  ungültig. Das Observable MUSS nach Abschluss ausstehender Verifikationen
  erneut emittieren; der Übergang ist monoton (unverifiziert → gezählt), nie
  umgekehrt für unveränderte Records. Gleiche Record-Menge ⇒ gleicher
  Endzustand, unabhängig von Verifikations-Reihenfolge.
- **L2:** `invalid` (Signatur/Payload-Mismatch/fremder Signer/unbekannte
  Version) wird verworfen und NIE gezählt; reine Anzeige-Flächen DÜRFEN solche
  Records als unverifiziert markieren, statt sie zu verbergen.
- **L3:** `trusted` (authoritative Connector) zählt ohne Signaturprüfung — die
  Autorbindung leistet dort der Store.
- **L4:** Ein Claim beglaubigt die **Aussage des Autors**, nicht Wahrheit oder
  Berechtigung: Capability- und Membership-Prüfungen bleiben unberührt.

### Vertrauensgrenze danach

Fälschbar bleibt nur noch, was der Autor selbst signiert — Vote-Fälschung im
Namen Dritter ist auch für manipulierte Clients ausgeschlossen. NICHT
abgedeckt: Löschung fremder Records im rohen CRDT (Verfügbarkeit, nicht
Autorschaft) und Replay alter eigener Claims (der deterministische Record-Key
begrenzt das auf den eigenen Tupel-Slot; ein Replay setzt schlimmstenfalls die
EIGENE frühere Stimme wieder ein).

## Nicht-Ziele

Diese Spec definiert nicht:

- ein neues Attestation- oder Signaturformat (bleibt WoT),
- eine Graph-Query-Sprache oder Traversierung über mehrere Hops,
- einen globalen, space-übergreifenden Graphen.
