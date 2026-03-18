# Sync-Call Anton & Sebastian — 18. März 2026

## Live-Test der Referenz-App (WoT-Connector)

Anton und Sebastian haben die aktuelle Referenzimplementierung gemeinsam getestet — End-to-End mit dem WoT-Connector:

1. **Neue Accounts erstellt** (jeweils eigene WoT-Identität)
2. **Gegenseitige Verifizierung** via QR-Code
3. **Gruppe gegründet** und gegenseitig eingeladen
4. **Kanban Board** in der gemeinsamen Gruppe genutzt

Ergebnis: Alles hat funktioniert — Echtzeit-Sync, Mitglieder-Verwaltung, Items erstellen/verschieben. Die Reaktivität war durchgängig gegeben.

## Architektur-Review: reaktivitaet.md

Wir sind das Dokument `docs/spec/reaktivitaet.md` Schritt für Schritt durchgegangen und haben offene Fragen geklärt:

### Forward vs. Reverse Relations

- **Forward-Relations** leben im Item (`item.relations[]`) — kommen beim Laden gratis mit (z.B. Assignees eines Tasks)
- **Reverse-Relations** sind eigene Items die auf das Eltern-Item zeigen — müssen per `useRelatedItems()` geladen werden (z.B. Kommentare)
- Faustregel: Wenige, feste Verknüpfungen → Forward. Unbegrenzt wachsend → Reverse (eigenes Item)
- `global:` Prefix für User-IDs (DIDs), `item:` für Item-Referenzen

### Pagination: Limit/Offset statt Cursor

- Im CRDT-Fall liegen alle Items lokal im Speicher — Paging ist eine UI-Optimierung, keine Netzwerk-Optimierung
- Cursor-basiertes Paging löst Probleme von serverseitigen Datenbanken, die im CRDT-Fall nicht existieren
- Pattern: `limit` das wächst (Infinite Scroll), kein klassischer Paginator
- Wurde direkt implementiert: `limit`/`offset` in `ItemFilter`, `RelatedItemsOptions` und `IncludeDirective`, durchgängig in allen 4 Connectors

### Item-Attribute vs. Relations

- Fachdaten (title, status, description, priority) → `item.data`
- Verknüpfungen zu anderen Entitäten → `item.relations[]`
- Relations in `data` einbetten ist ein Anti-Pattern

## Implementierte Änderungen (Anton + Eli im Anschluss)

### Schnittstelle & Docs
- `ItemFilter` + `RelatedItemsOptions` + `IncludeDirective`: `limit`/`offset` Felder hinzugefügt
- `applyPagination()` Helper in `base-connector.ts`
- Alle 4 Connectors (Mock, Local, WoT, GraphQL) aktualisiert
- `reaktivitaet.md` überarbeitet: Forward/Reverse Relations klar beschrieben, Pagination-Abschnitt, Scope-Prefixe
- `architektur2.md` aktualisiert

### Bugfixes & UI-Verbesserungen (während der Session)
- SVG-Gruppenbilder werden nicht mehr durch Canvas-Rasterisierung beschnitten
- QR-Scanner: schwarzes Kamerabild behoben (Video-Stream-Zuweisung nach React-Render)
- GitHub Pages SPA-Routing für Deep Links
- Modul-Toggles in Gruppen werden jetzt korrekt persistiert und synchronisiert
- Profil-Dialog: Layout überarbeitet (analog zum Gruppen-Dialog)
- StatCards: zentriertes Layout
- Passwort-Felder in `<form>` gewrappt (Browser-Autofill)
- Diverse Mobile-Fixes (Footer-Buttons, Hover-Only-Elemente)

## Nächste Schritte

- **Sebastian:** Kommentare und Reaktionen für Items einbauen (Content Composer erweitern)
- **Anton:** WoT-Connector und Web of Trust weiter härten — Ziel: das Tool im Alltag für die Koordination unseres Projektes nutzen
- **Gemeinsam:** Performance-Messungen durchführen und monitoren — wie stabil und performant ist die aktuelle Architektur? Welche Belastungen und Objektmengen hält sie stand?

## Nächstes Meeting

**Freitag, 20. März 2026**

## Stimmung

Beide begeistert vom aktuellen Projektstand. Die Architektur trägt, der WoT-Connector funktioniert End-to-End, und die gemeinsame Session hat gezeigt, dass die Grundlagen solide sind.
