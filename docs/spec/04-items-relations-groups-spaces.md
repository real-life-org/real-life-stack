# Items, Relations, Groups and Spaces

**Status:** Normativer Entwurf v0.1

Diese Spec beschreibt die technische Projektionsfläche, auf der RLS soziale oder spielerische Semantik darstellen kann, ohne sie selbst zu besitzen.

Code-Referenzen:

- `packages/data-interface/src/index.ts`
- `packages/data-interface/src/item-types.ts`
- [reaktivitaet.md](reaktivitaet.md)

## Items

Ein `Item` ist die kleinste allgemeine RLS-Einheit für darstellbare Inhalte.

Ein Item kann zum Beispiel sein:

- Task,
- Event,
- Post,
- Place,
- Profile,
- Comment,
- Reaction,
- Quest,
- Project,
- Evidence,
- Adventure- oder Campaign-View.

Diese Liste ist offen. RLS reserviert nur den technischen Vertrag, nicht die fachliche Bedeutung.

## Item-Typen

`type` steuert, wie UI-Flächen ein Item interpretieren können. Bekannte Typen im Code sind aktuell:

```text
task, event, post, place, feature, person, reaction, comment
```

Regeln:

1. Connectoren dürfen weitere `type`-Werte liefern.
2. UI-Flächen dürfen bekannte Typen spezialbehandeln, müssen aber unbekannte Typen robust ignorieren oder generisch anzeigen.
3. Fachliche Semantik darf nicht allein aus `type` abgeleitet werden, wenn `schema`, `data` oder `relations` genauer sind.
4. RLNP- und Game-Typen dürfen als Items erscheinen, werden aber in ihren eigenen Repositories definiert.

## Data-Felder

`data` ist ein offenes Objekt. UI-Flächen können Felder interpretieren:

| Feld | Typische View |
|---|---|
| `status` | Kanban oder Workflow |
| `start` / `end` | Kalender |
| `location` | Karte |
| `content` | Feed oder Detailansicht |
| `title` | Listen, Karten, Detailansichten |

Regeln:

1. Gemeinsame UI-Felder liegen in `data`, nicht top-level.
2. Flächen- oder schema-spezifische Felder dürfen existieren, müssen aber andere UI-Flächen nicht brechen.
3. Ein Item kann in mehreren Space Modules erscheinen, wenn seine Felder dazu passen.
4. UI-Flächen dürfen keine Backend-Annahmen in `data` kodieren.

## Relations

Relations verbinden Items mit Kontext.

```ts
interface Relation {
  predicate: string
  target: string
  meta?: Record<string, unknown>
}
```

### Target-Konventionen

| Prefix | Bedeutung | Beispiel |
|---|---|---|
| `item:` | Item im selben Group-/Space-Kontext | `item:task-1` |
| `space:{id}/item:` | Item in einem anderen Space | `space:garden/item:task-1` |
| `global:` | globale Identität, meistens User-ID oder DID | `global:did:key:z6Mk...` |

Regeln:

1. Relations leben in `item.relations[]`, nicht eingebettet in `data`.
2. `predicate` ist offen und darf domänenspezifisch sein.
3. `meta` darf Zusatzinformationen tragen, ersetzt aber nicht das Ziel.
4. Cross-Space-Relations müssen für UI und Connectoren als möglich behandelt werden, auch wenn nicht jeder Connector sie voll auflösen kann.
5. Space-IDs DÜRFEN die Zeichenfolge `/item:` nicht enthalten; damit ist `space:{id}/item:{itemId}` am ersten `/item:` eindeutig zerlegbar, auch wenn `itemId` sie enthält.

## Forward und Reverse

Forward-Relation:

```text
Task --assignedTo--> User
```

Das Item trägt die Relation selbst. Wenige, feste Beziehungen können so modelliert werden.

Reverse-Relation:

```text
Post <--commentOn-- Comment
```

Ein anderes Item zeigt auf das aktuelle Item. Wachsende Mengen wie Kommentare, Reaktionen oder Subtasks sollen als eigene Items modelliert und per `RelationCapable` geladen werden.

Regeln:

1. Wenige, feste Beziehungen dürfen Forward-Relations sein.
2. Eigenständige oder unbegrenzt wachsende Inhalte sollen eigene Items mit Reverse-Relation sein.
3. UI soll Reverse-Relations über Hooks wie `useRelatedItems()` laden, nicht durch manuelles Filtern aller Items.
4. Details zur Reaktivität stehen in [reaktivitaet.md](reaktivitaet.md).

## Groups und Spaces

RLS verwendet technisch `Group`.

```ts
interface Group {
  id: string
  name: string
  members?: string[]
  data?: Record<string, unknown>
}
```

In WoT- und RLNP-Kontexten entspricht eine `Group` häufig einem Space.

Regeln:

