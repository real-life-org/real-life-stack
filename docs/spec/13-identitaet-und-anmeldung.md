# Identität und Anmeldung

**Status:** Entwurf zur Besprechung v0.1

Diese Spec legt fest, wem die Identität einer Person gehört, wie sie sich bei einer oder mehreren Datenquellen anmeldet und wo die Oberfläche dafür liegt. Sie löst den heutigen Zustand ab, in dem der WoT-Connector Identität, Anmeldebildschirme und Biometrie zugleich besitzt, und bereitet den DID-Login für Supabase und die gemischte Mitgliedschaft (rls#535, Etappen 4 und 5) vor.

Code-Referenzen:

- `packages/data-interface/src/index.ts` — `Authenticatable`, `AuthMethod`, `User`
- `packages/wot-connector/src/wot-connector.ts` — `WorkflowBackedIdentity`, `authenticate`
- `packages/wot-connector/src/biometric-service.ts` — Passphrase unter Gerätesperre
- `packages/wot-connector/src/components/` — Onboarding, Entsperren, Wiederherstellung (heute)
- `packages/toolkit/src/components/auth/` — `AuthScreen`, `MnemonicGrid`, `MnemonicVerify`, `PassphraseInput`, `StepProgress`
- `apps/reference/src/App.tsx` — `AuthGate`, Wahl des Bildschirms nach Connector-Id

## Begriffe

- **Identität**: das Schlüsselpaar einer Person, abgeleitet aus zwölf Wörtern (Seed), mit der DID als Namen. Sie ist unabhängig von jeder Datenquelle.
- **Konto**: der Eintrag einer Person bei einem Dienst, etwa die UUID bei Supabase. Ein Konto gehört zum Dienst, eine Identität zur Person.
- **Sitzung**: die entsperrte Identität im Speicher. Sie kann signieren und entschlüsseln. Der Seed verlässt den Identitätsdienst nie.
- **Identitätsdienst**: der Baustein, der eine Identität erstellt, wiederherstellt, entsperrt, sperrt und löscht und die Sitzung herausgibt.
- **Anmeldeart**: ein Weg, mit dem ein Connector eine Person annimmt: `email`, `email-signup`, `anonymous` oder `identity`.
- **Entsperrgeheimnis**: die Passphrase, unter einer Gerätesperre (Biometrie) abgelegt, damit das Entsperren ohne Tippen geht.

## Leitsätze

1. **Die Identität gehört der Person, nicht der Datenquelle.** Sie entsteht und lebt in der App. Ein Connector erhält eine Sitzung, nie den Seed und nie den Identitätsdienst.
2. **Connectoren haben keine Oberfläche.** Bildschirme für Erstellen, Entsperren, Wiederherstellen und Anmelden liegen im Toolkit. Ein Connector nennt seine Anmeldearten und nimmt Anmeldedaten an, mehr nicht.
3. **Eine Person meldet sich einmal an, nicht pro Quelle.** Hält eine App mehrere Connectoren, meldet sie dieselbe Sitzung bei jedem Connector an, der `identity` annimmt.
4. **Ein Konto ohne Identität bleibt möglich.** Wer nur öffentliche oder Mitglieder-Spaces nutzt, braucht keine zwölf Wörter. Verschlüsselte Spaces setzen eine Identität voraus.

## Der Vertrag

Alle Typen liegen in `data-interface`. Der Identitätsdienst ist kein Connector und erweitert `DataInterface` nicht.

```ts
interface Identity {
  did: string;                 // did:key
  kid: string;                 // `${did}#sig-0`
  publicKeyMultibase: string;
}

type IdentityState =
  | { status: "none" }         // kein Seed gespeichert
  | { status: "locked" }       // Seed gespeichert, keine Sitzung
  | { status: "unlocked"; identity: Identity };

