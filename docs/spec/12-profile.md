# Profile

**Status:** Normativer Entwurf v0.1 (erste Anwendung von
[09-mirror-bridge.md](09-mirror-bridge.md); davor darf kein Code
Profil-Mirrors erzeugen)

Diese Spec definiert, wie das Profil einer Person entsteht, wo es lebt und
wie es in die Spaces gelangt, deren Mitglied die Person ist. Sie führt
keine eigenen Mechanismen ein, sondern wendet 09 an.

Code-Referenzen:

- `packages/wot-connector/src/wot-connector.ts` (`doc.profile`, `updateProfile`, `projectPersonItem`)
- `packages/wot-connector/src/types.ts` (`RlsSpaceDoc`, `SerializedItem`)
- `packages/data-interface/src/type-manifest.ts` (Core-Typ `person`)
- [schemas/vocab/person/v1/](schemas/vocab/person/v1/), [schemas/vocab/place/v1/](schemas/vocab/place/v1/)

## Begriffe

Ein Profil ist das **person-Item einer Person mit DID**. Es lebt genau
einmal, im persönlichen Space seiner Person, und erscheint in jedem
Gruppen-Space, für den die Person es freigegeben hat, als **Mirror nach
09**.

| Rolle aus 09 | Beim Profil |
|---|---|
| Canonical Home | persönlicher Space der Person (appTag `rls-private`; `homeSpaceId` ist dessen deterministische, identitätsgebundene Space-ID, nicht das Tag) |
| Item | `type: "person"`, `@context` mit `person/v1`, optional `place/v1` |
| Autor / Signer | die Person (`createdBy` = DID) |
| Freigabe | Annahme der Einladung oder Erstellen des Space; Bestand einmalig pauschal (Regel 5) |
| Bridge | ein Gerät der Person selbst (Mitglied beider Spaces) |
| Mirror | signierter Schnappschuss des Profils im Gruppen-Space |

## Form

```jsonc
{
  "id": "did:key:z6Mk…",            // = createdBy = data.did
  "type": "person",
  "@context": ["…/base/v1", "…/person/v1", "…/place/v1"],
  "createdAt": "2026-09-11T08:00:00.000Z",
  "createdBy": "did:key:z6Mk…",
  "data": {
    "displayName": "Anton",
    "bio": "…", "avatarUrl": "…",   // person/v1
    "did": "did:key:z6Mk…",          // person/v1 — Profil-Marker
    "position": { "type": "Point", "coordinates": [9.5, 51.3] },
    "address": "…", "locationName": "…"   // place/v1, optional
  }
}
```

## Regeln

1. **Eine Person, ein Profil.** Die Item-`id` des Profils ist die DID der
   Person; `id`, `createdBy` und `data.did` sind identisch. Der logische
   Schlüssel nach 09 Invariante 1 ist damit
   `(persönlicherSpaceId, did)`, eine Mirror-Instanz
   `(zielSpaceId, persönlicherSpaceId, did)`. Personas je Space gibt es
   nicht; sie sind Gegenstand der RLTP-Umstellung.
2. **Position ist `place/v1`.** `person/v1` hat KEIN Positionsfeld. Ein
   Profil mit Ort deklariert zusätzlich `place/v1` und trägt `position`,
   optional `address` und `locationName`. Es erscheint dadurch auf der
   Karte wie jedes andere Item (06, Feldfilter `position`).
3. **Platzhalter.** Ein person-Item OHNE `data.did` ist ein gewöhnliches
   gespeichertes Item, das ein Mitglied für eine dritte Person anlegt
   (Kontaktbuch). Es hat eine zufällige `id`, `createdBy` ist das
   Mitglied, und es wird nicht gespiegelt. Die Unterscheidung
   Profil/Platzhalter läuft ausschließlich über das Vorhandensein von
   `data.did`: fehlt es, ist das Item ein Platzhalter; ist es vorhanden,
   MUSS es gleich `createdBy` sein. `data.did: null` ist ungültig (das
   Schema verlangt einen nicht-leeren String). Eine Relation
   Platzhalter↔Profil beim Beitritt der Person ist nicht Teil dieser Spec.