1. Eine Group ist ein technischer Arbeits-, Sichtbarkeits- und Mitgliedschaftskontext.
2. Eine Group ist nicht automatisch ein Projekt, Netzwerk, Verein oder soziale Organisation.
3. Ein Projekt kann als Item existieren, als eigener Space organisiert sein oder beides verbinden.
4. Netzwerke, Labels oder White-Label-Kontexte sind nicht automatisch Groups; sie können mehrere Groups oder Spaces umfassen.
5. Group-Metadaten liegen in `Group.data` und müssen additiv erweiterbar bleiben.

## Space-Metadaten

Space-Metadaten (Name, Image, Modules) liegen gemäß Regel #5 in `Group.data` (Ausnahme `name`, top-level). `updateGroup` bildet den gesamten `data`-Patch auf die `_meta`-Map des Space ab (via `updateSpace`) und synct ihn darüber. Code-Referenz: `packages/wot-connector/src/wot-connector.ts` (`updateGroup`).

`_meta` kennt zwei Klassen von Feldern:

- **Framework-Felder** mit festen Schlüsseln, die das Sync-Vokabular selbst definiert (`name`, `description`, `image`, `modules`).
- **App-Felder** in `_meta.appData`, einem offenen Namensraum für anwendungsspezifische Metadaten (z.B. `primaryColor`). Neue App-Felder erfordern KEINE Änderung an Sync-Vokabular oder Adaptern.

Regeln:

1. Kanonische Quelle der Space-Metadaten ist `Group.data`; `_meta` ist die synchronisierte Projektion für andere Geräte und Leseflächen.
2. Neue Metadatenfelder MÜSSEN demselben Muster folgen: Wert in `Group.data.<feld>`, Abbildung nach `_meta` über `updateGroup`. Ein Feld, das das Sync-Vokabular als Framework-Feld führt, wird auf dessen festen Schlüssel abgebildet; jedes andere Feld wandert nach `_meta.appData.<feld>`.
3. `updateGroup` behandelt `data` als flachen PATCH, nicht als Ersetzung: gelistete Schlüssel werden über die gespeicherten gemergt, `null` löscht einen Schlüssel (JSON Merge Patch, RFC 7386, Tiefe 1). Nicht genannte Felder bleiben unangetastet — nur so können mehrere unabhängige Schreiber (etwa Logo-Upload und Modul-Sortierung in derselben Dialog-Sitzung) sich nicht gegenseitig überschreiben. Connectoren MÜSSEN diese Semantik über die gemeinsame Implementierung `applyGroupDataPatch` erfüllen.
4. Abgeleitete Anzeigefelder (z.B. `scope`) sind KEINE Metadaten und werden nicht gesynct.
5. `image` MUSS eine **auflösbare** Bildquelle sein: eine Data-URL, wie sie der Space-Dialog beim Hochladen schreibt, eine absolute URL, oder ein wurzel-relativer Pfad, den `resolveAssetUrl` gegen den Basispfad der Auslieferung auflöst. Ein **bloßer Dateiname** ist unzulässig — er trägt seinen Ablageort nicht, und `resolveAssetUrl` reicht ihn unverändert durch, sodass jede Lesefläche ihn selbst zusammensetzen müsste. Der leere String bedeutet „kein Bild" und ist der Zustand nach dem Entfernen des Logos; `null` löscht den Schlüssel nach Regel 3. Für dasselbe Bild DARF es kein zweites Feld geben: `avatar` stand bis 09/2026 daneben, trug Dateinamen, wurde an genau einer Stelle mit dem Basispfad zusammengesetzt und blieb überall sonst unsichtbar — unter anderem im Space-Dialog (rls#382).

### Aussehen eines Space

Ein Space stellt sein Aussehen über **Achsen** ein, nicht über einzelne Farbwerte. Die Achsen sind App-Felder im offenen `appData`-Namensraum nach obigem Muster (Wert in `Group.data`, Spiegelung nach `_meta.appData` über `updateGroup`): `primaryColor` (die Akzentfarbe) und `tint` (die Tönung der Flächen). Aus ihnen leitet das Toolkit den Tokensatz ab; die Kaskade Space → Instanz → Toolkit und die Ableitung definiert [11](11-runtime-config-und-branding.md).

Regeln:

