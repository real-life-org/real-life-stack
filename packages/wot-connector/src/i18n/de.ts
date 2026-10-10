/**
 * Deutsches Wörterbuch des WoT-Connectors — Referenz für die Schlüssel.
 *
 * Der Connector besitzt die Texte, die seine Bildschirme rendern (Onboarding,
 * Entsperren, Wiederherstellen, Biometrie-Angebot). Sie hängen sich über
 * `extendMessages` an die i18n-Laufzeit des Toolkits (`./index.ts`); was das
 * Toolkit schon hat (Zurück, Passwort, Mindestlänge, Passwortabgleich), kommt
 * von dort.
 *
 * Wortwahl: „Identität“, nicht „Identity“. „Seed“ bleibt das eingeführte Wort
 * für die 12 Wörter — das Onboarding erklärt es beim ersten Auftreten.
 */
export const de = {
  "wot.loading": "Laden…",

  // --- Onboarding: Schrittanzeige ---
  "wot.onboarding.step.start": "Start",
  "wot.onboarding.step.seed": "Seed",
  "wot.onboarding.step.verify": "Prüfen",
  "wot.onboarding.step.profile": "Profil",
  "wot.onboarding.step.password": "Passwort",

  // --- Onboarding: Willkommen ---
  "wot.onboarding.welcomeTitle": "Willkommen!",
  "wot.onboarding.welcomeDescription":
    "Erstelle deine dezentrale digitale Identität. Sie gehört nur dir — kein Server, kein Anbieter.",
  "wot.onboarding.whatHappens": "Was wird passieren:",
  "wot.onboarding.whatHappens.seed": "Du erhältst 12 geheime Wörter (deinen „Seed“)",
  "wot.onboarding.whatHappens.writeDown": "Du schreibst sie auf und bestätigst das",
  "wot.onboarding.whatHappens.profile": "Du füllst dein Profil aus",
  "wot.onboarding.whatHappens.password": "Du setzt ein Passwort zum Schutz",
  "wot.onboarding.importantLabel": "Wichtig:",
  "wot.onboarding.importantText":
    "Die 12 Wörter sind dein einziger Weg, die Identität wiederherzustellen. Halte Stift und Papier bereit.",
  "wot.onboarding.create": "Identität erstellen",
  "wot.onboarding.creating": "Erstelle Identität…",
  "wot.onboarding.createFailed": "Die Identität konnte nicht erstellt werden",
  "wot.onboarding.haveSeed": "Ich habe bereits einen Seed",

  // --- Onboarding: Seed zeigen ---
  "wot.onboarding.seedTitle": "Dein Seed zur Wiederherstellung",
  "wot.onboarding.seedDescription":
    "Schreibe diese 12 Wörter in der richtigen Reihenfolge auf und bewahre sie sicher auf.",
  "wot.onboarding.check.written": "Ich habe alle 12 Wörter aufgeschrieben",
  "wot.onboarding.check.safe": "Ich habe sie an einem sicheren Ort verwahrt",
  "wot.onboarding.check.understand": "Ich verstehe, dass sie nicht wiederhergestellt werden können",
  "wot.onboarding.lastWarningLabel": "Letzte Warnung:",
  "wot.onboarding.lastWarningText":
    "Wenn du die Wörter verlierst, gibt es keine Möglichkeit, deine Identität wiederherzustellen.",
  "wot.onboarding.toVerify": "Weiter zur Bestätigung",

  // --- Onboarding: Seed prüfen ---
  "wot.onboarding.verifyTitle": "Seed bestätigen",
  "wot.onboarding.verifyDescription":
    "Gib die folgenden Wörter ein, um sicherzustellen, dass du sie korrekt notiert hast.",
  "wot.onboarding.backToSeed": "← Zurück zum Seed",

  // --- Onboarding: Profil ---
  "wot.onboarding.profileTitle": "Dein Profil",
  "wot.onboarding.profileDescription": "Wie möchtest du dich anderen gegenüber zeigen?",
  "wot.onboarding.name": "Name",
  "wot.onboarding.namePlaceholder": "Dein Name",
  "wot.onboarding.bio": "Über mich",
  "wot.onboarding.bioPlaceholder": "Ein kurzer Satz über dich (optional)",
  "wot.onboarding.protectWithBiometrics": "Mit Biometrie schützen",
  "wot.onboarding.continue": "Weiter",
  "wot.onboarding.skip": "Überspringen",

  // --- Onboarding: Passwort ---
  "wot.onboarding.passwordTitle": "Schütze deine Identität",
  "wot.onboarding.passwordDescription":
    "Wähle ein starkes Passwort, um deine Identität auf diesem Gerät zu schützen.",
  "wot.onboarding.tipLabel": "Tipp:",
  "wot.onboarding.tipText":
    "Das Passwort ist nicht dein Seed. Es schützt deine Identität lokal auf diesem Gerät.",
  "wot.onboarding.setPassword": "Passwort setzen",
  "wot.onboarding.saving": "Wird gesichert…",
  "wot.onboarding.protectFailed": "Die Identität konnte nicht geschützt werden",

  // --- Onboarding: Fertig ---
  "wot.onboarding.doneTitle": "Geschafft!",
  "wot.onboarding.doneDescription": "Deine Identität wurde erfolgreich erstellt und geschützt.",
  "wot.onboarding.redirecting": "Du wirst zur App weitergeleitet…",

  // --- Gemeinsam: Biometrie und Passwort ---
  "wot.biometric.settingUp": "Richte ein…",
  "wot.biometric.setupFailed": "Biometrie-Einrichtung fehlgeschlagen. Bitte mit Passwort fortfahren.",
  "wot.usePasswordInstead": "Stattdessen Passwort verwenden",

  // --- Entsperren ---
  "wot.unlock.title": "Willkommen zurück",
  "wot.unlock.biometricDescription": "Entsperre deine Identität mit Fingerabdruck oder Gesicht.",
  "wot.unlock.passwordDescription": "Gib dein Passwort ein, um deine Identität zu entsperren.",
  "wot.unlock.passwordPlaceholder": "Passwort eingeben",
  "wot.unlock.unlock": "Entsperren",
  "wot.unlock.unlocking": "Entsperre…",
  "wot.unlock.biometric": "Biometrisch entsperren",
  "wot.unlock.backToBiometric": "Zurück zur biometrischen Entsperrung",
  "wot.unlock.wrongPassword": "Falsches Passwort",
  "wot.unlock.failed": "Entsperrung fehlgeschlagen",
  "wot.unlock.biometricReset": "Biometrie wurde zurückgesetzt. Bitte mit Passwort entsperren.",
  "wot.unlock.biometricFailed": "Biometrische Entsperrung fehlgeschlagen",

  // --- Wiederherstellen ---
  "wot.recovery.title": "Identität wiederherstellen",
  "wot.recovery.description": "Gib die 12 Wörter deines Seeds ein.",
  "wot.recovery.placeholder": "Wort 1  Wort 2  Wort 3 …",
  "wot.recovery.wordCount": "{count}/12 Wörter",
  "wot.recovery.withBiometrics": "Mit Biometrie wiederherstellen",
  "wot.recovery.restoring": "Stelle wieder her…",
  "wot.recovery.continue": "Weiter",
  "wot.recovery.passwordTitle": "Neues Passwort setzen",
  "wot.recovery.passwordDescription":
    "Wähle ein Passwort, um deine wiederhergestellte Identität zu schützen.",
  "wot.recovery.submit": "Identität wiederherstellen",
  "wot.recovery.failed": "Wiederherstellung fehlgeschlagen",
  "wot.recovery.backToSeed": "Zurück zum Seed",

  // --- Biometrie-Angebot nach dem Entsperren ---
  "wot.biometricOptIn.title": "Schneller entsperren",
  "wot.biometricOptIn.description":
    "Möchtest du deine Identität künftig mit Fingerabdruck oder Gesicht entsperren, statt jedes Mal das Passwort einzugeben?",
  "wot.biometricOptIn.notNow": "Nicht jetzt",
  "wot.biometricOptIn.enable": "Aktivieren",
} as const

/** Die Schlüssel, die der WoT-Connector mitbringt. */
export type WotMessageKey = keyof typeof de