4. **Freigabe = Annahme der Einladung.** Mitgliedschaft entsteht im
   heutigen Protokoll ohne Zutun der Person (ein Mitglied fügt sie
   hinzu; der Adapter nimmt den Space an, bevor die App davon erfährt).
   Deshalb führt die App eine **Annahme** ein: ein neu hinzugekommener
   Space ist zunächst **ausstehend**. Die Person nimmt die Einladung an
   und stimmt damit zu, dass ihr Profil in diesem Space geteilt wird;
   die Annahme ist die Freigabe nach 09 Invariante 3 und 4 (bewusst,
   zielgebunden). Lehnt sie ab, verlässt sie den Space. Wer einen Space
   selbst erstellt, gibt sein Profil dort mit dem Erstellen frei. Der
   Connector trägt die Freigabe `(did, zielSpaceId)` in die
   Mirror-Registry des persönlichen Space ein und publiziert den
   Schnappschuss. Die Freigabe umfasst alle späteren Änderungen des
   Profils, bis sie widerrufen wird (Regel 6). Ein Profil in N Spaces
   entspricht N signierten Schnappschüssen. Jede Aufnahme in einen Space ist
   durch ihre Einladung identifiziert (im heutigen Protokoll: die mit
   der Einladung ausgestellte Space-Capability samt
   `currentKeyGeneration`; eine Wiederaufnahme ist eine neue Einladung
   mit neuer Capability). Der Registry-Eintrag (Regel 9) entsteht mit
   Status `pending` und der Aufnahme-Kennung `admission` der Einladung,
   sobald diese auf einem Gerät der Person eintrifft; die Annahme setzt
   ihn auf `accepted`, das Ablehnen auf `revoked`. Trifft für einen
   Space eine Einladung mit anderer Aufnahme-Kennung ein, wird der
   Eintrag `pending` mit der neuen Kennung, unabhängig davon, ob das
   Gerät die vorherige Entfernung gesehen hat; publiziert wird nur, wenn
   die Aufnahme-Kennung des Space der Registry entspricht (Regel 5).
   Code-Lücke: `IncomingSpaceInvite` führt die Kennung heute nicht, der
   Adapter muss sie durchreichen. `pending` publiziert NIE, und
   `pending`-Spaces werden
   aus Gruppenliste, Cross-Group-Lesepfad und Übersicht gefiltert; sie
   erscheinen nur in der Annahme-Fläche. Die Annahme-Fläche ist eine
   Toolkit-Komponente, keine App-Logik (00 Regel 9). Die Annahme ist
   eine App-Ebene über der bestehenden WoT-Mitgliedschaft; bringt die
   RLTP-Umstellung Einladungen mit Annahme ins Protokoll, fällt sie mit
   ihr zusammen.
5. **Abgleich und Bestand.** Der Connector führt den Ziel-Zustand aus
   der Registry (Regel 9) herbei, je Eintrag:
   - `accepted` (und Aufnahme-Kennung des Space = `admission`): weicht
     `sha256(kanonisches Profil-Item)` vom gespeicherten `publishedHash`
     ab, wird ein neuer Schnappschuss publiziert. Fehlt der Slot im
     Ziel-Space, ist er ungültig (Signatur, Regel 8) oder trägt er eine
     niedrigere Version als die Registry-Position, wird ebenfalls neu
     publiziert (Reparatur, Regel 9); eine Ablage der alten JWS ist dafür
     nicht nötig.
   - `revoked`: liegt im Ziel-Space kein Tombstone mit Version ≥ der
     Registry-Position, wird ein Tombstone publiziert, sofern die Person
     noch Mitglied ist.
   - `pending`, oder Aufnahme-Kennung ≠ `admission`: nichts.
   Jede Publikation, Live wie Tombstone, trägt
   `seq = 1 + max(seq aller Registry-Einträge dieses itemId)`, also den
   home-weiten Zähler pro Item aus 09 Invariante 6, nicht den des
   einzelnen Ziels; die Registry hält je Ziel nur die Position der
   letzten dortigen Publikation. Auslöser: Start nach dem
   Erstsync-Signal des persönlichen Space, Änderung des Profil-Items,
   Änderung der Registry (auch von einem anderen Gerät), Änderung der
   Mitgliedschaften oder Aufnahme-Kennung, Änderung des eigenen Slots
   in einem Ziel-Space (der Autor ist dort Mitglied und beobachtet das
   Doc). Der Hash folgt der kanonischen Serialisierung aus 09
   (RFC 8785).
   **Übergangsregel:** Mitgliedschaften, die VOR Einführung dieser Spec
   bestanden, gelten als freigegeben. Der Connector legt für sie
   `accepted`-Einträge an und setzt im Home-Doc die Marke
   `profileMigration.bestandAt`; ist die Marke gesetzt, läuft die
   Übergangsregel auf keinem Gerät der Person erneut, spätere
   Mitgliedschaften laufen über Regel 4. Grundlage ist das heutige
   Vertrauensmodell: Mitgliedschaft in einem Space bedeutet pauschales
   Vertrauen in dessen Mitglieder, und das Profil ist der Inhalt, den die
   Person diesen Mitgliedern ohnehin zeigt. Die pauschale Freigabe ist je
   Space widerrufbar (Regel 6) und wird der Person einmalig angezeigt.
   Mit der RLTP-Umstellung (abgestuftes Vertrauen) entfällt die
   Grundlage; die Regel wird dann gestrichen.
