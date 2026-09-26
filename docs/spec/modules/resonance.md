# Resonance Module (Resonanz)

**Status:** Normativer Entwurf v0.1

Das Resonance Module ist eine Listen-Ansicht im Current Space, in der
Mitglieder Aussagen einbringen und die Gruppe sich mit einer dreistufigen
Stellungnahme (grün / gelb / rot) dazu positioniert. Es macht sichtbar,
was in der Gruppe Resonanz findet.

Herkunft: das „Narrative"-Modul des Web-of-Trust-Prototyps
(it4change/web-of-trust-prototype), übertragen auf das RLS-Item-Modell.

## Zweck

Das Modul beantwortet im Current Space die Frage:

> Wie steht die Gruppe zu dieser Aussage?

Die Aussage ist bewusst generisch: eine These („Wir brauchen einen
zweiten Brunnen"), ein Ziel („Erst die Küche, dann der Seminarraum"),
ein Angebot („Ich übernehme die Pressearbeit"). Die Nutzung —
Meinungsbild, Priorisierung, Aufgabenverteilung — entsteht sozial aus
dem Inhalt, nicht aus Feature-Varianten des Moduls.

## Einordnung

| Frage | Antwort |
|---|---|
| Space Module? | Ja (opt-in über den Gruppen-Dialog, kein Default-Modul) |
| App-Shell-Fläche? | Nein |
| Module Components | ResonanceView (App), VoteBar (Toolkit), useVotes (Toolkit) |
| Primäre Datenbasis | Items (`statement`, `vote`) + Relations |
| Externe Semantik | keine |

## Datenmodell

### Statement (die Aussage)

| Feld | Bedeutung |
|---|---|
| `type` | `"statement"` |
| `data.title` | die Aussage — ein Satz; Pflicht |
| `data.description` | optionaler Kontext |
| `data.variantOf` | optional: `item:<statementId>` der Aussage, von der dieses Statement eine Variante ist (siehe „Varianten") |
| `data.claim` | im Modus `signed`: SignedClaim der Autorin über den Wortlaut (Profil `item-authorial`, [08-relation-records.md](../08-relation-records.md#aussagen-einer-person-item-authorial)); verwaltet der Connector, Vertragsfeld, nie Teil des Wortlauts |
| `tags` | Top-level am Item, Kategorisierung — siehe [07-tags.md](../07-tags.md); ein Tag ordnet die Aussage einem Modul zu |
| `createdBy` | Autorin der Aussage |

Ein Statement trägt das Vokabular **`statement/v1`** in `@context`
(gesetzt vom Composer über `deriveContext`). Die Modul-Aktivierung läuft
über dieses Schema, nie über `type` (Spec 06, „Die Rolle von `type`"):
die Resonance-Ansicht liest `useItems({ hasSchema: [statement/v1] })`,
der Feed nimmt Statements über denselben Filter in seine Union auf, und
Routing/Notifications tragen die Aktivierung als Schema-Hint
(`moduleHints.hasStatement`). `type: "statement"` bleibt für die
Composer-Vorlage, das Badge und User-Filter — die Rollen, die Spec 06
dem Typ zuweist.

### Wortlaut und Einfrieren

Ein Statement ist eine Aussage einer Person im Sinn von Spec 08
([item-authorial](../08-relation-records.md#aussagen-einer-person-item-authorial)).
Sein **Wortlaut** ist sein Inhalt nach dem dortigen Katalog: die
Inhaltsfelder `title`, `description` und `variantOf`, Inhaltsrelationen hat
ein Statement keine. Der **Inhalts-Hash** ist dort definiert. Tags gehören nicht zum Wortlaut. Signatur, Schreibweg,
Einfrieren und die Regel gegen Normalisierung gelten wie in Spec 08; hier
steht nur, was das Modul ergänzt.

1. Ein Statement zählt nur, wenn seine Bindung an Autorin und Wortlaut
   geprüft ist. Was das je Claim-Modus heißt, regelt die Tabelle unten.
2. Weil `votesOn` inhaltsgebunden ist, friert ein Statement mit der ersten
   Stimme einer anderen Person ein (Spec 08, Einfrieren). Bis dahin darf
   die Autorin den Wortlaut ändern. Ihre eigene Stimme zählt nach einer
   Änderung erst wieder, wenn sie neu abstimmt (Vote-Regel 5).
3. Ist ein Statement eingefroren, MUSS die UI „Bearbeiten" für den Wortlaut
   ausblenden und stattdessen „Variante anlegen" anbieten. Tags bleiben
   nach den allgemeinen Item-Berechtigungen bearbeitbar.
4. Es gibt keinen Altbestand-Modus. Ein Statement ohne positives Verdikt
   zählt nicht, gleich woher es kommt.

Claim-Modi (Spec 08) und was jeweils zählt:

| Claim-Modus | Statement | Stimme | Zählt |
|---|---|---|---|
| `signed` | MUSS einen gültigen `item-authorial`-Claim tragen; fehlt er oder ist er ungültig, ist das Statement `invalid` | MUSS einen gültigen `relation-authorial`-Claim mit `fields.contentHash` tragen | bei Verdikt `valid` für Statement und Stimme |
| `authoritative` | trägt keinen Claim; der Store MUSS die Autorbindung erzwingen und Änderungen am Wortlaut auf die Autorin beschränken | trägt keinen Claim, MUSS aber `fields.contentHash` tragen | bei Verdikt `trusted` |
| kein Claim-Modus | unverifiziert | unverifiziert | nie (Spec 08, L1) |

In allen Modi gilt die Wortlautbindung der Stimme (Vote-Regel 5).

### Vote (die Stellungnahme)

Ein Vote ist ein **Relation Record** ([08-relation-records.md](../08-relation-records.md)) —
niemals ein Feld am Statement und kein eigener Item-Typ:

| Feld | Bedeutung |
|---|---|
| `id` | kanonisch: `rel-<SHA-256 über [createdBy, "votesOn", from, to]>` |
| `predicate` | `"votesOn"` |
| `from` | `global:<voterDid>` — MUSS gleich `global:<createdBy>` sein |
| `to` | `item:<statementId>` |
| `fields.value` | `"green"` \| `"yellow"` \| `"red"` |
| `fields.contentHash` | Inhalts-Hash des Wortlauts, dem die Stimme gilt; Pflicht in jedem Claim-Modus |
| `createdBy` | vom Connector aus der authentifizierten Identität gesetzt — nie vom Aufrufer |

Regeln (MUSS):

1. **Ein Vote pro (Person, Statement) — auth-gebunden.** Schreibpfad ist
   ausschließlich die Relation-Store-Fassade: `createdBy` stammt aus der
   authentifizierten Identität, die kanonische Hash-ID bindet
   `(Voter, Statement)` kollisionssicher (kein Trennzeichen-Trick möglich),
   eine vorbelegte ID mit abweichender Identität ist ein **Fehler**, kein
   idempotenter Erfolg, und Update/Delete prüfen Autorschaft. Wechsel der
   Stimme = `updateRelationRecord` auf den **eigenen** Record, gleiche
   Stimme erneut = Rückzug via `deleteRelationRecord`.
2. **Votes werden nie in das Statement-Item geschrieben.** `updateItem`
   rekonziliert `data` vollständig — ein Summary-Feld am Statement würde
   konkurrierende Stimmen gegenseitig löschen. Ein Record pro Person
   merged konfliktfrei (ein Item ist die CRDT-Konfliktgrenze).
3. **Alle Lesepfade teilen EINE Validierung** (`votesFromRelationRecords`
   in `data-interface/src/votes.ts`): Es zählen nur Records, deren
   `from`-Endpunkt an den Autor gebunden ist (`from === global:<createdBy>`)
   und deren `fields.value` gültig ist; pro `(Statement, Voter)` zählt
   höchstens EIN Record — Duplikate kollabieren deterministisch auf die
   lexikographisch kleinste Record-ID, sodass alle Clients unabhängig von
   der Sync-Reihenfolge dasselbe Aggregat bilden. Aggregation ist rein
   clientseitig (`VoteSummary`), gelesen über
   `observeRelationRecords({ predicate: "votesOn", to: "item:<id>" })`.
4. **Votes sind transparent.** Jede Stimme trägt `createdBy`, ist im Space
   für alle Mitglieder lesbar, und die VoteBar zeigt die Voter-Namen je
   Stufe im Tooltip. Anonymität wird nicht versprochen, weil sie technisch
   nicht existiert.
5. **Eine Stimme gilt einem Wortlaut.** `votesOn` ist eine
   inhaltsgebundene Bezugnahme (Spec 08). Eine Stimme zählt nur, wenn ihr
   `fields.contentHash` gleich dem Inhalts-Hash des aktuell gespeicherten
   Wortlauts ist. Im Modus `signed` ist `fields` im
   `relation-authorial`-Claim signiert, die Stimmende bezeugt damit genau
   diesen Wortlaut. Stimmen mit abweichendem Hash zählen nicht; die
   UI MUSS sie der Stimmenden als „Stimme für eine andere Fassung" zeigen,
   damit sie neu abstimmen kann. Stimmen ohne `contentHash` zählen nie.

**Vertrauensgrenze:** Die Fassade bindet ehrliche Clients an ihre
Identität, und die geteilte Lese-Validierung macht Mehrfach-Stimmen
unzählbar — auch wenn ein manipulierter Client an der Fassade vorbei
rohe Items schreibt. Die verbleibende Lücke (gefälschtes `createdBy` per
rohem `createItem`) schließen die **SignedClaims** aus
[08-relation-records.md → Autorbindung](../08-relation-records.md#autorbindung-signedclaims):
`votesOn` ist ein `authorial`-Prädikat, jeder Vote-Record trägt die
Ed25519-JWS seines Autors über Identität und Wert, und die Aggregation
verwirft Records ohne gültigen Claim — fail closed, auch nach
Snapshot-Bootstrap.

## Varianten

Eine neue Formulierung ändert nie ein bestehendes Statement. Sie ist ein
neues Statement mit `data.variantOf` auf die Aussage, von der es abweicht.

1. Jede Person mit `ItemWriter` im Space DARF eine Variante zu jedem
   Statement anlegen, auch zu einer Variante.
2. `data.variantOf` gehört zum Wortlaut, ist also signiert und
   unveränderlich. Das Ziel MUSS ein Statement im selben Space sein.
3. Varianten ersetzen nichts. Sie stehen nebeneinander, und jede sammelt
   ihre eigenen Stimmen. Stimmen werden nie von einer Fassung auf eine
   andere übertragen.
4. Wer zu einer Aussage abgestimmt hat, SOLLTE benachrichtigt werden, wenn
   zu ihr eine Variante entsteht.
5. Die Detailansicht MUSS die **Familie** einer Aussage zeigen: die
   Ausgangsaussage und alle Varianten mit ihrer Verteilung nebeneinander.
   Eine Karte zeigt, von welcher Aussage sie eine Variante ist, und wie
   viele Varianten zu ihr existieren.
6. Clients MÜSSEN Zyklen und fehlende Ziele tolerieren: Eine Familie wird
   ohne Wiederholung durchlaufen, ein fehlendes Ziel erscheint als
   „Variante einer nicht verfügbaren Aussage".

## Capabilities

| Capability | Verhalten, wenn vorhanden | Verhalten, wenn fehlt |
|---|---|---|
| `DataInterface` | Statements lesen | Modul kann nicht lesen |
| `ItemWriter` | Statements anlegen/bearbeiten | Statement-Schreibaktionen deaktiviert |
| `RelationRecordCapable` | Votes je Statement beobachten | VoteBar ausblenden |
| `RelationRecordWriterCapable` | Stimmen setzen/ändern/zurückziehen | Voten deaktiviert |
| `Authenticatable` | Vote-Identität, eigene Stimme markieren | Voten deaktiviert (Votes sind identitätsgebunden — ohne Identität kein Vote) |
| `ProfileCapable` | Voter-Namen im Tooltip | Fallback auf DIDs |

## Aktionen

| Aktion | Voraussetzung | Effekt |
|---|---|---|
| Statement einbringen | `ItemWriter` | `createItem(type: "statement")` |
| Statement bearbeiten | `ItemWriter` + Autorschaft + keine Stimme einer anderen Person | `updateItem`; der Connector signiert den neuen Wortlaut (`item-authorial`) |
| Variante anlegen | `ItemWriter` | `createItem(type: "statement")` mit `data.variantOf` |
| Tags ändern | `ItemWriter` + Berechtigung | `updateItem` auf `tags`; berührt den Wortlaut nicht |
| Stimme abgeben | `RelationRecordCapable` + `RelationRecordWriterCapable` + `Authenticatable` | `createRelationRecord` (kanonische ID, `createdBy` aus der Identität, `fields.contentHash` des angezeigten Wortlauts); der Record entsteht im Owner-Space des Statements |
| Stimme ändern | dito + Autorschaft | `updateRelationRecord` auf den eigenen Record, mit dem Inhalts-Hash des angezeigten Wortlauts |
| Stimme zurückziehen | dito + Autorschaft | `deleteRelationRecord` auf den eigenen Record |
| Importieren | `ItemWriter` | siehe „Import" |
| Exportieren | `DataInterface` + `RelationRecordCapable` | siehe „Export" |

## Auswertung

Die Auswertung rechnet über eine **Personenmenge** und zeigt Verteilungen.
Sie trifft keine Entscheidung.

### Personenmenge

1. Standard ist die Menge aller Mitglieder des Space.
2. Die Menge ist über Filter bearbeitbar: einzelne Personen ein- und
   ausschließen, „nur wer abgestimmt hat". Filter wirken nur lokal, sie
   ändern keine Daten und werden nicht geteilt.
3. Weitere Filter: Tags (Module) und die Stellung einer Person, zum
   Beispiel „alle Aussagen, die X grün trägt". Damit ergibt sich die Sicht
   „was trägt diese Person mit" ohne eigene Ansicht.

### Kennzahlen je Statement

Für die gewählte Personenmenge: Anzahl grün, gelb, rot, Anzahl **ohne
Stimme** (Menge minus Stimmende) und die Anteile. Anteile an Grün, Gelb und
Rot beziehen sich auf die abgegebenen Stimmen, die Beteiligung auf die
Größe der Menge. „Ohne Stimme" DARF NICHT als Rot gezählt werden.

Die Auswertung DARF NICHT berechnen, ob eine Aussage angenommen oder
abgelehnt ist, und DARF NICHT Personen bewerten oder in eine Rangfolge
bringen (RLNP: Menschen werden nicht bewertet). Eine Person erscheint nur
mit ihren Stellungnahmen, nie mit einem Wert.

### Sortierungen

Tiebreaker in Klammern:

| Sortierung | Schlüssel |
|---|---|
| Neueste (Default) | `createdAt` desc (letzte Stimme, Stimmenzahl) |
| Stimmen | Stimmenzahl desc (Zustimmungsrate, letzte Stimme, `createdAt`) |
| Zustimmung | Anteil grün desc (Stimmenzahl, letzte Stimme, `createdAt`) |
| Bedenken | Anteil gelb desc (Stimmenzahl, `createdAt`) |
| Ablehnung | Anteil rot desc (Stimmenzahl, `createdAt`) |
| Beteiligung | Stimmende ÷ Größe der Personenmenge desc (Stimmenzahl, `createdAt`) |
| Aktivität | Zeit der letzten Stimme desc (Stimmenzahl, Zustimmungsrate, `createdAt`) |

Alle Kennzahlen beziehen sich auf die gewählte Personenmenge und zählen
nur Stimmen, die nach „Vote"-Regel 5 und Spec 08 gelten.

## Import

Statements werden als JSON-Datei importiert:

```json
{
  "format": "resonance-import/1",
  "statements": [
    { "title": "…", "description": "…", "tags": ["…"], "variantOf": "item:…" }
  ]
}
```

`title` ist Pflicht, alle anderen Felder sind optional.

1. Die Datei MUSS vor dem ersten Schreiben vollständig validiert werden.
   Ist ein Eintrag ungültig, wird nichts geschrieben, und die UI nennt die
   fehlerhaften Einträge.
2. Jedes Statement wird im normalen Schreibweg angelegt: `createdBy` ist
   die importierende Person, der `item-authorial`-Claim wird wie beim
   Anlegen von Hand erzeugt. Import ist kein Sonderweg (Spec 08,
   Fixture-/ETL-Regel).
3. **Idempotent über den Inhalt:** Ein Eintrag wird übersprungen, wenn im
   Space bereits ein Statement derselben Person mit demselben Inhalts-Hash
   existiert. Dateiname und Reihenfolge spielen keine Rolle.
4. Die UI meldet, wie viele Statements angelegt und wie viele übersprungen
   wurden.

## Export

Die Auswertung ist als JSON exportierbar und folgt dabei der gewählten
Personenmenge und den gewählten Filtern:

```json
{
  "format": "resonance-export/1",
  "exportedAt": "…",
  "space": "…",
  "filter": { "people": ["did:…"], "tags": ["…"] },
  "statements": [
    {
      "id": "…", "title": "…", "description": "…", "variantOf": "item:…",
      "tags": ["…"], "createdBy": "did:…", "createdAt": "…",
      "contentHash": "sha256:…", "claim": "…",
      "votes": [
        { "voter": "did:…", "value": "green", "contentHash": "sha256:…",
          "createdAt": "…", "claim": "…" }
      ],
      "summary": { "green": 0, "yellow": 0, "red": 0, "noVote": 0 }
    }
  ]
}
```

1. Exportiert werden nur Stimmen, die zählen.
2. Die Claims SOLLTEN mitexportiert werden. Dann lässt sich jede Aussage
   und jede Stimme außerhalb des Space prüfen.
3. Der Export enthält die Stellungnahmen anderer Menschen mit ihrer
   Identität. Die UI MUSS vor dem Export darauf hinweisen, dass diese Daten
   damit den Space verlassen.

## Komponenten

| Komponente | Rolle | Wiederverwendbar? |
|---|---|---|
| `ResonanceView` (App) | Liste, Sortierung, Tag-Filter, Create/Detail-Registrierung | nein |
| `VoteBar` (Toolkit) | Verteilungsbalken grün/gelb/rot + Vote-Buttons; sitzt im `footerAdornment` der `ItemPreview`; Tooltip mit Voter-Namen je Stufe (`useVoteUsers`); `stopPropagation` auf Interaktionen | ja |
| `useVotes` (Toolkit) | Vote-Lesen/Schreiben/Aggregation über die Relation-Store-Fassade (optimistisches Overlay, Write-Chain; Schreibentscheidung gegen frisch gelesene Records) | ja |
| `useVoteUsers` (Toolkit) | reaktive, transparente Voter-Liste (abonniert die Records) | ja |

Karten werden ausschließlich aus `ItemPreview` gebaut
(siehe [shared-components.md](./shared-components.md)); die VoteBar ist
ein Adornment, keine eigene Kartenform.

## Activity-Log

Der Connector schreibt Activity automatisch (create/update/delete).
`deriveActivitySummary` erhält einen Zweig für Relation-Items mit
`data.predicate === "votesOn"` analog zum Reaction-Zweig, damit im Log
„Zustimmung zu ‚…‘" statt eines leeren Eintrags steht. Die Geschichte
einer Aussage sind ihre Varianten. Das Activity-Log zeigt daneben, was
wann angelegt wurde, ist aber nicht die Quelle für Wortlaute.

## Cross-Module-Verhalten

- **Die Detailansicht folgt dem Item, nicht dem Modul** (#203): ein
  Statement zeigt seine VoteBar im geteilten Detail-Panel, egal aus
  welchem Modul es geöffnet wurde — eine Typ-Regel wie Task-Assignees.
- **Statements erscheinen im Feed** (Schema-Union über `statement/v1`, siehe Datenmodell) und
  tragen dort die VoteBar direkt auf der Karte: die Karte ist die Umfrage.
  Reaktionen bleiben daneben verfügbar (Reaktionen sind nicht typabhängig).
- Ein Statement mit `data.status` darf im Kanban erscheinen, mit
  `data.start` im Kalender (generische Feldpräsenz-Regeln); das Modul
  definiert dazu nichts Eigenes.
- Vote-Records sind reine Relations-Träger (`type: "relation"`) und
  erscheinen in keiner Modul-Ansicht (kein `content`, `status`, `start`,
  `location`).

## Nicht-Ziele

- **Kein Cross-Module-Voting** (Stellungnahmen zu beliebigen Items
  anderer Module) — bewusst vertagt; das Datenmodell (`votesOn` auf
  beliebige `item:`-Targets) schließt es nicht aus.
- Keine Prozess-Semantik (kein Konsent-Verfahren, keine Beschlüsse,
  keine Quoren, keine Schwellen), kein Punkte-Budget, kein Ranking-Ballot.
- Keine Anonymität (siehe Datenmodell Regel 4).
- Keine Versionskette innerhalb eines Items: Neue Fassungen sind Varianten.
- Kein Default-Modul: Aktivierung ausschließlich über den Gruppen-Dialog.

## Implementierungsreferenzen

- Vote-Vertrag (Validierung, Dedupe, Input): `packages/data-interface/src/votes.ts`
- Relation-Store-Fassade: `packages/data-interface/src/relation-records.ts` + Spec 08
- Optimistik/Write-Chain-Vorlage: `packages/toolkit/src/hooks/use-reactions.ts`
- Karten/Adornments: `packages/toolkit/src/components/preview/item-preview.tsx`
- Varianten (Familie, Zyklen, fehlende Ziele): `packages/toolkit/src/lib/resonance-variants.ts`,
  Darstellung `packages/toolkit/src/components/resonance/statement-variants.tsx`
- Einfrieren in der Oberfläche: `packages/toolkit/src/hooks/use-item-frozen.ts`
- View-Blaupause: `apps/reference/src/views/feed-view.tsx`,
  `collection-view.tsx`
- Prototyp: `web-of-trust-prototyp/narrative-app` (Schema
  `opinion-graph.ts`, `VoteBar.tsx`)

## Testvektoren

Verbindlich für Implementierungen, erzeugt von
`schemas/claims/generate-vectors.mjs`:

- [`schemas/claims/vectors/item-authorial-1.json`](../schemas/claims/vectors/item-authorial-1.json)
  (Spec 08): Inhalts-Hash je Katalogtyp, einschließlich eines Paares aus
  NFC und NFD, und gültige wie ungültige `item-authorial`-Claims für
  Statement, Kommentar und Reaktion, einschließlich umgehängter,
  entfernter und zusätzlicher Ziele.
- [`schemas/claims/vectors/resonance-1.json`](../schemas/claims/vectors/resonance-1.json):
  ob eine Stimme zählt, je Claim-Modus. Darunter Stimme ohne
  `contentHash`, Stimme für eine andere Fassung, geänderter Wortlaut nach
  der Stimme, Statement ohne Claim und normales Anlegen und Abstimmen im
  Modus `authoritative`.

## Offene Punkte

- `item-provenance` ist im Code noch nicht umgesetzt. `item-authorial`
  (Signieren, Prüfen, Einfrieren, Zählung) ist es in allen Connectoren.
- JSON-Schemas für `resonance-import/1` und `resonance-export/1` als
  eigene Dateien.
