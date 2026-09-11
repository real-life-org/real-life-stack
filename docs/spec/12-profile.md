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
| Canonical Home | persönlicher Space der Person (`rls-private`) |
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
   Profil/Platzhalter läuft ausschließlich über `data.did`. Ein Item mit
   `data.did ≠ createdBy` ist ungültig. Eine Relation
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
   sind N signierte Schnappschüsse. Der Registry-Eintrag (Regel 9)
   entsteht mit Status `pending`, sobald der Space auf einem Gerät der
   Person erscheint; die Annahme setzt ihn auf `accepted`, das Ablehnen
   auf `revoked`. `pending` publiziert NIE, und `pending`-Spaces werden
   aus Gruppenliste, Cross-Group-Lesepfad und Übersicht gefiltert; sie
   erscheinen nur in der Annahme-Fläche. Die Annahme-Fläche ist eine
   Toolkit-Komponente, keine App-Logik (00 Regel 9). Die Annahme ist
   eine App-Ebene über der bestehenden WoT-Mitgliedschaft; bringt die
   RLTP-Umstellung Einladungen mit Annahme ins Protokoll, fällt sie mit
   ihr zusammen.
5. **Abgleich und Bestand.** Der Connector führt den Ziel-Zustand aus
   der Registry (Regel 9) herbei, je Eintrag:
   - `accepted`: weicht `sha256(kanonisches Profil-Item)` vom
     gespeicherten `publishedHash` ab, wird ein neuer Schnappschuss mit
     `seq = 1 + registry.seq` publiziert. Liegt im Ziel-Space ein Slot
     mit niedrigerer Version als `(registry.seq, registry.deviceId,
     registry.tiebreak)`, schreibt der Autor seinen letzten Schnappschuss
     erneut (Reparatur, Regel 9).
   - `revoked`: liegt im Ziel-Space kein Tombstone mit Version ≥ der
     Registry-Version, wird ein Tombstone mit `seq = 1 + registry.seq`
     publiziert, sofern die Person noch Mitglied ist.
   - `pending`: nichts.
   Auslöser: Start nach dem Erstsync-Signal des persönlichen Space,
   Änderung des Profil-Items, Änderung der Registry (auch von einem
   anderen Gerät), Änderung der Mitgliedschaften. `seq` folgt 09
   Invariante 6 (Lamport, Registry im Home-Doc, alle Autor-Geräte sehen
   sie); der Hash folgt der kanonischen Serialisierung aus 09 (RFC 8785).
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
   auch ohne den Space zu verlassen: der Eintrag wird `revoked` (nie
   gelöscht, `seq` bleibt), ein Tombstone wird publiziert (09
   Invariante 8). Verlässt sie den Space, geschieht dasselbe VOR dem
   Verlassen; ist das Gerät offline, geht der Tombstone in die Outbox,
   dann wird verlassen; Zustellung best-effort. Konkurrenz zwischen
   Widerruf auf Gerät A und Publizieren auf Gerät B: beide erhöhen `seq`
   nach 09; nach dem Merge der Registry gilt der Status `revoked`, und
   der Abgleich (Regel 5) publiziert den Tombstone mit höherer `seq`
   nach, falls ein Live-Schnappschuss gewonnen hatte. Eine erneute
   Freigabe setzt `accepted` und publiziert mit `seq = 1 + registry.seq`,
   also oberhalb des Tombstones.
7. **Mitgliedschaftsbindung.** Ein Profil-Mirror ist nur sichtbar,
   solange `authorDid` Mitglied des Ziel-Space ist; alle Empfänger
   MÜSSEN Mirrors von Nicht-Mitgliedern ausblenden. Verliert die Person
   die Mitgliedschaft (der Space verschwindet aus ihrer Space-Liste),
   setzt ihr Connector den Registry-Eintrag auf `revoked`; eine erneute
   Aufnahme läuft immer über Regel 4 (`pending`), publiziert also nie mit
   der alten Freigabe. Entfernt ein Admin eine Person, kann diese keinen
   Tombstone senden; deshalb entfernt der ausführende Client ERST den
   Mirror-Inhalt aus `mirrors` (Activity-Eintrag `delete`, `actor` =
   Admin-DID, ohne `origin: "mirror"`, weil kein Schnappschuss
   angewendet wird; 10 Regel 10 bleibt auf Schnappschüsse beschränkt)
   und ruft DANN `removeMember`. Schlägt das Entfernen fehl, ist die
   Person noch Mitglied und ihr Abgleich (Regel 5) stellt den Mirror
   selbst wieder her. Die High-Water-Marken bleiben (09 Invariante 8).
   Restrisiko: ein vor der Entfernung signierter, noch ungesehener
   Schnappschuss kann nach einer Wiederaufnahme eintreffen und liegt
   über den Marken; er ist Inhalt, den die Person damals freigegeben
   hatte, und der Abgleich nach der neuen Annahme überschreibt ihn mit
   höherer `seq`.
8. **Empfängerprüfung, verschärft.** Zusätzlich zu 09 Invariante 6 MUSS
   ein Empfänger bei jedem Profil-Schnappschuss, Live wie Tombstone,
   `itemId === authorDid` prüfen und bei Live-Schnappschüssen
   (`item ≠ null`) zusätzlich `item.data.did === authorDid`. Damit ist
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
   wieder her (Regel 5, Reparatur). Die Registry der Freigaben liegt im
   Home-Doc: `mirrorRegistry`, Schlüssel
   `JSON.stringify([itemId, targetSpaceId])`, Wert
   `{ status: "pending" | "accepted" | "revoked", seq, deviceId, tiebreak, publishedHash?, updatedAt }`;
   `seq`, `deviceId` und `tiebreak` sind die volle Ordnungsposition des
   zuletzt publizierten Schnappschusses (09 Invariante 6),
   `publishedHash` der Hash des zuletzt publizierten Items (bei
   Tombstone leer). Einträge werden NIE gelöscht. Beide Felder sind
   additiv; alte Clients ignorieren sie.
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
    legt der Connector das Item aus `doc.profile` an. Trifft
    `doc.profile` später ein (Wiederherstellung) und das Item existiert,
    gilt das Item; fehlt es noch, wird dann migriert. Die Gegenrichtung
    `doc.profile` → Item gibt es außerhalb dieser Migration nicht.
13. **Connectoren ohne Signaturidentität** (Mock, Local, Supabase)
    liefern dieselbe Item-Form (Regel 1 bis 3) und dieselbe
    `mirrorOf`-Annotation, führen das Profil aber als gewöhnliches Item
    je Space, ohne JWS; sie sind eine Vertrauensdomäne. Die
    JWS-Sicherung ist Teil des WoT-Connectors. UI-Flächen sehen keinen
    Unterschied.
14. `ProfileCapable` bleibt der technische Vertrag (eigenes Profil lesen,
    schreiben, Sync-Status). Kontakte und Verifikationen sind nicht
    dasselbe wie Profile; WoT-Identität und Attestations werden hier
    nicht neu definiert.

## Nicht-Ziele

Diese Spec definiert nicht: Personas je Space (RLTP-Umstellung), die
Relation Platzhalter↔Profil, MirrorGrant, Kommentare und Reaktionen auf
Profil-Items, die Ablösung der Verzeichnisdienst-Aufrufer.