6. **Widerruf.** Die Person kann die Freigabe jederzeit zurücknehmen,
   auch ohne den Space zu verlassen. Reihenfolge, absturzsicher: ERST
   wird der Tombstone signiert und in die dauerhafte Outbox gelegt, DANN
   der Registry-Eintrag auf `revoked` gesetzt (nie gelöscht, `seq`
   bleibt). Die Zustellung ist eventual: bis der Tombstone im Ziel-Space
   angekommen ist, bleibt der Mirror für Mitglieder lesbar; die Outbox
   wiederholt, und der Abgleich (Regel 5, Fall `revoked`) publiziert
   erneut, solange im Ziel-Space kein Tombstone liegt. Verlässt sie den
   Space, geschieht dasselbe VOR dem Verlassen, auch offline (Outbox,
   dann verlassen). Konkurrenz zwischen
   Widerruf auf Gerät A und Publizieren auf Gerät B: beide erhöhen `seq`
   nach 09; nach dem Merge der Registry gilt der Status `revoked`, und
   der Abgleich (Regel 5) publiziert den Tombstone mit höherer `seq`
   nach, falls ein Live-Schnappschuss gewonnen hatte. Eine erneute
   Freigabe setzt `accepted` und publiziert mit dem home-weiten Zähler
   (Regel 5), also oberhalb des Tombstones.
7. **Mitgliedschaftsbindung.** Ein Profil-Mirror ist nur sichtbar,
   solange `authorDid` Mitglied des Ziel-Space ist; alle Empfänger
   MÜSSEN Mirrors von Nicht-Mitgliedern ausblenden. Verliert die Person
   die Mitgliedschaft (der Space verschwindet aus ihrer Space-Liste),
   setzt ihr Connector den Registry-Eintrag auf `revoked`; eine erneute
   Aufnahme ist eine neue Einladung mit neuer Aufnahme-Kennung und läuft
   immer über Regel 4 (`pending`), publiziert also nie mit der alten
   Freigabe, auch wenn ein Gerät Entfernung und Wiederaufnahme offline
   verpasst hat. Entfernt ein Admin eine Person, kann diese keinen
   Tombstone senden; deshalb entfernt der ausführende Client ERST den
   Mirror-Inhalt aus `mirrors` und ruft DANN `removeMember`. Der
   Activity-Eintrag dazu ist `delete` mit `actor` = Admin-DID, ohne
   `origin: "mirror"` (kein Schnappschuss wird angewendet) und mit
   qualifizierter `targetId` `space:{homeSpaceId}/item:{did}`, derselben
   Adresse wie bei Anlage und Aktualisierung des Mirrors (10 Regel 10).
   Schlägt `removeMember` fehl, ist die Person noch Mitglied; ihr
   Abgleich (Regel 5) sieht den fehlenden Slot und stellt den Mirror
   selbst wieder her. Die High-Water-Marken bleiben (09 Invariante 8).
   Restrisiko: ein vor der Entfernung signierter, noch ungesehener
   Schnappschuss kann nach einer Wiederaufnahme eintreffen und liegt
   über den Marken; er ist Inhalt, den die Person damals freigegeben
   hatte, und der Abgleich nach der neuen Annahme überschreibt ihn mit
   höherer `seq`.
8. **Empfängerprüfung, verschärft.** Zusätzlich zu 09 Invariante 6 MUSS
   ein Empfänger bei jedem Profil-Schnappschuss, Live wie Tombstone,
   `itemId === authorDid` prüfen und bei Live-Schnappschüssen
   (`item ≠ null`) zusätzlich `item.data.did === authorDid`. Außerdem
   MUSS der Schlüssel der `mirrors`-Map, unter dem die JWS liegt, gleich
   `JSON.stringify([payload.homeSpaceId, payload.itemId])` sein, und
   `payload.targetSpaceId` gleich dem eigenen Space (09 Invariante 4).
   Ein gültig signierter Schnappschuss unter fremdem Schlüssel wird
   nicht materialisiert, setzt keine Marke und gilt als ungültiger Slot;
   sonst könnte ein Mitglied mit seinem eigenen Profil-Schnappschuss den
   Slot einer anderen Person besetzen, ohne dass deren Reparatur
   (Regel 5) anspringt. Damit ist
   ein Profil-Schlüssel nicht besetzbar (das Home-Origin-TOFU-Restrisiko
   aus 09 Invariante 5 entfällt für Profile): nur die Inhaberin der DID
   kann unter diesem Schlüssel signieren. `homeSpaceId` bleibt eine
   Behauptung (die Private-Space-ID ist aus dem Seed abgeleitet und für
   Empfänger nicht nachrechenbar); sie trägt für Profile keine
   Sicherheitslast.
