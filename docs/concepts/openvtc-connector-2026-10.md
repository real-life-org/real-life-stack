# OpenVTC-Connector (Oktober 2026)

**Status:** Vorschlag (2026-10-22), nichts gebaut.
**Scope:** Ein Storage-Connector für den RLS, der Items und Spaces in OpenVTC Data Rooms ablegt. Kein Identitäts-Connector: Begegnung, Verifikation und Profile bleiben beim [wot-connector](../../packages/wot-connector/).
**Bezug:** [../spec/04-items-relations-groups-spaces.md](../spec/04-items-relations-groups-spaces.md), [../spec/03-capabilities.md](../spec/03-capabilities.md), `packages/data-interface`, `packages/supabase-connector` als Vorbild für einen reinen Backend-Connector.

## 1. Was OpenVTC ist

OpenVTC ist die Referenzimplementierung der ToIP-Spezifikationen für Verifiable Trust Communities (Rust, Apache-2.0, LF Decentralized Trust Labs). Drei Dienste zählen hier:

| Dienst | Rolle |
|---|---|
| VTA (Verifiable Trust Agent) | Schlüsselverwahrung und Signierorakel für eine Identität. Läuft als Server. |
| VTC (Verifiable Trust Community) | Community-Dienst auf einem VTA: Mitglieder, Policies, Credentials, Website. |
| Data Room | Ein Satz verschlüsselter Records mit eigener `did:webvh`. Der Host speichert nur Ciphertext und führt keine Mitgliederliste. Gruppenschlüssel über MLS (RFC 9420). Jede Operation wird über Credentials autorisiert, die der Raum selbst ausgestellt hat. |

Räume haben drei Stufen: `open` (Klartext), `attributed` (verschlüsselt, Host sieht den Autor), `private` (Host sieht den Autor nicht, wartet auf das DTG-ZK-Profil). `open` und `attributed` sind gebaut.

Quellen: `docs/02-vta/data-rooms.md`, `docs/03-vtc/data-rooms-quickstart.md` und `docs/05-design-notes/data-rooms-demo-site.md` im Repo `OpenVTC/verifiable-trust-infrastructure`.

## 2. Was belegt ist

Geprüft am 2026-10-22 gegen VTI main `6c57452a`, alles auf einer Maschine über localhost, ohne Docker, Domain oder TLS:

- Drei VTAs, eine VTC und ein Raum laufen lokal. Records werden gesiegelt geschrieben, der VTC-Store enthält keinen Klartext. Beitritt, Dateien, Erneuerung und Entfernung verhalten sich wie dokumentiert. Ein entferntes Mitglied bekommt am Host sofort 403.
- **Ein Browser-Tab ist ohne eigenen VTA Raummitglied.** Das Paket `vti-rooms-wasm` prägt im Tab eine `did:key`, erzeugt das MLS-KeyPackage, verarbeitet das Welcome, holt die Epoch-Chain, öffnet Records aus allen Epochen und siegelt eigene. Der Raumbesitzer stellt der `did:key` Mitgliedschaft und Autorität aus wie an jede andere Persona. Ein aus dem Tab geschriebener Record wird vom Besitzer über seinen VTA gelesen.
- Was ein Agent bleibt: der Raumbesitzer. Er hält den Raumschlüssel, stellt Credentials aus und ist alleiniger MLS-Committer.

Nicht geprüft: Commit-Zustellung an einen Tab nach einem späteren Mitgliedswechsel, Dateien aus dem Tab, die Stufe `private`, Member Directory und Community Groups.

## 3. Abbildung

| RLS | OpenVTC | Anmerkung |
|---|---|---|
| Space | Data Room, Besitzer ist die VTC (`vtc/rooms/community/*`) | Die VTC hat einen eigenen VTA, der den Raumschlüssel hält. |
| Group / Mitgliedschaft | Raum-Mitgliedschaft: VMC + VAC vom Raum | Aufnahme, Entfernung und Erneuerung laufen über den Besitzer. |
| Item | Record. `key` = Item-ID, Body = das Item-JSON, signiert vom Autor | Relations, Tags und `@context` bleiben im Body. Der Host sieht nur `key`, `version`, `epoch`, Autor-DID. |
| User | `did:key` im Browser (`vti-rooms-wasm`), Snapshot in IndexedDB | Je Raum eine Identität, Schlüssel verlässt das WASM nicht. |
| Auth | Besitz von Identität und Credentials im Browser | Kein Login, kein Token. Jede Anfrage ist ein signiertes Trust-Task-Dokument. |
| Änderungen beobachten | `rooms/records/list` mit `sinceVersion`, Polling | Keine Push-Benachrichtigung an Tabs ohne Mediator-Sitzung. |
| Dateien | `rooms/blobs/*`, proxied oder direkt zu S3 | Nicht aus dem Tab geprüft. |

