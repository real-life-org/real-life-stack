# Sync-Call Anton & Sebastian — 17. März 2026

## Sebastians Update: Content Composer

Sebastian hat den **Content Composer** weiterentwickelt und in den Real Life Stack integriert — ein universelles Formular, mit dem sich Items aller Art erstellen und bearbeiten lassen (Posts, Kalendereinträge, Karteneinträge etc.). Als nächstes plant er Kommentare und Reaktionen einzubauen.

## Diskussion: Kommentare & Laden von Content

Wir haben besprochen, wie Kommentare in der bestehenden Architektur abgebildet werden:

- Kommentare sind **eigene Items** mit einer `commentOn`-Relation zum Eltern-Item
- Laden über `include`-Direktive mit `limit` (z.B. erste 3 Kommentare inline mit dem Post)
- Nachladen über `getRelatedItems()`
- Erstellen über `createItem()` mit Relation — das Observable feuert automatisch
- Für Paging ("mehr Kommentare laden") fehlt aktuell noch `offset`/`cursor` in der `IncludeDirective`

Referenz: `docs/spec/architektur2.md`, Abschnitt "Relations" (Zeile 437ff)

## Antons Update: Web of Trust

- **E2E-Tests:** Umfangreiche Ende-zu-Ende-Tests erstellt, insbesondere für Offline-Szenarien
- **Encrypted Blob Store:** Konzept für verschlüsselte Binärdaten (Profilbilder, Anhänge) über IPFS
  - Performance kein Problem — eigener Kubo-Node mit HTTP-Gateway, normaler `fetch()`
  - DSGVO gelöst durch Crypto-Shredding + Zero-Knowledge-Betreiber
  - Referenz: `web-of-trust/docs/concepts/encrypted-blob-store.md`
- **Langfristige Idee:** Auch wot-vault und wot-profiles perspektivisch über IPFS abwickeln
- **Graphenansicht:** Neue Graph-Visualisierung in der WoT-Demo gezeigt

## IPFS-Diskussion

- Wir setzen IPFS (Kubo) als Encrypted Blob Store ein für Content wie Profilbilder und Dateien
- Kein Performance-Nachteil: eigener Node, HTTP-Gateway, kein P2P-Lookup nötig
- DSGVO: Unpin + GC löscht physisch, Crypto-Shredding als Fallback
- Wir sind Software-Entwickler (kein DSGVO-Controller), nur für eigene Instanz utopia-lab.org verantwortlich
- Selbst als Betreiber: Zero-Knowledge (nur Ciphertext + DIDs + öffentliche Profile)

## Strategische Richtung

- Die **WoT-Demo soll aus RLS-Komponenten aufgebaut** werden — der Kreis schließt sich:
  - WoT-Protokoll → WoT-Connector → Real Life Stack (Datenfluss)
  - RLS-UI-Komponenten → zurück in die WoT-Demo (Komponentenfluss)
- Anton sieht die **WoT-Demo als eigenständiges Produkt**: relativ ausgereift, verständliche Story, gute Landingpage, halbfertiges Promo-Video — nicht nur eine Protokoll-Demo

## Nächste Schritte (bis Do 20. März, 10 Uhr)

### Anton
- [ ] Reaktivität von Items, Gruppen und Relations — klare Schnittstellendefinition + AI-Instruktionen (kein Bypass durch Schichten)
- [ ] Gruppenlogik im RLS stabilisieren
- [ ] Übergreifende Metagruppe definieren (beinhaltet alle anderen Gruppen)

### Sebastian
- [ ] Kommentar-Schnittstelle implementieren (`commentOn`-Relation + `createItem`)
- [ ] Content Composer auf GitHub pushen