9. **Ablage und Registry.** Mirrors liegen NICHT in `items` des
   Space-Doc: der heutige `CrossGroupIndex` schlüsselt kanonisch nach
   `(groupId, itemId)`, kennt aber keinen Tripel-Schlüssel
   `(targetSpaceId, homeSpaceId, itemId)` (09 Invariante 1) und DARF
   deshalb keine Mirrors führen. `RlsSpaceDoc` erhält eine eigene Map
   `mirrors`, Schlüssel `JSON.stringify([homeSpaceId, itemId])`, Wert
   die Compact-JWS (09: Wire-Format = nur die JWS). Je Schlüssel wird
   nur ein Schnappschuss gehalten. Weil der Slot ein CRDT-Register ist,
   kann er nach nebenläufigen Schreibvorgängen oder durch ein Mitglied,
   das einen alten gültigen Schnappschuss zurückschreibt, eine niedrigere
   Version tragen als die höchste je akzeptierte. High-Water-Marken und
   Bindung hält jedes Empfängergerät lokal und dauerhaft; die
   Resurrection-Garantie aus 09 Invariante 8 gilt für Geräte mit diesen
   Marken. Ein frisches Gerät ohne Marken übernimmt den vorgefundenen
   Slot nach Signaturprüfung; das Maximum stellt der Autor-Abgleich
   durch Neupublikation mit höherer `seq` wieder her (Regel 5,
   Reparatur). Die Registry der Freigaben liegt im Home-Doc:
   `mirrorRegistry`, Schlüssel `JSON.stringify([itemId, targetSpaceId])`,
   Wert
   `{ status: "pending" | "accepted" | "revoked", admission, seq, deviceId, tiebreak, publishedHash?, updatedAt }`
   als Lesesicht. `admission` ist die Aufnahme-Kennung der Einladung,
   auf die sich der Status bezieht (Regel 4); `seq`, `deviceId` und
   `tiebreak` sind die volle Ordnungsposition der letzten Publikation in
   diesen Ziel-Space (09 Invariante 6), `publishedHash` der Hash des
   zuletzt publizierten Items (bei Tombstone leer). Einträge werden NIE
   gelöscht. **Merge-Vertrag:** die Lesesicht ist ein Ergebnis, kein
   überschreibbarer Wert. Ein Registry-Eintrag darf beim Merge nie
   zurückfallen; deshalb schreibt jedes Gerät nur unter seinem eigenen
   `deviceId`-Schlüssel (`byDevice[deviceId] = { statusSeq, status,
   admission, seq, tiebreak, publishedHash?, updatedAt }`), und die
   Lesesicht wird deterministisch abgeleitet: die Position ist das
   Maximum aller Geräte-Positionen in der Ordnung
   `(seq, deviceId, tiebreak)`, `publishedHash` ist der Hash dieser
   gewinnenden Position; der Status folgt der höchsten `admission`
   (Aufnahme-Kennungen sind über `currentKeyGeneration` geordnet) und
   innerhalb derselben `admission` dem höchsten `statusSeq`
   (Lamport-Zähler der Statuswechsel, `statusSeq = 1 + max(beobachtet)`),
   bei Gleichstand `revoked` vor `pending` vor `accepted`. So gewinnt
   ein Widerruf nie gegen eine nebenläufige Live-Publikation nur
   deshalb, weil deren Wert zuletzt geschrieben wurde, und
   `max(seq aller Einträge dieses itemId)` in Regel 5 ist monoton. Beide
   Felder sind additiv; alte Clients ignorieren sie.