interface IdentitySession extends Identity {
  sign(data: Uint8Array | string): Promise<string>;          // Ed25519, base64url
  signJws(payload: Record<string, unknown>): Promise<string>; // JCS, EdDSA, Header mit kid
  deriveFrameworkKey(info: string, length: number): Promise<Uint8Array>;
  encryptForRecipient(recipientX25519: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array>;
  decryptForMe(ciphertext: Uint8Array): Promise<Uint8Array>;
  x25519PublicKey: Uint8Array;
}

interface IdentityProvider {
  getState(): Observable<IdentityState>;
  create(opts: { passphrase: string }): Promise<{ session: IdentitySession; mnemonic: string[] }>;
  recover(opts: { mnemonic: string[]; passphrase: string }): Promise<IdentitySession>;
  unlock(opts: { passphrase: string } | { fromSession: true }): Promise<IdentitySession>;
  lock(): Promise<void>;
  destroy(): Promise<void>;    // löscht den Seed; unumkehrbar
}

interface UnlockSecretStore {   // optional, vom Host (Capacitor-Plugin) bereitgestellt
  isAvailable(): Promise<{ available: boolean; kind?: string }>;
  store(passphrase: string): Promise<void>;
  retrieve(): Promise<string>;  // verlangt die Gerätesperre
  clear(): Promise<void>;
  hasSecret(): Promise<boolean>;
}

interface AuthMethod {
  method: string;
  kind: "email" | "email-signup" | "anonymous" | "identity";
  label: string;
}

// Authenticatable, erweitert:
authenticate(method: "identity", credentials: { session: IdentitySession }): Promise<User>;
```

Die zwölf Wörter erscheinen genau einmal: als Rückgabe von `create`. Sie stehen in keinem `User`, keinem Zustand und keinem Speicher der App.

## Wo die Teile leben

| Teil | Paket | Heute |
|---|---|---|
| Typen des Vertrags | `data-interface` | fehlen |
| Identitätsdienst über wot-core (`IdentityWorkflow`, `IndexedDbIdentitySeedVault`) | `@real-life/identity` (neu) | `WorkflowBackedIdentity` im WoT-Connector |
| Entsperrgeheimnis (Capacitor-Vertrag `BiometricKeystore`) | `@real-life/identity` | `BiometricService` im WoT-Connector |
| Bildschirme Erstellen, Entsperren, Wiederherstellen | Toolkit `components/identity/` | `OnboardingFlow`, `UnlockFlow`, `RecoveryFlow` im WoT-Connector |
| Anmeldebildschirm über alle Anmeldearten | Toolkit `AuthScreen` | kennt nur `email`, `email-signup`, `anonymous` |
| Bereitstellung in React | Toolkit `IdentityProvider`-Context neben `ConnectorProvider` | fehlt |
| Native Umsetzung des Entsperrgeheimnisses | Host-App (`apps/reference/android/…/BiometricKeystorePlugin.java`) | unverändert |

Die Texte der Bildschirme ziehen mit den Bildschirmen um (`wot.*` wird zu Toolkit-Schlüsseln).

## Regeln

1. Ein Connector DARF KEINE Komponenten der Oberfläche exportieren.
2. Ein Connector DARF den Seed, die Wörter oder den Identitätsdienst NICHT entgegennehmen; er erhält eine `IdentitySession`.
3. `getAuthMethods()` MUSS für jede Anmeldeart ein `kind` nennen. Der Anmeldebildschirm MUSS jedes `kind` darstellen können und MUSS eine unbekannte Anmeldeart sichtbar als Fehler zeigen, statt die App ohne Anmeldung zu öffnen.
4. Die Wahl des Anmeldebildschirms MUSS aus den Anmeldearten folgen, nie aus der Connector-Id.
5. Der Identitätsdienst MUSS seinen Zustand selbst kennen (`none`, `locked`, `unlocked`). Eine App DARF den Zustand NICHT aus eigenen Markern (heute `rls-wot-active-did`) ableiten.
6. Ein Entsperrgeheimnis MUSS die Passphrase enthalten, nie den Seed, und DARF nur hinter einer Gerätesperre abgelegt werden. Ohne Host-Plugin ist die Funktion abwesend, nicht nachgebaut.
7. Hält eine App mehrere Connectoren, MUSS sie dieselbe Sitzung bei jedem anmelden, der `identity` anbietet. Ein zweiter Seed in derselben App ist nicht vorgesehen.
8. Anmeldung mit `identity` bei einem Dienst mit Konten (Supabase) läuft über eine Challenge: Der Dienst gibt eine Nonce, die Sitzung signiert `{ nonce, aud, iat }` als JWS mit `kid`, der Dienst prüft die Signatur gegen die `did:key`, verbraucht die Nonce einmalig innerhalb von zwei Minuten und stellt ein Token mit `sub = did` aus.
9. Ein Konto DARF nachträglich mit einer Identität verknüpft werden. Danach ist die DID der Schlüssel des Kontos; alle Einträge mit der alten Konto-Id MÜSSEN beim Verknüpfen auf die DID umgeschrieben werden. Die Verknüpfung DARF NICHT gelöst werden.
10. Eine anonyme Sitzung DARF KEINEN verschlüsselten Space betreten.

## Anmeldearten je Connector

| Connector | Anmeldearten | Schlüssel der Person |
|---|---|---|
| WoT | `identity` | DID |
| Supabase | `email`, `email-signup`, `anonymous`, `identity` | UUID; nach Verknüpfung oder Anmeldung mit `identity` die DID |
| lokal, Mock | `anonymous` | lokale Id |

Der Challenge-Dienst für Supabase ist ein eigener Dienst neben GoTrue, der das Token mit dem geteilten `JWT_SECRET` ausstellt. Ob er als Edge Function, als Container im `deploy/supabase`-Stapel oder als Teil des App-Containers läuft, entscheidet Etappe 4 von rls#535.

## Reihenfolge der Umstellung

1. Vertrag in `data-interface`; Paket `@real-life/identity` mit dem Code aus `WorkflowBackedIdentity` und `BiometricService`, Tests ziehen mit. Keine Verhaltensänderung.
2. Toolkit: Bildschirme aus dem WoT-Connector verschieben, auf `IdentityProvider` umstellen, `AuthScreen` nach `kind`; `AuthGate` der Referenz-App nach Anmeldearten. Schließt rls#596 und rls#597.
3. WoT-Connector ohne Oberfläche und ohne eigenen Identitätsdienst; `_mnemonic` und `rls-wot-active-did` entfallen.
4. Supabase: Anmeldeart `identity` mit Challenge-Dienst; Verknüpfung Konto mit Identität. Das ist Etappe 4 von rls#535.
5. Mehrere Connectoren mit einer Anmeldung. Das ist Etappe 5 von rls#535.

Schritte 1 bis 3 ändern nichts an Daten oder Protokoll und können vor der Leitentscheidung zu rls#535 laufen.

## Nicht-Ziele

- Schlüsselrotation, Nachfolge und Geräteschlüssel: das regelt das Trust Protocol.
- Verifiable Credentials und Vorzeigen der Identität gegenüber Dritten.
- Ein entfernter Tresor für den Seed (Vault-Server) und soziale Wiederherstellung.
- Mehrere Identitäten einer Person in einer App.

## Offene Entscheide

- Name und Zuschnitt des Pakets `@real-life/identity`, oder ob der Identitätsdienst in `data-interface` selbst liegt.
- Wo der Challenge-Dienst läuft (Regel 8).
- Ob ein E-Mail-Konto nach der Verknüpfung weiter per E-Mail anmelden darf, oder nur noch mit der Identität.
- Ob die Sitzung ohne Passphrase (`fromSession`) über den Neustart der App hinaus gilt, und wie lange.
