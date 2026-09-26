# Changelog

## [0.4.0](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.3.1...data-interface-v0.4.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* aggregateVoteStats(records, contentHashes) verlangt die Inhalts-Hashes der zählenden Statements.

### Features

* **data-interface:** item-authorial – Katalog, Inhalts-Hash, Claims und Zählregel ([#494](https://github.com/real-life-org/real-life-stack/issues/494)) ([b2aee96](https://github.com/real-life-org/real-life-stack/commit/b2aee9660d49880fc72a20a75cd68db5f7113ce6))
* item-authorial im Schreibweg der Connectoren (WoT, Local, Mock) ([#496](https://github.com/real-life-org/real-life-stack/issues/496)) ([cb3a60b](https://github.com/real-life-org/real-life-stack/commit/cb3a60bbb65e79d2df53657503f36b393aacf37d))
* Stimmen an den Wortlaut binden, Beleg-Status aus dem Katalog ([#502](https://github.com/real-life-org/real-life-stack/issues/502)) ([16e6eb8](https://github.com/real-life-org/real-life-stack/commit/16e6eb8886467dd24d47b53c94ef9a884cdc78f2))
* **toolkit:** Varianten im Resonanzmodul, kein Bearbeiten bei eingefrorenem Wortlaut ([#505](https://github.com/real-life-org/real-life-stack/issues/505)) ([ffe4bde](https://github.com/real-life-org/real-life-stack/commit/ffe4bde2a54683c0c813310d20c9a7241540e7d5))

## [0.3.1](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.3.0...data-interface-v0.3.1) (2026-09-24)


### Features

* **examples:** erste App gegen npm (toolkit 0.2.0); Wächter: Pakete laden in Node-ESM ([#459](https://github.com/real-life-org/real-life-stack/issues/459)) ([144abe8](https://github.com/real-life-org/real-life-stack/commit/144abe8375a69869dfbe50dd3b9fb5f298c87c10))

## [0.3.0](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.2.1...data-interface-v0.3.0) (2026-09-23)


### ⚠ BREAKING CHANGES

* **toolkit:** Der Modul-Host — B0 komplett (Schritte 1–5b + Codex-Fixes #415–#417) ([#414](https://github.com/real-life-org/real-life-stack/issues/414))

### Features

* **network:** die Netzwerk-App läuft auf dem Modul-Host (Spec 01, Regel 5) ([#429](https://github.com/real-life-org/real-life-stack/issues/429)) ([55f571c](https://github.com/real-life-org/real-life-stack/commit/55f571c41cbb854493f8b4dd6de23166b8a26a45))
* **toolkit:** Der Modul-Host — B0 komplett (Schritte 1–5b + Codex-Fixes [#415](https://github.com/real-life-org/real-life-stack/issues/415)–[#417](https://github.com/real-life-org/real-life-stack/issues/417)) ([#414](https://github.com/real-life-org/real-life-stack/issues/414)) ([97baf68](https://github.com/real-life-org/real-life-stack/commit/97baf683b212a784246711022b393d9002234be6))

## [0.2.1](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.2.0...data-interface-v0.2.1) (2026-09-16)


### Bug Fixes

* ein Feld für das Space-Bild — data.image ([#382](https://github.com/real-life-org/real-life-stack/issues/382)) ([750397a](https://github.com/real-life-org/real-life-stack/commit/750397ae8be2a6d8c59741b3e57dd0566ca7f17e))
* **toolkit:** Space-Bild — Regel in Spec 04 und ihre Einlösung im Dialog ([#385](https://github.com/real-life-org/real-life-stack/issues/385)) ([50005cb](https://github.com/real-life-org/real-life-stack/commit/50005cbd88d804c165f9ff0e6af58f5b9d418b00))

## [0.2.0](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.1.4...data-interface-v0.2.0) (2026-09-13)


### ⚠ BREAKING CHANGES

* **data-interface:** MirrorCapable, Profil-Freigaben, mirrorOf-Helfer (S1) ([#344](https://github.com/real-life-org/real-life-stack/issues/344))

### Features

* **data-interface:** MirrorCapable, Profil-Freigaben, mirrorOf-Helfer (S1) ([#344](https://github.com/real-life-org/real-life-stack/issues/344)) ([cd1392c](https://github.com/real-life-org/real-life-stack/commit/cd1392c43db7a6d08da32c93f585a29949c969ef))


### Bug Fixes

* **packages:** veröffentlichte exports ohne die development-Bedingung ([#358](https://github.com/real-life-org/real-life-stack/issues/358)) ([dc0e062](https://github.com/real-life-org/real-life-stack/commit/dc0e06210842c5f87c267036745cb5373f290912))

## [0.1.4](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.1.3...data-interface-v0.1.4) (2026-09-08)


### Bug Fixes

* **release:** npm-Publish und Android-Build reparieren ([#299](https://github.com/real-life-org/real-life-stack/issues/299)) ([84eda7f](https://github.com/real-life-org/real-life-stack/commit/84eda7fce41f27f9cf36365955876ca9ee3bd5c9))

## [0.1.3](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.1.2...data-interface-v0.1.3) (2026-09-08)


### Features

* Erstsync auf neuen Geräten sichtbar machen ([#274](https://github.com/real-life-org/real-life-stack/issues/274)) ([dc02cf6](https://github.com/real-life-org/real-life-stack/commit/dc02cf6ffb255ae8aa90fba50f8209817c4d4641))


### Bug Fixes

* Feed zeigt alles Neue, nicht nur Posts, Events und Aussagen ([#278](https://github.com/real-life-org/real-life-stack/issues/278)) ([95b7397](https://github.com/real-life-org/real-life-stack/commit/95b73976c91d267112416cf4f4027fac5cb2f6cb))

## [0.1.2](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.1.1...data-interface-v0.1.2) (2026-08-17)


### Features

* Space-Mitglieder dürfen Inhalte bearbeiten, Bearbeitung wird sichtbar ([#263](https://github.com/real-life-org/real-life-stack/issues/263)) ([bdd7ac9](https://github.com/real-life-org/real-life-stack/commit/bdd7ac987dbdcec0d6fff7794bea681e9593b92d))

## [0.1.1](https://github.com/real-life-org/real-life-stack/compare/data-interface-v0.1.0...data-interface-v0.1.1) (2026-08-06)


### Features

* Generischer AuthScreen — E-Mail-Login/-Registrierung + anonymer Schnellstart ([#240](https://github.com/real-life-org/real-life-stack/issues/240)) ([9181b38](https://github.com/real-life-org/real-life-stack/commit/9181b38c5310a3269b10b857c6933914f251dd48))
* Graph als Space-Modul + sortierbare Modul-Reihenfolge ([#229](https://github.com/real-life-org/real-life-stack/issues/229)) ([684e757](https://github.com/real-life-org/real-life-stack/commit/684e757889465dd9ea7ab76f481ff37068bf13e7))
* Markdown-Rendering und Kommentar-Hinweis in der ItemPreview ([#252](https://github.com/real-life-org/real-life-stack/issues/252)) ([a1f246c](https://github.com/real-life-org/real-life-stack/commit/a1f246c5113182ea16a5cf0d9b5995ce59c26125))
* Nativer Supabase-Connector (Weg B) — PostgREST + Realtime, authoritative Claims ([#238](https://github.com/real-life-org/real-life-stack/issues/238)) ([ebf6756](https://github.com/real-life-org/real-life-stack/commit/ebf675605a3d48701ab9f518e64319f84f3ee0eb))
* Parametrisierte DataInterface-Contract-Suite über alle Connectoren ([#214](https://github.com/real-life-org/real-life-stack/issues/214)) ([#221](https://github.com/real-life-org/real-life-stack/issues/221)) ([82b0de4](https://github.com/real-life-org/real-life-stack/commit/82b0de40cc4e019b2ac618bb839cfcc4caf176ca))
* Resonanz-Modul — Aussagen mit Grün/Gelb/Rot-Stimmen ([#201](https://github.com/real-life-org/real-life-stack/issues/201)) ([5fcf62d](https://github.com/real-life-org/real-life-stack/commit/5fcf62da91988db1a32ef50e11f96d7cfca82bbe))
* SignedClaims-Connector-Wiring — signed WoT, authoritative Local/Mock, fail-closed Aggregation ([#209](https://github.com/real-life-org/real-life-stack/issues/209), PR 2/2) ([#235](https://github.com/real-life-org/real-life-stack/issues/235)) ([90a3545](https://github.com/real-life-org/real-life-stack/commit/90a3545b342410a883e4bd54c57fc338aba2640a))
* SignedClaims-Kern — Primitive, Katalog, signierende Fassade ([#209](https://github.com/real-life-org/real-life-stack/issues/209), PR 1/2) ([#230](https://github.com/real-life-org/real-life-stack/issues/230)) ([dc01638](https://github.com/real-life-org/real-life-stack/commit/dc016383abbae670fbd11dc823ece102a8404847))
* Supabase ProfileCapable — Profil befuellen + Avatar (WoT-Paritaet) ([#242](https://github.com/real-life-org/real-life-stack/issues/242)) ([a9d733c](https://github.com/real-life-org/real-life-stack/commit/a9d733c400774eeb0f333aaa97903f7fab1fb381))
* Supabase-Kontakte — Anfrage, Bestaetigung und Profil-Link ([#251](https://github.com/real-life-org/real-life-stack/issues/251)) ([b522781](https://github.com/real-life-org/real-life-stack/commit/b522781df46e36013895c70acf9b401a772aa68f))
* Typ-Register — Implementierung der Spec aus [#210](https://github.com/real-life-org/real-life-stack/issues/210) ([#220](https://github.com/real-life-org/real-life-stack/issues/220)) ([a9af953](https://github.com/real-life-org/real-life-stack/commit/a9af953f575d821909e1bc9e0dcb3321b60768a4)), closes [#228](https://github.com/real-life-org/real-life-stack/issues/228)
