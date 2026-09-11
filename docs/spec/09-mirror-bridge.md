# Mirror und Bridge — Items in mehreren Spaces

**Status:** Normativer Entwurf v0.1 (Vertrag aus P0 der Netzwerk-App;
Implementierung in P2, davor darf kein Code Mirrors erzeugen)

Diese Spec definiert, wie ein Item in mehreren Spaces erscheint: als
Referenz, nicht als Klon. Sie legt die Invarianten fest, gegen die P2
implementiert wird.

Code-Referenzen:

- `packages/wot-connector/src/CrossGroupIndex.ts` (heutiger Index, Schlüssel `(groupId, itemId)`, kein Tripel)
- `packages/wot-connector/src/types.ts` (`RlsSpaceDoc`, `SerializedItem`)
- [04-items-relations-groups-spaces.md](04-items-relations-groups-spaces.md) (Target-Konvention `space:{id}/item:`)
- [12-profile.md](12-profile.md) (erste Anwendung: Profil-Mirrors; konkretisiert Doc-Map `mirrors` im Ziel-Space und `mirrorRegistry` im Home-Doc)

## Begriffe

- **Canonical Home:** der eine Space, in dem ein Item lebt und editiert wird.
- **Mirror:** ein read-only Snapshot des Items in einem anderen Space.
- **Bridge (Brücken-Client):** ein Client, der Mitglied beider Spaces ist und
  autor-signierte Snapshots vom Home in den Ziel-Space überträgt.

## Snapshot-Form

```ts
/**
 * Die PAYLOAD der Compact-JWS. Das Wire-Format ist die JWS selbst —
 * dieser Typ enthält deshalb bewusst KEIN signature-Feld.
 */
interface MirrorSnapshotPayload {
  homeSpaceId: string
  itemId: string
  /** der EINE Ziel-Space dieser Freigabe (Invariante 4) */
  targetSpaceId: string
  /** seq: home-weit replizierter Lamport-Zähler; ts: reine Anzeigezeit — Ordnung s. Invariante 6 */
  version: { seq: number; deviceId: string; ts: string }
  /** null = Tombstone (Item im Home gelöscht) */
  item: SerializedItem | null
  /** MUSS bei item ≠ null gleich item.createdBy sein (Invariante 5) */
  authorDid: string
}
```

**Kanonische signierte Payload:** Die Felder `homeSpaceId`, `itemId`,
`targetSpaceId`, `version`, `item`, `authorDid` werden nach **RFC 8785
(JSON Canonicalization Scheme)** serialisiert (UTF-8). Die JWS signiert
exakt diese Bytes; `tiebreak` in Invariante 6 ist `sha256` über dieselben
Bytes (lowercase Hex). Damit sind Signaturprüfung und Versionsvergleich
implementierungsunabhängig deterministisch.

**Wire-Format = nur die JWS:** Übertragen wird ausschließlich die
Compact-JWS (wie in `wot-core/src/protocol/crypto/jws.ts`); der
TypeScript-Typ oben beschreibt die **Payload-Struktur**, nicht das
Wire-Format. Empfänger MÜSSEN alle Feldwerte aus der verifizierten
JWS-Payload lesen. Unsignierte äußere Kopien der Felder sind unzulässig —
sonst prüft eine Implementierung die JWS und verwendet danach manipulierte
Außenfelder.

## Invarianten

1. Die Identität eines gespiegelten Items ist der zusammengesetzte Schlüssel
   `(homeSpaceId, itemId)`. Kein Index DARF Mirror-Instanzen unter nacktem
   `itemId` mit Home-Instanzen zusammenführen. Der heutige `CrossGroupIndex`
   schlüsselt kanonisch nach `(groupId, itemId)`, kennt aber keinen
   Tripel-Schlüssel und DARF deshalb keine Mirrors führen. Zu trennen
   sind dabei logische und physische Identität: logisch ist das
   gespiegelte Item `(homeSpaceId, itemId)`, eine konkrete
   Mirror-Instanz ist `(targetSpaceId, homeSpaceId, itemId)` — Indizes
   über mehrere Ziel-Spaces MÜSSEN den vollen Tripel-Schlüssel verwenden,
   sonst kollabiert derselbe Mirror aus zwei Ziel-Spaces erneut.
