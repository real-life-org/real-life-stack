# Space Module Spec Template

**Status:** Vorlage

Kopiere dieses Raster für neue Space-Module-Specs. Die Vorlage beschreibt nicht, wie ein Modul aussehen muss, sondern welche Fragen jede verbindliche Moduldefinition beantworten soll.

## Zweck

Kurz beschreiben:

- Welches Problem löst das Modul im Current Space?
- Welche wiederholte Nutzung soll es unterstützen?
- Welche anderen RLS-Flächen dürfen davon profitieren?

## Einordnung

| Frage | Antwort |
|---|---|
| Space Module? | Ja / Nein |
| App-Shell-Fläche? | Ja / Nein |
| Module Components | Liste wiederverwendbarer Bausteine |
| Primäre Datenbasis | Items / Relations / Confirmations / Capabilities |
| Externe Semantik | RLNP / Real Life Game / WoT / keine |

## Datenmodell

Beschreiben, welche Projektionen das Modul liest:

| Projektion | Muss? | Quelle | Bedeutung im Modul |
|---|---:|---|---|
| Items | ja/nein | `DataInterface` | ... |
| Relations | ja/nein | `RelationCapable` | ... |
| Confirmations | ja/nein | `ConfirmationCapable` | ... |
| Groups/Spaces | ja/nein | `GroupManager` / App Shell | ... |

Regeln:

1. Top-level Item-Felder bleiben auf den RLS-Core beschränkt.
2. Fachliche Felder liegen in `item.data`.
3. Beziehungen liegen in `item.relations[]` oder werden über `RelationCapable` geladen.
4. Trust- oder Completion-Aussagen werden als Confirmations angezeigt, nicht aus Item-Feldern erfunden.

## Capabilities

| Capability | Verhalten, wenn vorhanden | Verhalten, wenn fehlt |
|---|---|---|
| `DataInterface` | ... | Modul kann nicht lesen |
| `ItemWriter` | ... | Schreibaktionen ausblenden oder deaktivieren |
| `RelationCapable` | ... | relationale Features ausblenden oder als leer anzeigen |
| `GroupManager` | ... | Current Space muss von App Shell kommen |
| `Authenticatable` | ... | Nutzerbezogene Aktionen ausblenden oder anonymisieren |
| `ProfileCapable` | ... | Profilinformationen fallbacken auf IDs |
| `ConfirmationCapable` | ... | Trust-/Badge-Anzeigen ausblenden |
| `ConfirmationWriterCapable` | ... | Bestätigungsaktionen ausblenden |

## Aktionen

Beschreiben, welche Aktionen das Modul anbietet:

| Aktion | Voraussetzung | Effekt |
|---|---|---|
| ... | Capability / Relation / Item | ... |

Regeln:

1. Eine Aktion darf nur angeboten werden, wenn die benötigten Capabilities vorhanden sind.
2. Mutationen laufen über Hooks oder Capability-Interfaces, nicht direkt gegen Backends.
3. Optimistic UI darf die spätere Connector-Wahrheit nicht überschreiben.

## Komponenten

| Komponente | Rolle | Wiederverwendbar? |
|---|---|---|
| ... | ... | ja/nein |

## Cross-Module-Verhalten

Beschreiben, wie das Modul mit anderen Modulen zusammenspielt, ohne sie hart zu koppeln.

Beispiele:

- Item mit `location` kann zur Map geöffnet werden.
- Item mit `start` / `end` kann im Calendar erscheinen.
- Item mit `status` kann im Kanban erscheinen.
- Quest- oder Campaign-Projektionen können an das Quests-Modul oder die Campaign View übergeben werden.

## Nicht-Ziele

Explizit festhalten, was das Modul nicht definiert.

Beispiele:

- keine Backend-Schema-Migration,
- keine RLNP-Fachsemantik,
- keine Game-Regeln,
- keine WoT-Attestation-Formate,
- keine globale Berechtigungslogik.

## Abnahme

Vor der Übergabe gegen [01 → Die Modulfläche ist eine Spalte](../01-app-composition.md#die-modulfläche-ist-eine-spalte), [01 → Der Modul-Host](../01-app-composition.md#der-modul-host) und [shared-components.md](shared-components.md) prüfen:

- Das Modul ist genau ein Registereintrag; `presents` nennt Felder oder Klassen mit Affordanz, keine Typnamen als Abkürzung.
- Das Modul lädt keine Items, registriert weder Detail noch Erstellen und hält keinen Fokus; das stellt der Host her. Ausnahme: `loads: "module"`, dann lädt und filtert es selbst.
- Suche, Vokabular, Filterkarte und Chips kommen von der Fläche. Eigene Steuerelemente gehen über `ModuleToolbar` in den Kopf; eine eigene Kopfzeile gibt es nicht.
- Beim Erstellen schlägt das Modul höchstens einen Typ vor und belegt Felder vor; es schränkt die Auswahl nicht ein.
- Jede Item-Karte ist eine `ItemPreview`. Detail und Bearbeiten kommen aus dem Register (`ItemDetailView`, `ContentComposer`), nicht aus dem Modul.
- Fehlt eine Capability, verhält sich das Modul wie in der Tabelle „Capabilities“ angegeben.
- Das Modul läuft ohne eine Zeile in der App, mindestens in einer Story.
- Jede eigene Komponente ist unter „Komponenten“ begründet oder als fehlender Baustein im Toolkit gemeldet.

## Implementierungsreferenzen

Links auf bestehende Code- oder Demo-Stellen, wenn vorhanden.

## Offene Punkte

Offene Fragen knapp und konkret sammeln.
