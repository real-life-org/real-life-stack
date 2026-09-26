# Changelog

## [0.3.0](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.2.1...toolkit-v0.3.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* aggregateVoteStats(records, contentHashes) verlangt die Inhalts-Hashes der zählenden Statements.

### Features

* Stimmen an den Wortlaut binden, Beleg-Status aus dem Katalog ([#502](https://github.com/real-life-org/real-life-stack/issues/502)) ([16e6eb8](https://github.com/real-life-org/real-life-stack/commit/16e6eb8886467dd24d47b53c94ef9a884cdc78f2))
* **toolkit:** Kommentare und Reaktionen nach Beleg-Status zählen und markieren ([#503](https://github.com/real-life-org/real-life-stack/issues/503)) ([997b1a6](https://github.com/real-life-org/real-life-stack/commit/997b1a61b6fe9d7c47f73adb41b13f43ea72e130))
* **toolkit:** Varianten im Resonanzmodul, kein Bearbeiten bei eingefrorenem Wortlaut ([#505](https://github.com/real-life-org/real-life-stack/issues/505)) ([ffe4bde](https://github.com/real-life-org/real-life-stack/commit/ffe4bde2a54683c0c813310d20c9a7241540e7d5))


### Bug Fixes

* **site:** Proportionen der Landing auf dem Telefon ([#483](https://github.com/real-life-org/real-life-stack/issues/483)) ([653310a](https://github.com/real-life-org/real-life-stack/commit/653310a8ef39f017e7efc0dea6e3f5da060c38e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.4.0
  * devDependencies
    * @real-life-stack/mock-connector bumped to 0.2.2

## [0.2.1](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.2.0...toolkit-v0.2.1) (2026-09-24)


### Features

* **site:** Referenz „Module" aus dem Register; Dunkelmodus mit echtem Orange ([#467](https://github.com/real-life-org/real-life-stack/issues/467)) ([cec044b](https://github.com/real-life-org/real-life-stack/commit/cec044b8e8109d61a60f211b9b6aae86a7222246))
* **toolkit:** Build-Zeile im Nutzer-Menü — welcher Stand läuft, so dezent wie möglich ([#461](https://github.com/real-life-org/real-life-stack/issues/461)) ([b68c3ad](https://github.com/real-life-org/real-life-stack/commit/b68c3ad96af68d95011f2f37c45d60362209afd0))
* **toolkit:** Gemeinschaftsgarten auf dem echten Rahmen ([#477](https://github.com/real-life-org/real-life-stack/issues/477)) ([2c9902f](https://github.com/real-life-org/real-life-stack/commit/2c9902f7a0aa8892a8c15b74e311ad68ee8f6e1c))


### Bug Fixes

* **toolkit:** Drawer deckend, Space-Name kürzt nur bei Platzmangel ([#475](https://github.com/real-life-org/real-life-stack/issues/475)) ([f21583c](https://github.com/real-life-org/real-life-stack/commit/f21583ca5a99d6718b1617c2c98bf7356beae19a))
* **toolkit:** Filter und Plusknopf auf einer Grundlinie über der Bottom-Nav ([#480](https://github.com/real-life-org/real-life-stack/issues/480)) ([84b6f3f](https://github.com/real-life-org/real-life-stack/commit/84b6f3faf9f47d6025c6b3c8a3a7e29ec20ee4da))
* **toolkit:** Kartensteuerung aus den Tokens für alle Apps und Stories ([#476](https://github.com/real-life-org/real-life-stack/issues/476)) ([895f810](https://github.com/real-life-org/real-life-stack/commit/895f8103e53e907b8d899b0d549bb76136b5a82b))
* **toolkit:** Schreib-Einstiege nach Fähigkeit, Tabs und Kopfzeile auf dem Telefon ([#481](https://github.com/real-life-org/real-life-stack/issues/481)) ([4a819c6](https://github.com/real-life-org/real-life-stack/commit/4a819c6b3dfb1803ed31232ce326bf11958347d5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.3.1
  * devDependencies
    * @real-life-stack/mock-connector bumped to 0.2.1

## [0.2.0](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.10...toolkit-v0.2.0) (2026-09-23)


### ⚠ BREAKING CHANGES

* **toolkit:** useCreateItem/useUpdateItem/useDeleteItem geben die Funktion zurück statt `{mutate}`. useComments: `comments` → `data`; useReplies: `replies` → `data`; useReactions: `reactions` → `data`; useReactionUsers und useVoteUsers: `users` → `data`; useVotes: `summary` → `data`. Aufrufer im Toolkit (Kanban, Item-Editor, Kommentar-Sektion, Reaktionen, Vote-Bar, Stories, Tests) angepasst.
* **toolkit:** Nicht mehr aus @real-life-stack/toolkit exportiert: useRegisterDetail, useRegisterCreate, useOptionalModuleHost, useModuleLayout, useModuleContentClass, useOptionalModuleHead, usePanelEdges, useLocationPick, useFieldLink, useCommentLink, useTagLink, useFilterableItems, useModuleFilteredItems, useBeforeUnloadWarning, useItemComposerProps, useItemDetailEdit; aus /router: useWorkspaceRouting. Umbenannt: useSpaceVocabulary/spaceVocabulary/SpaceVocabulary → useGroupVocabulary/groupVocabulary/GroupVocabulary. Der Rahmen (RoutedAppFrame) stellt alles davon; die veröffentlichte 0.1.10 enthielt den Rahmen noch nicht.
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
* **toolkit:** öffentliche Hook-API — Verdrahtung von Host, Rahmen und Panel ist intern (Inventur, Schritt 1) ([#454](https://github.com/real-life-org/real-life-stack/issues/454)) ([1cb3ecf](https://github.com/real-life-org/real-life-stack/commit/1cb3ecf4849d0f5ae7a263bb085e03dff7cec122))
* **toolkit:** Rückgabeformen, useItemPresentation, neun Gruppen, Story je Hook (Inventur 2–4) ([#455](https://github.com/real-life-org/real-life-stack/issues/455)) ([aa9206d](https://github.com/real-life-org/real-life-stack/commit/aa9206d4f07d9cf95df9e07654fcc12398aa4966))
* **toolkit:** Vokabular, Filterkarte und Chips gehören der Fläche ([#407](https://github.com/real-life-org/real-life-stack/issues/407)) ([a0a7779](https://github.com/real-life-org/real-life-stack/commit/a0a7779f0c084460071f593ce56a2eda7691c9c6))


### Bug Fixes

* **graph:** die Kamera folgt dem Netz, statt zu springen ([#420](https://github.com/real-life-org/real-life-stack/issues/420)) ([7c3a3c8](https://github.com/real-life-org/real-life-stack/commit/7c3a3c835f611ff3f942cc603b4555919ce7b442))
* **toolkit:** Sammlung und Graph bringen ihre Fläche vollständig mit ([#419](https://github.com/real-life-org/real-life-stack/issues/419)) ([6ff4aa5](https://github.com/real-life-org/real-life-stack/commit/6ff4aa557b1f290053727d343b9072ff719c7b02))


### Code Refactoring

* **toolkit:** Nachzug von [#400](https://github.com/real-life-org/real-life-stack/issues/400) und [#401](https://github.com/real-life-org/real-life-stack/issues/401) auf master ([#403](https://github.com/real-life-org/real-life-stack/issues/403)) ([fa2630f](https://github.com/real-life-org/real-life-stack/commit/fa2630f4ccc045af76d9d7986b4db98ed8806b25))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.3.0
  * devDependencies
    * @real-life-stack/mock-connector bumped to 0.2.0

## [0.1.10](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.9...toolkit-v0.1.10) (2026-09-16)


### Bug Fixes

* **toolkit:** Blur der Glasflaechen im Produktionsbuild ([#392](https://github.com/real-life-org/real-life-stack/issues/392)) ([8f9188d](https://github.com/real-life-org/real-life-stack/commit/8f9188d2c59c1a55c84d7d93af7327d60c35d65b))

## [0.1.9](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.8...toolkit-v0.1.9) (2026-09-16)


### Features

* **toolkit:** Aussehen als Achsen — Farbe mit drei Reglern, Tönung, ein Reset ([#389](https://github.com/real-life-org/real-life-stack/issues/389)) ([f3a5722](https://github.com/real-life-org/real-life-stack/commit/f3a572283b19e817fb9f330b6972438d022b8e66))
* **toolkit:** Bereich Aussehen — Space-Primärfarbe wählen ([#381](https://github.com/real-life-org/real-life-stack/issues/381)) ([84461f0](https://github.com/real-life-org/real-life-stack/commit/84461f0e9e92d88ebe903a5bc258d7e099afee4c))
* **toolkit:** Farbmathematik in OKLCH — aus [#361](https://github.com/real-life-org/real-life-stack/issues/361) herausgelöst ([#386](https://github.com/real-life-org/real-life-stack/issues/386)) ([6507fcb](https://github.com/real-life-org/real-life-stack/commit/6507fcbd18f7490d2e0defee4ceada5bd8f8a336))
* **toolkit:** Rundung und Flächen als Achsen des Aussehens ([#391](https://github.com/real-life-org/real-life-stack/issues/391)) ([66f2e07](https://github.com/real-life-org/real-life-stack/commit/66f2e07f4656ebc59cbc04a274e77ae3797c0a55))
* **toolkit:** zwölfstufige Farbskalen aus einer frei gewählten Farbe ([#387](https://github.com/real-life-org/real-life-stack/issues/387)) ([9b6e298](https://github.com/real-life-org/real-life-stack/commit/9b6e298f51339471cd71df70c80e1bdabd738561))


### Bug Fixes

* **toolkit:** Space-Bild — Regel in Spec 04 und ihre Einlösung im Dialog ([#385](https://github.com/real-life-org/real-life-stack/issues/385)) ([50005cb](https://github.com/real-life-org/real-life-stack/commit/50005cbd88d804c165f9ff0e6af58f5b9d418b00))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.2.1

## [0.1.8](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.7...toolkit-v0.1.8) (2026-09-15)


### Features

* Markdown über die nativen tiptap-Extensions ([#367](https://github.com/real-life-org/real-life-stack/issues/367)) ([6d8f849](https://github.com/real-life-org/real-life-stack/commit/6d8f849add1629567bbd36c894b94479615d754b))
* **toolkit:** Space-Konfiguration als Seitenmenü — Mitglieder und Module ([#369](https://github.com/real-life-org/real-life-stack/issues/369)) ([134fe48](https://github.com/real-life-org/real-life-stack/commit/134fe4828707394ff822f322609fa4ca52cc9063))


### Bug Fixes

* Markdown-Editor speichert kein HTML mehr ([#363](https://github.com/real-life-org/real-life-stack/issues/363)) ([3e77f92](https://github.com/real-life-org/real-life-stack/commit/3e77f923a3c986d71228df9e6d91e9fc486cd3b0))


### Performance Improvements

* eine Karte parst ihren Text nur, wenn er sich geändert hat ([#372](https://github.com/real-life-org/real-life-stack/issues/372)) ([879f8d5](https://github.com/real-life-org/real-life-stack/commit/879f8d5e2b4a6de319c7f5a876174a8c07781d20))
* eine Karte rendert nur noch, wenn sie sich geaendert hat ([#376](https://github.com/real-life-org/real-life-stack/issues/376)) ([ba88ef1](https://github.com/real-life-org/real-life-stack/commit/ba88ef180de144b2b45fd44bc89541119acd2872))

## [0.1.7](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.6...toolkit-v0.1.7) (2026-09-13)


### Features

* **toolkit:** Kamera des Graphen exportieren ([#357](https://github.com/real-life-org/real-life-stack/issues/357)) ([2689ee1](https://github.com/real-life-org/real-life-stack/commit/2689ee1b8f9edd310d5095d8b4a6bdfe512bd4f9))
* **toolkit:** mehrere Personen-Zuweisungen je Typ im Composer ([#359](https://github.com/real-life-org/real-life-stack/issues/359)) ([abedfe6](https://github.com/real-life-org/real-life-stack/commit/abedfe69ad5adedc4a72f2b19dd33566a665f230))


### Bug Fixes

* **packages:** veröffentlichte exports ohne die development-Bedingung ([#358](https://github.com/real-life-org/real-life-stack/issues/358)) ([dc0e062](https://github.com/real-life-org/real-life-stack/commit/dc0e06210842c5f87c267036745cb5373f290912))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.2.0

## [0.1.6](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.5...toolkit-v0.1.6) (2026-09-09)


### Features

* **toolkit:** der Globus ist der Standard, dafür kommt der Standort-Knopf ([#324](https://github.com/real-life-org/real-life-stack/issues/324)) ([e0941f7](https://github.com/real-life-org/real-life-stack/commit/e0941f736cd65902ee72bf30690527e3fa13541b))
* **toolkit:** die Adress-Suche speichert die kurze Form ([#330](https://github.com/real-life-org/real-life-stack/issues/330)) ([415f428](https://github.com/real-life-org/real-life-stack/commit/415f428c875ccc9e51bcd7c8e16156cdca4f140f))
* **toolkit:** die Modulfläche besitzt den Kopf, der Filter gehört der App ([#318](https://github.com/real-life-org/real-life-stack/issues/318)) ([305451d](https://github.com/real-life-org/real-life-stack/commit/305451d3d54c00e9754e6a86ac114e2ec111412c))
* **toolkit:** die Modulfläche wird eine Spalte ([#315](https://github.com/real-life-org/real-life-stack/issues/315)) ([41f2456](https://github.com/real-life-org/real-life-stack/commit/41f2456f0508d8806942cc7cbb74a8d21e6436ec))
* **toolkit:** Filter-Pille und weißer Erstellen-Knopf wie im Design-Board ([#321](https://github.com/real-life-org/real-life-stack/issues/321)) ([5e26dc2](https://github.com/real-life-org/real-life-stack/commit/5e26dc2e57776624d88abb02416e50cfc43f9b0d))
* **toolkit:** Kanban-Spalte ist ein Ort, keine Karte ([#314](https://github.com/real-life-org/real-life-stack/issues/314)) ([058ad99](https://github.com/real-life-org/real-life-stack/commit/058ad996c9b8fa940615fa63eef26cb6140ffae2))
* **toolkit:** Tag-Klick filtert, der Feed-Kopf bekommt einen Erstellen-Knopf ([#319](https://github.com/real-life-org/real-life-stack/issues/319)) ([8d0f8ec](https://github.com/real-life-org/real-life-stack/commit/8d0f8ec7443dc10a0eb4c7e7080fac8a30c121e1))


### Bug Fixes

* **toolkit:** der Drawer endet oben an der Schutzzone des Geräts ([#332](https://github.com/real-life-org/real-life-stack/issues/332)) ([fc96f76](https://github.com/real-life-org/real-life-stack/commit/fc96f768e4c1a41d3a033e6e64e27f9173a6ed5b))
* **toolkit:** die Breite der Liste gehört der Fläche ([#336](https://github.com/real-life-org/real-life-stack/issues/336)) ([8d96eb8](https://github.com/real-life-org/real-life-stack/commit/8d96eb8d20cd7bb205a60c3105b761c3eff0b9ae))
* **toolkit:** die Tag-Palette meldet ihre Klassen selbst an ([#334](https://github.com/real-life-org/real-life-stack/issues/334)) ([e43919d](https://github.com/real-life-org/real-life-stack/commit/e43919dc201af72a6016476109c4d52657f2471c))

## [0.1.5](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.4...toolkit-v0.1.5) (2026-09-09)


### Features

* **toolkit:** AdaptivePanel-Variante "floating" ([#304](https://github.com/real-life-org/real-life-stack/issues/304)) ([d49c5b1](https://github.com/real-life-org/real-life-stack/commit/d49c5b1890e05fa7d3307d23d761924910720d6b))
* **toolkit:** der Kamera einmal sagen, wo ihre Mitte liegt ([#312](https://github.com/real-life-org/real-life-stack/issues/312)) ([33543a6](https://github.com/real-life-org/real-life-stack/commit/33543a61df37c8f9c164c7a2c4c97cafc8535b56))
* **toolkit:** eigene Anatomie für die Detailansicht (PR 4) ([#307](https://github.com/real-life-org/real-life-stack/issues/307)) ([6d6976d](https://github.com/real-life-org/real-life-stack/commit/6d6976d7ee0cd600bf1a0884be439d0c1e65d507))
* **toolkit:** ein Feld führt zu der Sicht, die es darstellt ([#309](https://github.com/real-life-org/real-life-stack/issues/309)) ([6088c52](https://github.com/real-life-org/real-life-stack/commit/6088c5247e1090ac0bbb359f5d3f3cf0e6021cc5))
* **toolkit:** ItemPreview führt mit dem Titel (PR 1) ([#311](https://github.com/real-life-org/real-life-stack/issues/311)) ([82f8de9](https://github.com/real-life-org/real-life-stack/commit/82f8de92718aed4c7e57705907efc10cc8ec4bb6))


### Bug Fixes

* **toolkit:** dem Browser das Farbschema nennen ([#310](https://github.com/real-life-org/real-life-stack/issues/310)) ([d189e97](https://github.com/real-life-org/real-life-stack/commit/d189e970791a82b3bc3180bafe1c936d3fca06b5))
* **toolkit:** schwebende Bedienelemente an der Panelkante ausrichten ([#306](https://github.com/real-life-org/real-life-stack/issues/306)) ([c7ed92d](https://github.com/real-life-org/real-life-stack/commit/c7ed92d4c3f7e713996736a85a3d44a08122b694))

## [0.1.4](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.3...toolkit-v0.1.4) (2026-09-08)


### Bug Fixes

* **release:** npm-Publish und Android-Build reparieren ([#299](https://github.com/real-life-org/real-life-stack/issues/299)) ([84eda7f](https://github.com/real-life-org/real-life-stack/commit/84eda7fce41f27f9cf36365955876ca9ee3bd5c9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.4

## [0.1.3](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.2...toolkit-v0.1.3) (2026-09-08)


### Features

* Erstsync auf neuen Geräten sichtbar machen ([#274](https://github.com/real-life-org/real-life-stack/issues/274)) ([dc02cf6](https://github.com/real-life-org/real-life-stack/commit/dc02cf6ffb255ae8aa90fba50f8209817c4d4641))
* **module:** Modul-Register als einzige Quelle ([#277](https://github.com/real-life-org/real-life-stack/issues/277)) ([1d3ee58](https://github.com/real-life-org/real-life-stack/commit/1d3ee5837270ada76f1ffbac5d28b44e50bf856a))
* **toolkit:** ErrorBoundary — ein kaputter Bereich reisst nicht die App ab ([#285](https://github.com/real-life-org/real-life-stack/issues/285)) ([e252911](https://github.com/real-life-org/real-life-stack/commit/e252911f0ec3a5f43a088d0e95e962b14fbf3643))


### Bug Fixes

* Instanz-Image — Weg in die App hinter dem Proxy und Dunkelmodus bei Branding ([#296](https://github.com/real-life-org/real-life-stack/issues/296)) ([27d61cd](https://github.com/real-life-org/real-life-stack/commit/27d61cd2c13b7092fc4c7a951c0ec30016da8d5a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.3

## [0.1.2](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.1...toolkit-v0.1.2) (2026-08-17)


### Features

* **instanz:** Runtime-Konfiguration, Branding und Container-Paket ([#276](https://github.com/real-life-org/real-life-stack/issues/276)) ([717d451](https://github.com/real-life-org/real-life-stack/commit/717d451a19db5b1f6734f3b2edf4d9ca98876f5c))
* Space-Mitglieder dürfen Inhalte bearbeiten, Bearbeitung wird sichtbar ([#263](https://github.com/real-life-org/real-life-stack/issues/263)) ([bdd7ac9](https://github.com/real-life-org/real-life-stack/commit/bdd7ac987dbdcec0d6fff7794bea681e9593b92d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @real-life-stack/data-interface bumped to 0.1.2

## [0.1.1](https://github.com/real-life-org/real-life-stack/compare/toolkit-v0.1.0...toolkit-v0.1.1) (2026-08-06)


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