1. `Group.data.primaryColor` ist die kanonische Quelle; `_meta.appData.primaryColor` ist die synchronisierte Projektion. `primaryColor` MUSS ein Hex-Farbwert der Form `#rrggbb` sein. Jede Farbe ist zulässig; die Ableitung macht aus jeder eine brauchbare Skala.
2. Beim Logo-Upload MUSS der Client die dominanteste Farbe des Logos extrahieren und das Ergebnis in `Group.data.primaryColor` cachen. Die Extraktion läuft client-seitig genau einmal beim Upload, nicht bei jedem Render und nicht auf jedem Gerät neu.
3. Ohne Logo MUSS `primaryColor` deterministisch aus der Space-ID abgeleitet werden, analog zu `getTagColor` / `getTagAccentColor` in `packages/toolkit/src/lib/utils.ts`. Die Ableitung MUSS über Geräte und Sessions stabil sein und DARF NICHT echtes Random verwenden. Ein Space erbt seine Akzentfarbe also **nicht** von der Instanz — jeder Space hat seine eigene.
4. Wird ein Logo entfernt, SOLL `primaryColor` wieder auf den deterministischen ID-Fallback zurückfallen.
5. `primaryColor` ist Cache und Default, kein Pflicht-Eingabefeld. Fehlt der Wert, MÜSSEN Leseflächen den deterministischen ID-Fallback berechnen.
6. `Group.data.tint` ist eine Zahl 0–1. Fehlt sie, erbt der Space die Tönung der Instanz. Eine explizite 0 ist ein Wert („keine Tönung, obwohl die Instanz eine hat") und wird gespeichert; `null` löscht den Schlüssel (Regel 3 der Space-Metadaten) und stellt die Vererbung wieder her. Ein Wert außerhalb des Bereichs wird gekappt, ein anderer Typ ignoriert.

### Wirkung des Aussehens

Solange ein Space aktiv ist, speisen seine Achsen den Tokensatz der App und geben ihm eine eigene visuelle Identität — Akzent **und** Stimmung der Flächen.

Regeln:

1. Während ein Space aktiv ist, MÜSSEN seine Achsen (nach der Kaskade in [11](11-runtime-config-und-branding.md)) den Tokensatz der App speisen: Akzent, Fokusring, aktive Navigations- und Sidebar-Elemente aus der Akzentskala; Hintergrund, Karten, Rahmen und Text aus der neutralen Skala, die der Tönung folgt. Der Satz wird am App-Root gesetzt, sodass auch portalte Flächen ihn übernehmen.
2. Ist kein Space aktiv (Übersicht „Mein Netzwerk", No-Access), gelten die Achsen der Instanz.
3. Fehler-, Warn- und Diagrammfarben gehören nicht dem Space ([11](11-runtime-config-und-branding.md), Regel 4).
4. Map-Marker KÖNNEN `primaryColor` als Default-Markerfarbe verwenden, wenn kein item- oder tag-spezifischer Akzent greift (Tag-Akzent über `getTagAccentColor` hat Vorrang).
5. UI-Flächen MÜSSEN ohne gesetzte Achsen robust bleiben (ID-Fallback, Instanz-Tönung).
6. Text auf Flächen MUSS 4.5:1 halten, der Fokusring 3:1 — für jede Farbe; die Ableitung garantiert das. Die Schrift auf der Akzentfläche ist **weiß**, schwarz nur auf sehr hellen Akzenten: eine Gestaltungsentscheidung, kein Kontrastoptimum. Ihr Kontrast wird gemessen und im Space angezeigt, nicht erzwungen.
7. Im dunklen Schema MUSS die Akzentfläche hell genug sein, um auf dunklem Grund zu wirken; die Ableitung hebt dunkle Akzente dort an. Im hellen Schema bleibt die Akzentfarbe exakt, wie gewählt.
8. Hell oder dunkel entscheidet der Mensch am Gerät. Ein Space DARF das Schema nicht vorschreiben.

## Profile

Ein Profil ist das person-Item einer Person mit DID. Es lebt genau einmal im persönlichen Space und erscheint in Gruppen-Spaces als Mirror nach [09-mirror-bridge.md](09-mirror-bridge.md). Form, Freigabe, Widerruf und Ablage definiert [12-profile.md](12-profile.md). `ProfileCapable` bleibt der technische Vertrag; Kontakte und Verifikationen sind nicht dasselbe wie Profile; WoT-Identität und Attestations werden im RLS-Item-Modell nicht neu definiert.

## RLNP und Real Life Game

RLNP- und Game-Objekte können über Items, Relations, Groups und Confirmations sichtbar werden.

Beispiele:

| Bedeutung | Mögliche RLS-Projektion |
|---|---|
| Quest | `Item` mit `type: "quest"` |
| QuestRun | `Item` mit `type: "quest-run"` |
| Evidence | Feld im QuestRun, Relation zu bestehendem Item oder eigenes Item |
| Project | Item, Space oder beides |
| Badge | View auf Confirmation oder Attestation |
| Campaign | View über Items, Relations, Groups und Confirmations |

Regel:

> RLS stellt diese Formen dar und macht sie bedienbar. Die soziale Bedeutung bleibt RLNP, die Spielgestaltung bleibt Real Life Game, portable signierte Wahrheit bleibt WoT Attestation.

## Nicht-Ziele

Diese Spec definiert nicht:

- den RLNP-Quest-Vertrag,
- Adventure- oder Campaign-Regeln,
- WoT-Attestation-Formate,
- Rollen- oder Safety-Policies,
- ein geschlossenes soziales Datenmodell.

RLS bleibt die technische Projektions- und Bedienoberfläche.
