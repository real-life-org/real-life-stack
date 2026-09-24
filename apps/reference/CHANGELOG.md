# Changelog

## [0.4.1](https://github.com/real-life-org/real-life-stack/compare/app-v0.4.0...app-v0.4.1) (2026-09-24)


### Features

* **app:** ein Symbol überall — das Puzzle-Favicon der Landing für Web-App, Site, Android und iOS ([#463](https://github.com/real-life-org/real-life-stack/issues/463)) ([c58adeb](https://github.com/real-life-org/real-life-stack/commit/c58adeb4e4e28d5e7ce3539bb8db737b31bb18b8))
* **toolkit:** Build-Zeile im Nutzer-Menü — welcher Stand läuft, so dezent wie möglich ([#461](https://github.com/real-life-org/real-life-stack/issues/461)) ([b68c3ad](https://github.com/real-life-org/real-life-stack/commit/b68c3ad96af68d95011f2f37c45d60362209afd0))


### Bug Fixes

* **toolkit:** Kartensteuerung aus den Tokens für alle Apps und Stories ([#476](https://github.com/real-life-org/real-life-stack/issues/476)) ([895f810](https://github.com/real-life-org/real-life-stack/commit/895f8103e53e907b8d899b0d549bb76136b5a82b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.3.1
    * @real-life-stack/local-connector bumped to 0.2.1
    * @real-life-stack/mock-connector bumped to 0.2.1
    * @real-life-stack/supabase-connector bumped to 0.3.1
    * @real-life-stack/toolkit bumped to 0.2.1
    * @real-life-stack/wot-connector bumped to 0.2.1

## [0.4.0](https://github.com/real-life-org/real-life-stack/compare/app-v0.3.3...app-v0.4.0) (2026-09-23)


### ⚠ BREAKING CHANGES

* **toolkit:** Der Modul-Host — B0 komplett (Schritte 1–5b + Codex-Fixes #415–#417) ([#414](https://github.com/real-life-org/real-life-stack/issues/414))
* **toolkit:** Vokabular, Filterkarte und Chips gehören der Fläche ([#407](https://github.com/real-life-org/real-life-stack/issues/407))
* **toolkit:** die Suche gehört der Fläche, das Modul nur seine eigenen Knöpfe ([#405](https://github.com/real-life-org/real-life-stack/issues/405))
* **toolkit:** Nachzug von #400 und #401 auf master ([#403](https://github.com/real-life-org/real-life-stack/issues/403))

### Features

* **network:** die Netzwerk-App läuft auf dem Modul-Host (Spec 01, Regel 5) ([#429](https://github.com/real-life-org/real-life-stack/issues/429)) ([55f571c](https://github.com/real-life-org/real-life-stack/commit/55f571c41cbb854493f8b4dd6de23166b8a26a45))
* **storybook:** Ordnung nach UI-Konzepten, feste Story-IDs, Gemeinschaftsgarten ([#398](https://github.com/real-life-org/real-life-stack/issues/398)) ([6099993](https://github.com/real-life-org/real-life-stack/commit/6099993dc56aee0643fbd5084b0ef92a0a333b4d))
* **toolkit:** das Kanban kommt vollstaendig aus dem Toolkit (B5) — alle sieben Module laufen ohne eine Zeile in der App ([#428](https://github.com/real-life-org/real-life-stack/issues/428)) ([920622d](https://github.com/real-life-org/real-life-stack/commit/920622d2bad3b2aa818fc0ae86c67a6b1dfb18bf))
* **toolkit:** der Feed kommt vollständig aus dem Toolkit (B1) ([#422](https://github.com/real-life-org/real-life-stack/issues/422)) ([36a04d0](https://github.com/real-life-org/real-life-stack/commit/36a04d01271117d813e11e32b4651fe737e2c0d5))
* **toolkit:** der Graph kommt vollstaendig aus dem Toolkit (B3) ([#426](https://github.com/real-life-org/real-life-stack/issues/426)) ([48c9b00](https://github.com/real-life-org/real-life-stack/commit/48c9b002577193dcdbea4f1430221914b31ea9b9))
* **toolkit:** Der Modul-Host — B0 komplett (Schritte 1–5b + Codex-Fixes [#415](https://github.com/real-life-org/real-life-stack/issues/415)–[#417](https://github.com/real-life-org/real-life-stack/issues/417)) ([#414](https://github.com/real-life-org/real-life-stack/issues/414)) ([97baf68](https://github.com/real-life-org/real-life-stack/commit/97baf683b212a784246711022b393d9002234be6))
* **toolkit:** der Rahmen einer App liegt im Toolkit (AppFrame, RoutedAppFrame) ([#430](https://github.com/real-life-org/real-life-stack/issues/430)) ([7f6d780](https://github.com/real-life-org/real-life-stack/commit/7f6d780f403ba38a237741e9b2a3f2ab15f6ed28))
* **toolkit:** die Liste kommt vollständig aus dem Toolkit (B2) ([#424](https://github.com/real-life-org/real-life-stack/issues/424)) ([464d145](https://github.com/real-life-org/real-life-stack/commit/464d14501cb68654273b5c6ca1da5e19f9cf1872))
* **toolkit:** die Resonanz kommt vollstaendig aus dem Toolkit (B4) ([#427](https://github.com/real-life-org/real-life-stack/issues/427)) ([2bc1cbc](https://github.com/real-life-org/real-life-stack/commit/2bc1cbcb5af856ad6e4304a97ef6ce56d8cc3193))
* **toolkit:** die Suche gehört der Fläche, das Modul nur seine eigenen Knöpfe ([#405](https://github.com/real-life-org/real-life-stack/issues/405)) ([a58f833](https://github.com/real-life-org/real-life-stack/commit/a58f8334f4ac02a4d00ce6cf72e80632a68d60b2))
* **toolkit:** Host-Dienste — Autor, aktives Item, Filterzustand, Scrollen, Karten-Regel ([#425](https://github.com/real-life-org/real-life-stack/issues/425)) ([9e62cd1](https://github.com/real-life-org/real-life-stack/commit/9e62cd1994544f4a0b74e0fe0c11e7cd18143c9e))
* **toolkit:** Vokabular, Filterkarte und Chips gehören der Fläche ([#407](https://github.com/real-life-org/real-life-stack/issues/407)) ([a0a7779](https://github.com/real-life-org/real-life-stack/commit/a0a7779f0c084460071f593ce56a2eda7691c9c6))


### Code Refactoring

* **toolkit:** Nachzug von [#400](https://github.com/real-life-org/real-life-stack/issues/400) und [#401](https://github.com/real-life-org/real-life-stack/issues/401) auf master ([#403](https://github.com/real-life-org/real-life-stack/issues/403)) ([fa2630f](https://github.com/real-life-org/real-life-stack/commit/fa2630f4ccc045af76d9d7986b4db98ed8806b25))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.3.0
    * @real-life-stack/local-connector bumped to 0.2.0
    * @real-life-stack/mock-connector bumped to 0.2.0
    * @real-life-stack/supabase-connector bumped to 0.3.0
    * @real-life-stack/toolkit bumped to 0.2.0
    * @real-life-stack/wot-connector bumped to 0.2.0

## [0.3.3](https://github.com/real-life-org/real-life-stack/compare/app-v0.3.2...app-v0.3.3) (2026-09-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/toolkit bumped to 0.1.10
    * @real-life-stack/wot-connector bumped to 0.1.10

## [0.3.2](https://github.com/real-life-org/real-life-stack/compare/app-v0.3.1...app-v0.3.2) (2026-09-16)


### Features

* **toolkit:** Aussehen als Achsen — Farbe mit drei Reglern, Tönung, ein Reset ([#389](https://github.com/real-life-org/real-life-stack/issues/389)) ([f3a5722](https://github.com/real-life-org/real-life-stack/commit/f3a572283b19e817fb9f330b6972438d022b8e66))
* **toolkit:** Rundung und Flächen als Achsen des Aussehens ([#391](https://github.com/real-life-org/real-life-stack/issues/391)) ([66f2e07](https://github.com/real-life-org/real-life-stack/commit/66f2e07f4656ebc59cbc04a274e77ae3797c0a55))
* **toolkit:** zwölfstufige Farbskalen aus einer frei gewählten Farbe ([#387](https://github.com/real-life-org/real-life-stack/issues/387)) ([9b6e298](https://github.com/real-life-org/real-life-stack/commit/9b6e298f51339471cd71df70c80e1bdabd738561))


### Bug Fixes

* ein Feld für das Space-Bild — data.image ([#382](https://github.com/real-life-org/real-life-stack/issues/382)) ([750397a](https://github.com/real-life-org/real-life-stack/commit/750397ae8be2a6d8c59741b3e57dd0566ca7f17e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.2.1
    * @real-life-stack/local-connector bumped to 0.1.6
    * @real-life-stack/mock-connector bumped to 0.1.6
    * @real-life-stack/supabase-connector bumped to 0.2.1
    * @real-life-stack/toolkit bumped to 0.1.9
    * @real-life-stack/wot-connector bumped to 0.1.9

## [0.3.1](https://github.com/real-life-org/real-life-stack/compare/app-v0.3.0...app-v0.3.1) (2026-09-15)


### Performance Improvements

* eine Karte rendert nur noch, wenn sie sich geaendert hat ([#376](https://github.com/real-life-org/real-life-stack/issues/376)) ([ba88ef1](https://github.com/real-life-org/real-life-stack/commit/ba88ef180de144b2b45fd44bc89541119acd2872))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/toolkit bumped to 0.1.8
    * @real-life-stack/wot-connector bumped to 0.1.8

## [0.3.0](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.10...app-v0.3.0) (2026-09-13)


### ⚠ BREAKING CHANGES

* **data-interface:** MirrorCapable, Profil-Freigaben, mirrorOf-Helfer (S1) ([#344](https://github.com/real-life-org/real-life-stack/issues/344))

### Features

* **data-interface:** MirrorCapable, Profil-Freigaben, mirrorOf-Helfer (S1) ([#344](https://github.com/real-life-org/real-life-stack/issues/344)) ([cd1392c](https://github.com/real-life-org/real-life-stack/commit/cd1392c43db7a6d08da32c93f585a29949c969ef))
* **toolkit:** mehrere Personen-Zuweisungen je Typ im Composer ([#359](https://github.com/real-life-org/real-life-stack/issues/359)) ([abedfe6](https://github.com/real-life-org/real-life-stack/commit/abedfe69ad5adedc4a72f2b19dd33566a665f230))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.2.0
    * @real-life-stack/local-connector bumped to 0.1.5
    * @real-life-stack/mock-connector bumped to 0.1.5
    * @real-life-stack/supabase-connector bumped to 0.2.0
    * @real-life-stack/toolkit bumped to 0.1.7
    * @real-life-stack/wot-connector bumped to 0.1.7

## [0.2.10](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.9...app-v0.2.10) (2026-09-09)


### Features

* **toolkit:** die Modulfläche besitzt den Kopf, der Filter gehört der App ([#318](https://github.com/real-life-org/real-life-stack/issues/318)) ([305451d](https://github.com/real-life-org/real-life-stack/commit/305451d3d54c00e9754e6a86ac114e2ec111412c))
* **toolkit:** die Modulfläche wird eine Spalte ([#315](https://github.com/real-life-org/real-life-stack/issues/315)) ([41f2456](https://github.com/real-life-org/real-life-stack/commit/41f2456f0508d8806942cc7cbb74a8d21e6436ec))
* **toolkit:** Filter-Pille und weißer Erstellen-Knopf wie im Design-Board ([#321](https://github.com/real-life-org/real-life-stack/issues/321)) ([5e26dc2](https://github.com/real-life-org/real-life-stack/commit/5e26dc2e57776624d88abb02416e50cfc43f9b0d))
* **toolkit:** Tag-Klick filtert, der Feed-Kopf bekommt einen Erstellen-Knopf ([#319](https://github.com/real-life-org/real-life-stack/issues/319)) ([8d0f8ec](https://github.com/real-life-org/real-life-stack/commit/8d0f8ec7443dc10a0eb4c7e7080fac8a30c121e1))


### Bug Fixes

* **reference:** die App darf den Standort abfragen ([#335](https://github.com/real-life-org/real-life-stack/issues/335)) ([3f1aa6b](https://github.com/real-life-org/real-life-stack/commit/3f1aa6ba30f0c894f66398a273182eadb20a7dc1))
* **toolkit:** der Drawer endet oben an der Schutzzone des Geräts ([#332](https://github.com/real-life-org/real-life-stack/issues/332)) ([fc96f76](https://github.com/real-life-org/real-life-stack/commit/fc96f768e4c1a41d3a033e6e64e27f9173a6ed5b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/toolkit bumped to 0.1.6
    * @real-life-stack/wot-connector bumped to 0.1.6

## [0.2.9](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.8...app-v0.2.9) (2026-09-09)


### Features

* **toolkit:** AdaptivePanel-Variante "floating" ([#304](https://github.com/real-life-org/real-life-stack/issues/304)) ([d49c5b1](https://github.com/real-life-org/real-life-stack/commit/d49c5b1890e05fa7d3307d23d761924910720d6b))
* **toolkit:** eigene Anatomie für die Detailansicht (PR 4) ([#307](https://github.com/real-life-org/real-life-stack/issues/307)) ([6d6976d](https://github.com/real-life-org/real-life-stack/commit/6d6976d7ee0cd600bf1a0884be439d0c1e65d507))
* **toolkit:** ein Feld führt zu der Sicht, die es darstellt ([#309](https://github.com/real-life-org/real-life-stack/issues/309)) ([6088c52](https://github.com/real-life-org/real-life-stack/commit/6088c5247e1090ac0bbb359f5d3f3cf0e6021cc5))
* **toolkit:** ItemPreview führt mit dem Titel (PR 1) ([#311](https://github.com/real-life-org/real-life-stack/issues/311)) ([82f8de9](https://github.com/real-life-org/real-life-stack/commit/82f8de92718aed4c7e57705907efc10cc8ec4bb6))


### Bug Fixes

* **toolkit:** dem Browser das Farbschema nennen ([#310](https://github.com/real-life-org/real-life-stack/issues/310)) ([d189e97](https://github.com/real-life-org/real-life-stack/commit/d189e970791a82b3bc3180bafe1c936d3fca06b5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/toolkit bumped to 0.1.5
    * @real-life-stack/wot-connector bumped to 0.1.5

## [0.2.8](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.7...app-v0.2.8) (2026-09-08)


### Bug Fixes

* **reference:** App folgt der Systemvorgabe und merkt sich die Wahl ([#302](https://github.com/real-life-org/real-life-stack/issues/302)) ([1eeb54d](https://github.com/real-life-org/real-life-stack/commit/1eeb54d9efda6716bb66700ab2761becd6ea41be))

## [0.2.7](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.6...app-v0.2.7) (2026-09-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.4
    * @real-life-stack/local-connector bumped to 0.1.4
    * @real-life-stack/mock-connector bumped to 0.1.4
    * @real-life-stack/supabase-connector bumped to 0.1.4
    * @real-life-stack/toolkit bumped to 0.1.4
    * @real-life-stack/wot-connector bumped to 0.1.4

## [0.2.6](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.5...app-v0.2.6) (2026-09-08)


### Features

* Erstsync auf neuen Geräten sichtbar machen ([#274](https://github.com/real-life-org/real-life-stack/issues/274)) ([dc02cf6](https://github.com/real-life-org/real-life-stack/commit/dc02cf6ffb255ae8aa90fba50f8209817c4d4641))
* **module:** Modul-Register als einzige Quelle ([#277](https://github.com/real-life-org/real-life-stack/issues/277)) ([1d3ee58](https://github.com/real-life-org/real-life-stack/commit/1d3ee5837270ada76f1ffbac5d28b44e50bf856a))
* **toolkit:** ErrorBoundary — ein kaputter Bereich reisst nicht die App ab ([#285](https://github.com/real-life-org/real-life-stack/issues/285)) ([e252911](https://github.com/real-life-org/real-life-stack/commit/e252911f0ec3a5f43a088d0e95e962b14fbf3643))


### Bug Fixes

* Feed zeigt alles Neue, nicht nur Posts, Events und Aussagen ([#278](https://github.com/real-life-org/real-life-stack/issues/278)) ([95b7397](https://github.com/real-life-org/real-life-stack/commit/95b73976c91d267112416cf4f4027fac5cb2f6cb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.3
    * @real-life-stack/local-connector bumped to 0.1.3
    * @real-life-stack/mock-connector bumped to 0.1.3
    * @real-life-stack/supabase-connector bumped to 0.1.3
    * @real-life-stack/toolkit bumped to 0.1.3
    * @real-life-stack/wot-connector bumped to 0.1.3

## [0.2.5](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.4...app-v0.2.5) (2026-08-17)


### Features

* **instanz:** Runtime-Konfiguration, Branding und Container-Paket ([#276](https://github.com/real-life-org/real-life-stack/issues/276)) ([717d451](https://github.com/real-life-org/real-life-stack/commit/717d451a19db5b1f6734f3b2edf4d9ca98876f5c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.2
    * @real-life-stack/local-connector bumped to 0.1.2
    * @real-life-stack/mock-connector bumped to 0.1.2
    * @real-life-stack/supabase-connector bumped to 0.1.2
    * @real-life-stack/toolkit bumped to 0.1.2
    * @real-life-stack/wot-connector bumped to 0.1.2

## [0.2.4](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.3...app-v0.2.4) (2026-08-06)


### Features

* Generischer AuthScreen — E-Mail-Login/-Registrierung + anonymer Schnellstart ([#240](https://github.com/real-life-org/real-life-stack/issues/240)) ([9181b38](https://github.com/real-life-org/real-life-stack/commit/9181b38c5310a3269b10b857c6933914f251dd48))
* Graph als Space-Modul + sortierbare Modul-Reihenfolge ([#229](https://github.com/real-life-org/real-life-stack/issues/229)) ([684e757](https://github.com/real-life-org/real-life-stack/commit/684e757889465dd9ea7ab76f481ff37068bf13e7))
* Markdown-Rendering und Kommentar-Hinweis in der ItemPreview ([#252](https://github.com/real-life-org/real-life-stack/issues/252)) ([a1f246c](https://github.com/real-life-org/real-life-stack/commit/a1f246c5113182ea16a5cf0d9b5995ce59c26125))
* Nativer Supabase-Connector (Weg B) — PostgREST + Realtime, authoritative Claims ([#238](https://github.com/real-life-org/real-life-stack/issues/238)) ([ebf6756](https://github.com/real-life-org/real-life-stack/commit/ebf675605a3d48701ab9f518e64319f84f3ee0eb))
* Resonanz-Modul — Aussagen mit Grün/Gelb/Rot-Stimmen ([#201](https://github.com/real-life-org/real-life-stack/issues/201)) ([5fcf62d](https://github.com/real-life-org/real-life-stack/commit/5fcf62da91988db1a32ef50e11f96d7cfca82bbe))
* SignedClaims-Connector-Wiring — signed WoT, authoritative Local/Mock, fail-closed Aggregation ([#209](https://github.com/real-life-org/real-life-stack/issues/209), PR 2/2) ([#235](https://github.com/real-life-org/real-life-stack/issues/235)) ([90a3545](https://github.com/real-life-org/real-life-stack/commit/90a3545b342410a883e4bd54c57fc338aba2640a))
* Supabase ProfileCapable — Profil befuellen + Avatar (WoT-Paritaet) ([#242](https://github.com/real-life-org/real-life-stack/issues/242)) ([a9d733c](https://github.com/real-life-org/real-life-stack/commit/a9d733c400774eeb0f333aaa97903f7fab1fb381))
* Supabase-Kontakte — Anfrage, Bestaetigung und Profil-Link ([#251](https://github.com/real-life-org/real-life-stack/issues/251)) ([b522781](https://github.com/real-life-org/real-life-stack/commit/b522781df46e36013895c70acf9b401a772aa68f))
* **toolkit:** Verify-Dialog — Restore nach Reload + Countdown mit Auto-Regenerate (1c/3, Teil B) ([#237](https://github.com/real-life-org/real-life-stack/issues/237)) ([cb70e9f](https://github.com/real-life-org/real-life-stack/commit/cb70e9f0d67f5af61c6f3b26e4bb1d2f59882ff4))
* Typ-Register — Implementierung der Spec aus [#210](https://github.com/real-life-org/real-life-stack/issues/210) ([#220](https://github.com/real-life-org/real-life-stack/issues/220)) ([a9af953](https://github.com/real-life-org/real-life-stack/commit/a9af953f575d821909e1bc9e0dcb3321b60768a4)), closes [#228](https://github.com/real-life-org/real-life-stack/issues/228)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.1
    * @real-life-stack/local-connector bumped to 0.1.1
    * @real-life-stack/mock-connector bumped to 0.1.1
    * @real-life-stack/supabase-connector bumped to 0.1.1
    * @real-life-stack/toolkit bumped to 0.1.1
    * @real-life-stack/wot-connector bumped to 0.1.1

## [0.2.3](https://github.com/real-life-org/real-life-stack/compare/app-v0.2.2...app-v0.2.3) (2026-08-03)


### Features

* App-Releases über release-please (neu aufgesetzt) + volle Doku ([#199](https://github.com/real-life-org/real-life-stack/issues/199)) ([6e6e611](https://github.com/real-life-org/real-life-stack/commit/6e6e6111cd51e395c4b98e37b7c32db270e6b42d))