Capabilities aus `data-interface`, die der Connector tragen kann: `DataInterface`, `ItemWriter`, `Authenticatable`, `GroupManager` nur lesend. Nicht: `EncounterVerificationCapable`, `ConfirmationCapable`, `ProfileCapable`, `ContactManager`.

## 4. Eigenschaften, die man mit diesem Backend akzeptiert

- **Besitzer-Modell.** Ein Raum hat genau einen Besitzer, der alle Credentials ausstellt und allein committet. Für den RLS ist das die VTC. Mitglieder laden niemanden selbst ein.
- **Kein Merge.** Versionen sind raumweit. Der Host verlangt Epoche genau +1 und `expectedVersion`. Zwei gleichzeitige Schreibvorgänge enden mit einem Konflikt, nicht mit einer Zusammenführung. Records sind kein CRDT. Offline-Schreiben ist nur als Warteschlange mit Konfliktfall möglich.
- **Epochenzwang.** Nach jeder Mitgliedschaftsänderung muss jeder Client den Commit anwenden, bevor er wieder schreiben kann. Ein Client, der ihn verpasst, sieht „Record öffnet nicht“.
- **Der Host sieht den Autor.** In der Stufe `attributed`. Die Stufe `private` gibt es noch nicht.
- **Die Siegelversion ist Head + 1.** Ein Record, der bei einer anderen Version gesiegelt wurde als der, bei der ihn der Host ablegt, öffnet nicht mehr. Der Client muss vor jedem Schreiben den Head kennen.

## 5. Offene Fragen

Zu entscheiden, bevor gebaut wird:

1. **Beitritt.** Räume haben kein Beitrittsprotokoll; die Design-Note hält das für richtig, weil ein Beitritt eine Entscheidung des Besitzers ist und kein Trust Task. Für VTC-eigene Räume gibt es `vtc/rooms/offers/*`, mit denen ein Mitglied ein Angebot per KeyPackage annimmt. Ob ein Tab diese Aufgaben als `did:key` ausführen kann, ist ungeprüft.
2. **Commit-Zustellung.** Ein Tab ist zwischen Sitzungen nicht erreichbar. Der Host hält Commits bereit (`rooms/epoch/commits`), über die ein VTA nachzieht. Ob ein Tab denselben Weg gehen kann, ist ungeprüft.
3. **Identität.** Je Raum eine frische `did:key` im Tab, oder eine Identität je Nutzer und Gerät. Ob die RLS-Identität aus dem wot-connector (Ed25519 aus BIP39) im WASM importierbar ist, ist ungeprüft; das Paket prägt und stellt Snapshots wieder her, mehr nicht.
4. **Mehrgerät.** Der Snapshot im Browser ist Schlüsselmaterial. Ein zweites Gerät ist ein zweites Mitglied oder ein Export des Snapshots.
5. **Items ändern.** Jede Änderung ist eine neue Version am Host. Ob ein Item-Update als neuer Record oder als `curate` abgebildet wird, hängt davon ab, was Reader und Listing brauchen.
6. **Paketierung.** `@openvtc/vti-rooms-wasm` ist für Bundler gebaut (Vite mit `vite-plugin-wasm`), 2,6 MB WASM. Die Wire-Typen der `rooms/*`-Aufgaben müssten im Connector in TypeScript nachgebildet werden; ein TS-Client existiert im Browser-Plugin von OpenVTC, aber nicht als eigenes Paket.
7. **Ort des Besitzers.** Welche VTC besitzt die Räume einer RLS-Instanz, und wer betreibt sie.

## 6. Vorgeschlagene Schritte

1. Dieses Dokument und die offenen Fragen besprechen.
2. Prototyp `packages/openvtc-connector`, nur lesend, gegen eine laufende VTC: Identität im Tab, Chain, `list`, `get`.
3. Schreiben mit Head-Ermittlung und Konfliktfall in der UI.
4. Beitritt über VTC-Angebote und Commit-Nachzug aus dem Tab, beides zuerst als Probe gegen den Stack.

Zeitlich nach dem IIW im November 2026.