2. Es gibt genau ein Home. Der Schreibpfad existiert nur dort; ein Mirror
   schreibt NIE zurück. Damit existiert kein Cross-Space-Merge und kein
   Konfliktmodell zwischen Spaces — „Konflikt" reduziert sich auf den
   Versionsvergleich beim Snapshot-Empfang.
3. Snapshots sind autor-signiert (`createdBy`-DID). Dritte KÖNNEN Snapshots
   weiterreichen, aber nicht fälschen. Das Spiegeln eines Items in einen
   anderen Space ist eine bewusste Freigabe des Autors.
4. Die Freigabe ist an den Ziel-Space gebunden: `targetSpaceId` ist Teil
   der signierten Payload, und Empfänger MÜSSEN sie gegen die ID des
   eigenen Space prüfen. Eine Bridge kann eine gültige Freigabe damit
   NICHT in andere Spaces weiterkopieren, deren Mitglied sie zufällig ist.
   Spiegeln in N Spaces bedeutet N signierte Snapshots (Empfängerprinzip:
   Offenlegung ist adressatengebunden).
5. Signer-Bindung: Signer ist ausschließlich `createdBy` des Items
   (`authorDid` MUSS bei `item ≠ null` gleich `item.createdBy` sein) —
   auch wenn im Home weitere Editoren schreiben dürfen. Deren Änderungen
   erreichen den Mirror erst, wenn der Autor den gemergten Home-Stand neu
   publiziert. Die Erst-Annahme bindet `(homeSpaceId, itemId)` an die
   Signer-DID. Snapshots ANDERER Signer werden NIE materialisiert und
   binden nie um; sie werden aber signaturgeprüft, als eigene
   High-Water-Marke geführt (Invariante 6) und MÜSSEN als
   Herkunftskonflikt sichtbar gemacht werden — keine stille Verwerfung,
   keine automatische Umbindung. Die Bindung entsteht NUR durch
   einen Snapshot mit `item ≠ null` — dort ist `authorDid` gegen
   `item.createdBy` prüfbar. Tombstones etablieren NIE eine Bindung —
   sonst könnte ein gefälschter Erst-Tombstone die Identität fremdbinden
   und die Snapshots des echten Autors dauerhaft aussperren. Ein
   Tombstone zu einem unbekannten `(homeSpaceId, itemId)` wird aber NICHT
   verworfen, sondern als **ungebundene Tombstone-Marke**
   `(homeSpaceId, itemId, authorDid, version)` gespeichert: trifft später
   (Offline-Reihenfolge!) ein Live-Snapshot desselben `authorDid` mit
   niedrigerer `version` ein, MUSS er verworfen werden — sonst ersteht
   das gelöschte Item wieder auf. Live-Snapshots anderer Autoren bleiben
   von der Marke unberührt. Die Erst-Annahme ist dabei ausdrücklich
   **Home-Origin-TOFU**: der Empfänger ist im Home nicht Mitglied und
   kann die Behauptung, das Item stamme aus `homeSpaceId`, beim
   Erstkontakt nicht beweisen. Restrisiko: ein Angreifer kann ein noch
   ungespiegeltes `(homeSpaceId, itemId)` mit eigener DID besetzen; das
   blockiert genau diesen zusammengesetzten Schlüssel (und wird als
   Konflikt sichtbar, sobald der echte Autor publiziert), kompromittiert
   aber keine bestehenden Mirrors. UI-Flächen MÜSSEN die Herkunft als
   Behauptung ausweisen („laut Snapshot aus …"). Ein Provenienznachweis
   (Home-Mitgliedschafts-Beleg oder MirrorGrant) ist als Härtung
   vorgesehen, nicht Teil dieses Vertrags. Delegation an weitere Signer
   (z. B. UCAN) ist ebenfalls außerhalb — s. Nicht-Ziele (MirrorGrant).
6. Empfänger MÜSSEN die Signatur JEDES Snapshots (Live wie Tombstone)
   gegen dessen `authorDid` prüfen und führen pro
   `(homeSpaceId, itemId, authorDid)` die höchste akzeptierte `version`
   als High-Water-Mark über Live- UND Tombstone-Snapshots. Die
   Strikt-größer-Regel gilt je `authorDid`; **materialisiert** wird der
   Mirror ausschließlich aus Snapshots des gebundenen Signers
   (Invariante 5) — Marken fremder DIDs berühren ihn nicht. Ein Snapshot
   wird nur übernommen, wenn seine `version` in der totalen Ordnung
   STRIKT größer ist als die bisherige High-Water-Mark seines Autors.
   Die Marke speichert dafür die **vollständige Ordnungsposition
   `(seq, deviceId, tiebreak)`**: der tiebreak ist nicht Teil von
   `version` und MUSS beim Akzeptieren aus den kanonischen Payload-Bytes
   berechnet und mitpersistiert werden — sonst ist der Vergleich bei
   gleicher `(seq, deviceId)` nicht entscheidbar. Gültigkeitsprüfung vor
   jeder Übernahme: bei `item ≠ null` MUSS `item.id === itemId` UND
   `item.createdBy === authorDid` gelten, sonst ließe sich unter gültiger
   Signatur ein fremdes Item in den Schlüssel-Slot schieben.
   `seq` ist ein home-weit replizierter **Lamport-Zähler** pro
   gespiegeltem Item: die Freigabe samt letzter publizierter `seq` liegt
   als Registry im Home-Doc (dadurch sehen alle Autor-Geräte Freigabe und
   Zählerstand), und beim Publizieren gilt
   `seq = 1 + max(im Home beobachtete seq)`. Ein Gerät, das den gemergten
   Home-Stand publiziert, liegt damit immer über allen ihm bekannten
   Snapshots — getrennte lokale Zähler würden neuere Inhalte dauerhaft
   verwerfen lassen. Die totale Ordnung ist `(seq, deviceId, tiebreak)`
   lexikographisch mit `tiebreak = sha256(kanonische signierte Payload)`;
   offline gleichzeitig erzeugte Snapshots DÜRFEN dieselbe `seq` tragen,
   der Vergleich bleibt deterministisch, und der nächste Publish nach dem
   Merge korrigiert mit `seq + 1`. `ts` ist reine Anzeigezeit und NICHT
   Teil der Ordnung. Gleiche volle Version = identischer Snapshot =
   idempotenter Wiederempfang; kein Downgrade, kein Replay.
7. Frische ist best-effort: ein Mirror DARF veraltet sein und MUSS in der UI
   als Snapshot erkennbar bleiben (Herkunfts-Space, Stand/Zeitstempel).
8. Löschung propagiert als Tombstone-Snapshot (`item: null`) mit höherer
   `version`. Empfänger MÜSSEN den Mirror-Inhalt entfernen, die Marken
   aber dauerhaft behalten. Receipts und High-Water-Marken sind
   DERSELBE dauerhafte Bestand: pro `(homeSpaceId, itemId, authorDid)`
   die volle Ordnungsposition `(seq, deviceId, tiebreak)`, dazu die
   Bindungs-DID pro `(homeSpaceId, itemId)` — sonst ließe sich nach dem
   Tombstone ein älterer, gültig signierter Snapshot wieder einspielen
   (Resurrection). Ein Tombstone löscht Inhalt, nie die Marke — und
   etabliert nie eine Erst-Bindung (Invariante 5).
9. E2EE-Grenze: die Bridge ist Mitglied beider Spaces und verschlüsselt für
   den Ziel-Space neu; Relay und Nicht-Mitglieder sehen weiterhin nur
   Ciphertext. Ein Mirror macht Inhalte für alle Mitglieder des Ziel-Space
   sichtbar — das ist Teil der Freigabe aus Invariante 3.
10. RelationRecords sind Items ([08-relation-records.md](08-relation-records.md))
    und werden nach denselben Regeln gespiegelt. Ihre Endpunkt-Relations
    bleiben im Snapshot **byte-treu home-relativ**: ein Umschreiben vor
    dem Signieren würde den Item-Inhalt verändern und damit die
    deterministische Relation-`id` aus 08 brechen (sie hasht `from`/`to`).
    Stattdessen gilt eine Auflösungsregel beim Empfänger: relative
    `item:`-Targets eines Mirrors MÜSSEN im Kontext seines `homeSpaceId`
    interpretiert werden (`item:x` ⇒ Mirror-Instanz
    `(targetSpaceId, homeSpaceId, x)`), NIE gegen den lokalen Space.
11. **Mitgliedschaftsbindung.** Ein Mirror ist nur sichtbar, solange sein
    Autor Mitglied des Ziel-Space ist; Empfänger MÜSSEN Mirrors von
    Nicht-Mitgliedern ausblenden, gemessen am lokal bekannten
    Mitgliedschaftsstand (eine noch nicht synchronisierte Entfernung ist
    nicht ausführbar). Die Freigabe (Invariante 3) gilt den
    Mitgliedern eines Space; wer nicht mehr Mitglied ist, kann sie weder
    pflegen noch widerrufen, und sein Inhalt darf nicht ohne ihn im Space
    stehen bleiben. Verlässt der Autor den Space, publiziert er VORHER
    Tombstones für alle dort freigegebenen Items (absturzsicher: Tombstone
    in die dauerhafte Outbox, dann Registry-Status, dann verlassen;
    Zustellung eventual). Wird er entfernt, kann er keinen Tombstone
    senden; deshalb entfernt der ausführende Client ERST die
    Mirror-Inhalte des Autors aus `mirrors` (Activity `delete`, `actor` =
    ausführende Identität, kein `origin: "mirror"`, qualifizierte
    `targetId`; [10-activity-log.md](10-activity-log.md) Regel 10) und
    ruft DANN `removeMember`. Schlägt `removeMember` fehl, ist der Autor
    noch Mitglied, und sein Abgleich stellt die Mirrors wieder her. Die
    High-Water-Marken bleiben (Invariante 8). Verliert der Autor die
    Mitgliedschaft, setzt sein Connector die Registry-Einträge dieses
    Ziels auf `revoked`. Jede Freigabe ist an die **Aufnahme** des
    Autors im Ziel-Space gebunden (Kennung `admission`, §Ablage und
    Registry): eine spätere Wiederaufnahme hat eine höhere Kennung, und
    der Abgleich publiziert nur, wenn die Kennung des Ziel-Space der
    Freigabe entspricht. So publiziert auch ein Gerät, das Entfernung und
    Wiederaufnahme offline verpasst hat, nie mit der alten Freigabe; es
    braucht eine neue.

## Ablage und Registry

Mirrors liegen im Ziel-Space-Doc in einer eigenen Map `mirrors`, Schlüssel
`JSON.stringify([homeSpaceId, itemId])`, Wert die Compact-JWS. Sie liegen
NICHT in `items`: der heutige `CrossGroupIndex` schlüsselt kanonisch nach
`(groupId, itemId)`, kennt aber keinen Tripel-Schlüssel (Invariante 1).
Je Schlüssel wird nur ein Schnappschuss gehalten. Ein Empfänger MUSS vor
Materialisierung prüfen, dass der Map-Schlüssel gleich
`JSON.stringify([payload.homeSpaceId, payload.itemId])` und
`payload.targetSpaceId` der eigene Space ist (Invariante 4); ein
Schnappschuss unter fremdem Schlüssel gilt als ungültiger Slot und setzt
keine Marke. Weil der Slot ein CRDT-Register ist, kann er nach
nebenläufigen Schreibvorgängen oder durch ein Mitglied, das einen alten
gültigen Schnappschuss zurückschreibt, eine niedrigere Version tragen als
die höchste je akzeptierte. High-Water-Marken und Bindung (Invariante 6
und 8) hält jedes Empfängergerät lokal und dauerhaft; die
Resurrection-Garantie gilt für Geräte mit diesen Marken. Ein frisches
Gerät ohne Marken übernimmt den vorgefundenen Slot nach Prüfung; das
Maximum stellt der Autor-Abgleich durch Neupublikation mit höherer `seq`
wieder her.

Die Registry der Freigaben (Invariante 6) liegt im Home-Doc des Items:
`mirrorRegistry`, Schlüssel `JSON.stringify([itemId, targetSpaceId])`.
Jedes Gerät schreibt nur unter seinem eigenen `deviceId`-Schlüssel
(`byDevice[deviceId] = { statusSeq, status, admission, seq, tiebreak, publishedHash?, updatedAt }`,
Status `accepted | revoked`). `admission` ist die **Aufnahme-Kennung**
des Autors im Ziel-Space zum Zeitpunkt der Freigabe:
`SpaceInfo.admission = { keyGeneration }`, abgeleitet aus dem
synchronisierten Mitgliedschafts-Ereignis-Set `_members` des Ziel-Space
als Beginn des aktuellen ununterbrochenen Mitgliedschaftslaufs
(niedrigste `active`-Generation nach dem letzten `removed` der eigenen
DID; wot-core `resolveAdmission`). Sie ist auf allen Geräten gleich,
wird nirgends gespeichert; Schlüsselrotation und erneut zugestellte
Einladungen ändern sie nicht, erst ein `removed` schneidet den Lauf.
Ordnung: nach `keyGeneration`; **keine Kennung (`undefined`) liegt unter
jeder Kennung**. `undefined` entsteht in zwei Fällen, die beide „keine
gültige Aufnahme" bedeuten: der Ziel-Space hat noch keine Ereignisse
(Alt-Space), oder das Gewinner-Ereignis der eigenen DID ist `removed`.
Ein Gerätebeitrag setzt seine `admission` ausschließlich beim Schreiben
eines Statuswechsels; eine stille Nachführung gibt es NICHT. Eine neue
Freigabe (`shareItem`, Annahme) trägt die dann aktuelle Kennung des
Ziel-Space und setzt eine gültige Kennung voraus (bei `undefined` wird
sie abgelehnt). Ein Widerruf, explizit oder durch Mitgliedschaftsverlust,
trägt `max(admission der Lesesicht, aktuelle Kennung des Ziel-Space)`,
also nie eine niedrigere Kennung als die Freigabe, die er widerruft;
sonst verlöre er in der Lesesicht gegen den alten `accepted`-Beitrag
eines Offline-Geräts. Jeder Anstieg der Ziel-Kennung über die des
Eintrags, auch von `undefined` auf eine Kennung, ist eine Wiederaufnahme
(Abgleich unten).
Die Lesesicht wird deterministisch abgeleitet: Position =
Maximum aller Geräte-Positionen in der Ordnung
`(seq, deviceId, tiebreak)`, `publishedHash` der gewinnenden Position
(leer, wenn die gewinnende Publikation ein Tombstone war); Status nach
höchster `admission`, innerhalb derselben `admission` nach höchstem
`statusSeq` (Lamport-Zähler der Statuswechsel,
`statusSeq = 1 + max(beobachtet)`), bei Gleichstand `revoked` vor
`accepted`. Einträge werden NIE gelöscht. Jede Publikation, Live wie
Tombstone, trägt `seq = 1 + max(seq aller Einträge dieses itemId)`, den
home-weiten Zähler pro Item.

Der Abgleich ist ein Zielzustand, je Eintrag:

- `accepted` und Kennung des Ziel-Space = `admission`: existiert das
  Home-Item, wird publiziert, wenn `sha256(kanonisches Item)` vom
  `publishedHash` abweicht oder der Slot im Ziel fehlt, ungültig ist oder
  eine niedrigere Version trägt. **Fehlt das Home-Item** (gelöscht, auch
  durch einen anderen Home-Editor), wird ein Tombstone publiziert, bis im
  Ziel einer mit Version ≥ Registry-Position liegt; der Eintrag bleibt
  `accepted`, `publishedHash` ist leer. Nur der Autor signiert
  (Invariante 5); ein zurückkehrendes Autor-Gerät holt das nach.
- `accepted` und Kennung des Ziel-Space > `admission` (Wiederaufnahme,
  einschließlich `undefined` → Kennung): das Gerät schreibt seinen
  Beitrag als `revoked` mit der neuen Kennung; eine neue Freigabe
  braucht `shareItem`. Anwendungen KÖNNEN stattdessen einen
  Zwischenstatus führen ([12-profile.md](12-profile.md): `pending`).
  Der Preis: ein Alt-Space ohne Ereignisse verlangt beim ersten
  Auftauchen von Ereignissen eine neue Freigabe. Das ist gewollt, weil
  nicht entscheidbar ist, ob dazwischen eine Entfernung lag.
- `accepted` und Kennung des Ziel-Space < `admission` oder `undefined`
  bei gesetztem `admission` (Mitgliedschaft verloren): keine
  Publikation; der Beitrag wird `revoked` mit der `admission` der
  Lesesicht (Invariante 11), damit der Widerruf in der Faltung gegen
  jeden alten `accepted`-Beitrag derselben Aufnahme gewinnt.
- `revoked`: solange der Autor Mitglied des Ziel-Space ist, wird ein
  Tombstone publiziert, bis im Ziel einer mit Version ≥ Registry-Position
  liegt. Ist er kein Mitglied mehr oder existiert der Ziel-Space nicht
  mehr, bleibt der Eintrag `revoked` ohne Zustellversuch; die
  Sichtbarkeit regelt dann Invariante 11.

Auslöser: Erstsync des Home, Änderung des Items, Änderung der Registry
(auch von einem anderen Gerät), Änderung der Mitgliedschaft oder der
Aufnahme-Kennung, Änderung des eigenen Slots im Ziel-Space. Widerruf,
absturzsicher: ERST Tombstone signieren und in die dauerhafte Outbox,
DANN Status `revoked`; bis zur Zustellung bleibt der Mirror lesbar.

**Lesemodell beim Empfänger:** Verifizierte Mirrors erscheinen über
`getItems`, `getItem`, `observe` und `observeItem` des Ziel-Space als
gewöhnliche, read-only Items, annotiert mit der Relation
`{ predicate: "mirrorOf", target: "space:{homeSpaceId}/item:{itemId}", meta: { ts } }`
(Target-Konvention aus [04](04-items-relations-groups-spaces.md); erfüllt
Invariante 7 ohne neues Item-Feld). Bearbeiten öffnet immer das Home.
**Einzeladressierung:** weil ein Ziel-Space ein lokales Item `x` und
Mirrors `(homeA, x)`, `(homeB, x)` zugleich enthalten kann (Invariante 1;
deterministische Relation-IDs nach 08), akzeptieren `getItem` und
`observeItem` neben der nackten `id` die qualifizierte Form
`space:{homeSpaceId}/item:{itemId}` und liefern dann genau diese
Mirror-Instanz. Die nackte `id` liefert das lokale Item; fehlt es, die
Mirror-Instanz mit der höchsten Version. Home-relative Endpunkte eines
Mirrors (Invariante 10) werden vom Connector in die qualifizierte Form
seines `homeSpaceId` überführt, bevor sie aufgelöst werden. Listen
(`getItems`, `observe`) enthalten alle Instanzen; Flächen MÜSSEN als
Schlüssel `mirrorOf.target ?? id` verwenden, nie `id` allein.
Aggregierende Sichten über mehrere Spaces zeigen je logischem Schlüssel
`(homeSpaceId, itemId)` einen Eintrag: das Home, falls sichtbar, sonst
die Mirror-Instanz mit der höchsten Version.

## Capability-Vertrag

`MirrorCapable` (Type Guard `hasMirrors()`). Alle Autor-Operationen
adressieren das Item über sein Home, weil `itemId` allein nicht eindeutig
ist (Invariante 1; RelationRecords desselben Autors können in zwei Spaces
dieselbe deterministische `id` tragen, [08](08-relation-records.md)):

- `observeItemShares(homeSpaceId, itemId): Observable<Record<targetSpaceId, "accepted" | "revoked">>`
- `shareItem(homeSpaceId, itemId, targetSpaceId)`: die bewusste,
  zielgebundene Freigabe (Invariante 3 und 4), nur dem Autor
  (`createdBy`) erlaubt; legt oder erneuert den Registry-Eintrag mit der
  aktuellen Aufnahme-Kennung.
- `revokeItemShare(homeSpaceId, itemId, targetSpaceId)`.
- `observeMirrorConflicts(targetSpaceId): Observable<Array<{ homeSpaceId, itemId, boundAuthorDid, foreignAuthorDid, version }>>`:
  Empfängerseite; liefert die Herkunftskonflikte aus Invariante 5
  (gültig signierte Schnappschüsse fremder Signer, die nie materialisiert
  werden), damit UI-Flächen sie sichtbar machen können.

Die UI bietet die Freigabe im ItemDetail des Autors an („in weiteren
Spaces veröffentlichen": Auswahl der Ziel-Spaces, Liste der Freigaben
mit Widerruf). Connectoren ohne Signaturidentität liefern dieselbe
Item-Form und die `mirrorOf`-Annotation ohne JWS (eine Vertrauensdomäne)
und melden keine Konflikte. Die Profil-Operationen aus 12 Regel 14 setzen
auf diesem Vertrag auf (`homeSpaceId` = persönlicher Space, `itemId` =
DID). [03-capabilities.md](03-capabilities.md) führt die Capability.

## Nicht-Ziele

Diese Spec definiert nicht:

- Live-Sync oder CRDT-Merge zwischen Spaces (nur Snapshot-Transfer),
- ein neues Signaturformat (der JWS-Container des WoT wird wiederverwendet),
- automatisches Spiegeln ohne Autor-Freigabe,
- delegiertes Publizieren: ein zielgebundener **MirrorGrant**
  (delegierbare Publisher-Capability, etwa für Schlüsselverlust oder
  abwesende Autoren) ist als spätere Erweiterung vorgesehen, nicht Teil
  dieses Vertrags.
