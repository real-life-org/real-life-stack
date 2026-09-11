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
   sind N signierte Schnappschüsse. Ausstehende Spaces zeigen keine
   Inhalte und erhalten keinen Mirror. Die Annahme-Fläche ist eine
   Toolkit-Komponente, keine App-Logik (00 Regel 9). Die Annahme ist
   eine App-Ebene über der bestehenden WoT-Mitgliedschaft; bringt die
   RLTP-Umstellung Einladungen mit Annahme ins Protokoll, fällt sie mit
   ihr zusammen.
5. **Abgleich und Bestand.** Beim Start und bei jeder Profiländerung
   prüft der Connector für jeden Space mit Freigabe in der Registry:
   liegt der Home-Stand über der zuletzt publizierten `seq`, wird
   publiziert. **Übergangsregel:** Mitgliedschaften, die VOR Einführung
   dieser Spec bestanden, gelten beim ersten Start als freigegeben; der
   Connector trägt sie in die Registry ein und publiziert. Grundlage ist
   das heutige Vertrauensmodell: Mitgliedschaft in einem Space bedeutet
   pauschales Vertrauen in dessen Mitglieder, und das Profil ist der
   Inhalt, den die Person diesen Mitgliedern ohnehin zeigt. Die
   pauschale Freigabe ist je Space widerrufbar (Regel 6), wird der
   Person einmalig angezeigt und gilt genau einmal, für den Bestand zum
   Zeitpunkt der Einführung; jede spätere Mitgliedschaft läuft über
   Regel 4. Mit der RLTP-Umstellung (abgestuftes Vertrauen) entfällt die
   Grundlage; die Regel wird dann gestrichen. `seq` folgt 09 Invariante 6
   (Lamport, Registry im Home-Doc, alle Autor-Geräte sehen sie).
6. **Widerruf.** Die Person kann die Freigabe jederzeit zurücknehmen,
   auch ohne den Space zu verlassen: Tombstone publizieren (09
   Invariante 8), Freigabe aus der Registry löschen. Verlässt sie den
   Space, geschieht dasselbe VOR dem Verlassen. Ist das Gerät offline:
   Tombstone in die Outbox, dann verlassen; Zustellung best-effort.
7. **Mitgliedschaftsbindung.** Ein Profil-Mirror ist nur sichtbar,
   solange `authorDid` Mitglied des Ziel-Space ist. Entfernt ein Admin
   eine Person, kann diese keinen Tombstone mehr senden; deshalb MUSS der
   Client, der die Entfernung ausführt, in derselben Operation den
   Mirror-Inhalt aus dem Space-Doc entfernen, und alle Empfänger MÜSSEN
   Mirrors von Nicht-Mitgliedern ausblenden. Die High-Water-Marken
   bleiben (09 Invariante 8). Tritt die Person erneut bei, publiziert sie
   mit höherer `seq`, und der Mirror ersteht regulär.
8. **Empfängerprüfung, verschärft.** Zusätzlich zu 09 Invariante 6 MUSS
   ein Empfänger bei Profil-Schnappschüssen `itemId === authorDid` und
   `item.data.did === authorDid` prüfen. Damit ist ein Profil-Schlüssel
   nicht besetzbar (das Home-Origin-TOFU-Restrisiko aus 09 Invariante 5
   entfällt für Profile): nur die Inhaberin der DID kann unter diesem
   Schlüssel signieren. `homeSpaceId` bleibt eine Behauptung (die
   Private-Space-ID ist aus dem Seed abgeleitet und für Empfänger nicht
   nachrechenbar); sie trägt für Profile keine Sicherheitslast.
9. **Ablage im Ziel-Space.** Mirrors liegen NICHT in `items` des
   Space-Doc (09 Invariante 1: der heutige Index führt nackte `item.id`).
   `RlsSpaceDoc` erhält eine eigene Map `mirrors`, Schlüssel
   `JSON.stringify([homeSpaceId, itemId])`, Wert die Compact-JWS (09:
   Wire-Format = nur die JWS). Es wird je Schlüssel nur der zuletzt
   akzeptierte Schnappschuss gehalten; High-Water-Marken und Bindung hält
   jedes Empfängergerät lokal und dauerhaft. Die Registry der Freigaben
   liegt im Home-Doc: `mirrorRegistry`, Schlüssel
   `JSON.stringify([itemId, targetSpaceId])`, Wert `{ seq }`. Beide
   Felder sind additiv; alte Clients ignorieren sie.
10. **Lesemodell.** Verifizierte Mirrors erscheinen über `getItems` und
    `observe` des Ziel-Space als gewöhnliche Items (Feed, Karte, Liste,
    AdaptivePanel, Kontakte via `hasSchema person/v1`). Der Connector
    annotiert sie im Lesemodell mit der Relation
    `{ predicate: "mirrorOf", target: "space:{homeSpaceId}/item:{did}", meta: { ts } }`
    (Target-Konvention aus 04 §Relations). Das erfüllt 09 Invariante 7
    (als Schnappschuss erkennbar, Herkunft als Behauptung) ohne neues
    Item-Feld. Mirrors sind read-only; Bearbeiten öffnet immer das Home.
    In der Übersicht („Mein Netzwerk") zeigt die UI je logischem
    Schlüssel `(homeSpaceId, did)` einen Eintrag, das Home hat Vorrang.
11. **Kein Verzeichnisdienst.** Mirrors entstehen ausschließlich aus dem
    Home über die Bridge, nie aus dem Profilverzeichnis (wot-profiles,
    `discovery.resolveProfile`). Die bestehenden Aufrufer des Dienstes im
    wot-connector bleiben bis zur RLTP-Umstellung; neue kommen nicht
    hinzu. Insbesondere erreicht `position` den Dienst nie.
12. **Home-Quelle.** Das Profil-Item im persönlichen Space ist die
    kanonische Quelle. `updateMyProfile` schreibt das Item; `doc.profile`
    im PersonalDoc wird aus dem Item abgeleitet (Write-through: `name`,
    `bio`, `avatar`) und bleibt als Übergangsprojektion für den
    Verzeichnisdienst und die Kontakt-Anzeige bestehen. Migration: fehlt
    das Item beim Start und existiert `doc.profile`, legt der Connector
    das Item aus `doc.profile` an. Die Gegenrichtung gibt es nicht.
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