10. **Lesemodell.** Verifizierte Mirrors erscheinen über `getItems`,
    `getItem`, `observe` und `observeItem` des Ziel-Space als gewöhnliche
    Items (Feed, Karte, Liste, AdaptivePanel, Kontakte via
    `hasSchema person/v1`); die Einzelauflösung nach `id` findet Mirrors,
    weil `id` die DID ist und je Space höchstens ein Profil pro DID
    existiert. Relation-Targets `global:{did}` lösen im Ziel-Space auf
    den Mirror dieser DID auf, im persönlichen Space auf das Home;
    `space:{home}/item:{did}` folgt 09 Invariante 10. Der Connector
    annotiert Mirrors im Lesemodell mit der Relation
    `{ predicate: "mirrorOf", target: "space:{homeSpaceId}/item:{did}", meta: { ts } }`
    (Target-Konvention aus 04 §Relations). Das erfüllt 09 Invariante 7
    (als Schnappschuss erkennbar, Herkunft als Behauptung) ohne neues
    Item-Feld. Mirrors sind read-only; Bearbeiten öffnet immer das Home.
    In der Übersicht („Mein Netzwerk") zeigt die UI je logischem
    Schlüssel `(homeSpaceId, did)` einen Eintrag: das Home, falls
    vorhanden, sonst die Mirror-Instanz mit der höchsten Version
    `(seq, deviceId, tiebreak)`.
11. **Kein Verzeichnisdienst.** Mirrors entstehen ausschließlich aus dem
    Home über die Bridge, nie aus dem Profilverzeichnis (wot-profiles,
    `discovery.resolveProfile`). Die bestehenden Aufrufer des Dienstes im
    wot-connector bleiben bis zur RLTP-Umstellung; neue kommen nicht
    hinzu. Insbesondere erreicht `position` den Dienst nie.
12. **Home-Quelle.** Das Profil-Item im persönlichen Space ist die
    kanonische Quelle; es liegt im deterministischen persönlichen Space
    (Sync 001), nie in einem Legacy-Duplikat. Alle Schreibpfade
    (`updateMyProfile`, `updateProfile`) schreiben das Item und bilden
    `displayName`, `bio`, `avatarUrl` per Write-through auf `doc.profile`
    (`name`, `bio`, `avatar`) im PersonalDoc ab; `doc.profile` bleibt als
    Übergangsprojektion für den Verzeichnisdienst und die Kontakt-Anzeige
    bestehen. Migration: erst nach dem Erstsync-Signal des persönlichen
    Space und nur, wenn das Item dann fehlt und `doc.profile` existiert,
    legt der Connector das Item aus `doc.profile` an; Migration wie
    jede Projektion des eigenen Profils setzt `id`, `createdBy` und
    `data.did` auf die DID (Regel 1). Trifft
    `doc.profile` später ein (Wiederherstellung) und das Item existiert,
    gilt das Item; fehlt es noch, wird dann migriert. Die Gegenrichtung
    `doc.profile` → Item gibt es außerhalb dieser Migration nicht.
13. **Connectoren ohne Signaturidentität** (Mock, Local, Supabase)
    liefern dieselbe Item-Form (Regel 1 bis 3) und dieselbe
    `mirrorOf`-Annotation, führen das Profil aber als gewöhnliches Item
    je Space, ohne JWS; sie sind eine Vertrauensdomäne. Ihre
    Ersatzidentität ist die Nutzer-ID des Connectors: `id`, `createdBy`
    und `data.did` tragen diese ID statt einer DID. Regel 8 (Signatur-
    und Schlüsselprüfung) gilt nur für den WoT-Connector. UI-Flächen
    sehen keinen Unterschied.
14. **Capability-Vertrag.** `ProfileCapable` bleibt der technische
    Vertrag für das eigene Profil (lesen, schreiben, Sync-Status) und
    wird um die Freigaben erweitert, damit die Annahme-Fläche (Regel 4)
    keine App-Logik braucht: `observeProfileShares()` liefert je Space
    den Status `pending | accepted | revoked` aus der Registry;
    `acceptSpace(spaceId)` und `declineSpace(spaceId)` beantworten eine
    ausstehende Einladung (Regel 4); `shareProfile(spaceId)` und
    `revokeProfileShare(spaceId)` setzen die Freigabe nachträglich oder
    nehmen sie zurück (Regel 6). Der Type Guard bleibt `hasProfile()`;
    Connectoren ohne Freigaben (Regel 13) liefern `accepted` für jede
    Mitgliedschaft. 03 führt die Erweiterung. Kontakte und
    Verifikationen sind nicht dasselbe wie Profile; WoT-Identität und
    Attestations werden hier nicht neu definiert.

## Nicht-Ziele

Diese Spec definiert nicht: Personas je Space (RLTP-Umstellung), die
Relation Platzhalter↔Profil, MirrorGrant, Kommentare und Reaktionen auf
Profil-Items, die Ablösung der Verzeichnisdienst-Aufrufer.
