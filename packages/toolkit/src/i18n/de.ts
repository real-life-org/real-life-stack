/**
 * Deutsches Wörterbuch — die REFERENZ für alle Schlüssel.
 *
 * `ToolkitMessageKey` wird aus dieser Datei abgeleitet; `en.ts` ist dagegen
 * getypt. Ein Schlüssel, der hier fehlt, ist ein Compilerfehler beim Aufrufer
 * von `t` (rls#614 — `t` nimmt keinen freien String an); einer, der in `en.ts`
 * fehlt, ein Compilerfehler dort. Es gibt keinen Zustand, in dem eine Sprache
 * still hinterherhinkt.
 *
 * Flache Schlüssel (`bereich.name`), Werte sind Strings oder Plural-Objekte
 * nach den Kategorien von `Intl.PluralRules` (`one`/`other` reicht für DE/EN;
 * weitere Sprachen bringen ihre Kategorien mit, ohne dass sich das Format
 * ändert). Platzhalter in geschweiften Klammern: `{name}`, `{count}`.
 *
 * Bewusst 1:1 nach JSON übersetzbar: sollte später ein Übersetzungswerkzeug
 * oder i18next andocken, sind diese Dateien der Bestand — nur die Laufzeit
 * würde getauscht.
 */
export const de = {
  // --- Nutzermenü ---
  "userMenu.profile": "Profil",
  "userMenu.contacts": "Kontakte",
  "userMenu.verify": "Verifizieren",
  "userMenu.settings": "Einstellungen",
  "userMenu.logout": "Abmelden",

  // --- Build-Zeile im Nutzermenü ---
  "build.title": "Version · Commit · Kanal — antippen kopiert",
  "build.ariaLabel": "Build {build}, antippen kopiert",
  "build.copied": "kopiert",

  // --- Zeit ---
  "time.justNow": "gerade eben",
  "time.until": "bis",
  "time.allDay": "Ganztägig",

  // --- Item-Karte ---
  "item.editedBy": "Bearbeitet von {name} am {date}",
  "item.edited": "bearbeitet",

  // --- Allgemein ---
  "common.cancel": "Abbrechen",
  "common.close": "Schließen",
  "common.search": "Suchen…",
  "common.reset": "Zurücksetzen",
  "common.confirm": "Bestätigen",
  "common.back": "Zurück",
  "common.done": "Fertig",
  "common.later": "Später",
  "common.open": "Öffnen",
  "common.retry": "Erneut versuchen",

  // --- Space-Dialog (GroupDialog) ---
  "groupDialog.members": "Mitglieder",
  "groupDialog.invite": "Einladen",
  "groupDialog.appearance": "Aussehen",
  "groupDialog.modules": "Module",
  "groupDialog.modulesSaveFailed": "Module konnten nicht gespeichert werden",
  "groupDialog.colorSaveFailed": "Farbe konnte nicht gespeichert werden",
  "groupDialog.saveFailed": "Konnte nicht gespeichert werden",
  "groupDialog.createFailed": "Fehler beim Erstellen",
  "groupDialog.renameFailed": "Fehler beim Umbenennen",
  "groupDialog.imageFailed": "Bild konnte nicht verarbeitet werden",
  "groupDialog.leaveFailed": "Fehler beim Verlassen",
  "groupDialog.inviteFailed": "Einladung fehlgeschlagen",
  "groupDialog.removeMemberFailed": "Fehler beim Entfernen",
  "groupDialog.you": "(du)",
  "groupDialog.removeMember": "Mitglied entfernen",
  "groupDialog.newGroup": "Neue Gruppe",
  "groupDialog.newGroupDescription": "Erstelle eine neue Gruppe für dein Team.",
  "groupDialog.name": "Name",
  "groupDialog.namePlaceholder": "z.B. Nachbarschaft, Projekt-Team...",
  "groupDialog.create": "Erstellen",
  "groupDialog.creating": "Erstellen...",
  "groupDialog.removeImage": "Bild entfernen",
  "groupDialog.chooseImage": "Bild wählen",
  "groupDialog.membersLoading": "Mitglieder werden geladen…",
  "groupDialog.memberCount": { one: "{count} Mitglied", other: "{count} Mitglieder" },
  "groupDialog.youAreAdmin": "du bist Admin",
  "groupDialog.sections": "Bereiche",
  "groupDialog.admins": "Admin",
  "groupDialog.membersHeading": "Mitglieder · {count}",
  "groupDialog.noMemberFound": "Niemand gefunden.",
  "groupDialog.invitedHeading": "Eingeladen · {count}",
  "groupDialog.searchContact": "Kontakt suchen…",
  "groupDialog.contactsHeading": "Kontakte · {count}",
  "groupDialog.noContactFound": "Kein Kontakt gefunden.",
  "groupDialog.allContactsAreMembers": "Alle Kontakte sind bereits Mitglied.",
  "groupDialog.noVerifiedContacts": "Keine verifizierten Kontakte.",
  "groupDialog.invitedByYouHeading": "Von dir eingeladen · {count}",
  "groupDialog.pending": "Offen",
  "groupDialog.primaryColorSwatch": "Primärfarbe {hex}",
  "groupDialog.imageColor": "Farbe aus dem Bild",
  "groupDialog.openFineTuning": "Feineinstellung öffnen",
  "groupDialog.dragToSort": "Ziehen zum Sortieren",
  "groupDialog.moveUp": "{module} nach oben",
  "groupDialog.moveDown": "{module} nach unten",
  "groupDialog.deactivate": "{module} deaktivieren",
  "groupDialog.available": "Verfügbar",
  "groupDialog.confirmLeave": "Wirklich verlassen?",
  "groupDialog.leave": "Verlassen",

  // --- Aussehen eines Space (Dialog und Feineinstellung) ---
  "spaceTheme.title": "Theme",
  "spaceTheme.saveFailed": "Aussehen konnte nicht gespeichert werden",
  "spaceTheme.accent": "Akzentfarbe",
  "spaceTheme.accentScale": "Akzent {name}",
  "spaceTheme.customColor": "Eigene Farbe",
  "spaceTheme.hue": "Farbton",
  "spaceTheme.chroma": "Kräftigkeit",
  "spaceTheme.lightness": "Helligkeit",
  "spaceTheme.gray": "Grau",
  "spaceTheme.grayGroup": "Grauton",
  "spaceTheme.grayAuto": "Grau auto",
  "spaceTheme.grayScale": "Grau {name}",
  "spaceTheme.auto": "auto",
  "spaceTheme.tint": "Tönung",
  "spaceTheme.radius": "Radius",
  "spaceTheme.rounding": "Rundung",
  "spaceTheme.roundingStep": "Rundung {step}",
  "spaceTheme.panelBackground": "Panel-Hintergrund",
  "spaceTheme.surfaces": "Flächen",
  "spaceTheme.surfacesKind": "Flächen {kind}",
  "spaceTheme.contrastNeeded": "{minimum}:1 nötig",

  // --- Space-Auswahl (WorkspaceSwitcher) ---
  "workspaceSwitcher.syncProgress": { one: "{loaded} von {count} Gruppe geladen …", other: "{loaded} von {count} Gruppen geladen …" },
  "workspaceSwitcher.syncMore": { one: "{count} Gruppe geladen, es kommen noch welche …", other: "{count} Gruppen geladen, es kommen noch welche …" },
  "workspaceSwitcher.syncStart": "Deine Gruppen werden geladen …",
  "workspaceSwitcher.choose": "Space wählen",
  "workspaceSwitcher.loading": "Gruppen werden geladen",
  "workspaceSwitcher.groups": "Gruppen",
  "workspaceSwitcher.edit": "{name} bearbeiten",
  "workspaceSwitcher.create": "Neue Gruppe erstellen",

  // --- Panel (AdaptivePanel) ---
  "adaptivePanel.showAsDialog": "Als Dialog anzeigen",
  "adaptivePanel.showAsSidebar": "Als Seitenleiste anzeigen",
  "adaptivePanel.showAsDrawer": "Als Leiste unten anzeigen",
  "adaptivePanel.pin": "Anheften",
  "adaptivePanel.unpin": "Loslösen",

  // --- Hell/Dunkel-Umschalter ---
  "colorScheme.light": "Helles Design",
  "colorScheme.dark": "Dunkles Design",

  // --- Untere Navigation ---
  "bottomNav.moreLabel": "Weitere Navigation",
  "bottomNav.more": "Mehr",

  // --- App-Rahmen ---
  "appFrame.noAccessTitle": "Du bist kein Mitglied dieses Spaces",
  "appFrame.noAccessBody": "Der Space existiert nicht oder du hast keinen Zugang.",
  "appFrame.backToOverview": "Zurück zur Übersicht",

  // --- Anmeldung ---
  "auth.signIn": "Anmelden",
  "auth.signUp": "Registrieren",
  "auth.failed": "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
  "auth.signUpDescription": "Neues Konto mit E-Mail und Passwort anlegen.",
  "auth.signInDescription": "Mit deinem Konto fortfahren.",
  "auth.displayName": "Anzeigename (optional)",
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  "auth.createAccount": "Konto anlegen",
  "auth.haveAccount": "Schon ein Konto?",
  "auth.noAccount": "Noch kein Konto?",
  "auth.or": "oder",
  "auth.minLength": { one: "Mindestens {count} Zeichen", other: "Mindestens {count} Zeichen" },
  "auth.confirmPassword": "Passwort bestätigen",
  "auth.repeatPassword": "Passwort wiederholen",
  "auth.passwordMismatch": "Passwörter stimmen nicht überein",

  // --- Wiederherstellungswörter (Seed) ---
  "mnemonic.verifyPrompt": "Bestätige die folgenden Wörter aus deinem Seed:",
  "mnemonic.word": "Wort {number}:",
  "mnemonic.mismatch": "Die Wörter stimmen nicht überein. Bitte prüfe deinen Seed.",
  "mnemonic.copied": "Kopiert!",
  "mnemonic.copyWords": "Wörter kopieren",

  // --- Verifizieren (persönliches Treffen) ---
  "verification.title": "Verifizieren",
  "verification.sent": "Verifizierung gesendet",
  "verification.instructions": "Zeige deinen Code oder scanne den Code deines Gegenübers.",
  "verification.qrCode": "QR-Code",
  "verification.copied": "Kopiert",
  "verification.copyCode": "Code kopieren",
  "verification.validFor": "Code gültig für {time}",
  "verification.expired": "Code abgelaufen — neuer wird erzeugt…",
  "verification.scan": "Scannen",
  "verification.enterManually": "Code manuell eingeben",
  "verification.pastePlaceholder": "Code hier einfügen...",
  "verification.confirmQuestion": "Stehst du gerade vor dieser Person?",
  "verification.confirmHint": "Bestätige nur, wenn du diese Person persönlich kennst.",
  "verification.waitingFor": "Warte auf Verifizierung von {name}...",
  "verification.waitingForPeer": "Warte auf Verifizierung der Gegenseite...",
  "verification.waitInBackground": "Im Hintergrund warten",
  "verification.failed": "Die Verifizierung ist fehlgeschlagen.",
  "verification.createFailed": "Code konnte nicht erzeugt werden",
  "verification.invalidCode": "Ungültiger Code",

  // --- Profil-Verweise ---
  "profile.openOf": "Profil von {name} öffnen",

  // --- Kontakte ---
  "contacts.title": "Kontakte",
  "contacts.errorLabel": "Die Kontaktliste",
  "contacts.summary": "{active} {label} · {pending} ausstehend",
  "contacts.active": "Aktiv",
  "contacts.verified": "Verifiziert",
  "contacts.pending": "Ausstehend",
  "contacts.empty": "Noch keine Kontakte",
  "contacts.copyId": "ID kopieren",
  "contacts.renamePrompt": "Name ändern:",
  "contacts.rename": "Name bearbeiten",
  "contacts.remove": "Kontakt entfernen",
  "addContact.title": "Kontakt hinzufügen",
  "addContact.description": "Füge den Profil-Link oder die ID der Person ein, die du als Kontakt anfragen möchtest.",
  "addContact.idLabel": "Profil-Link oder ID",
  "addContact.idPlaceholder": "https://… oder ID",
  "addContact.nameLabel": "Name (optional)",
  "addContact.namePlaceholder": "Name der Person",
  "addContact.add": "Hinzufügen",
  "addContact.adding": "Hinzufügen...",
  "addContact.failed": "Fehler beim Hinzufügen",

  // --- Relay-Status ---
  "relay.status": "Relay: {state}",
  "relay.connected": "Verbunden",
  "relay.connecting": "Verbindet…",
  "relay.disconnected": "Getrennt",
  "relay.error": "Fehler",
  "relay.pending": "{count} ausstehend",
  "contacts.someone": "Jemand",
  "contactRequest.title": "Neue Kontaktanfrage",
  "contactRequest.body": "{name} möchte dich als Kontakt hinzufügen.",
  "contactRequest.confirming": "Bestätige…",
  "contactRequest.confirmFailed": "Bestätigen fehlgeschlagen. Bitte erneut versuchen.",
  "spaceInvite.title": "Neue Einladung",
  "spaceInvite.body": "{inviter} hat dich in {space} eingeladen.",
  "verification.incomingQuestion": "Stehst du vor dieser Person?",
  "verification.reject": "Ablehnen",
  "mutual.contactFallback": "Kontakt",
  "mutual.contactTitle": "Ihr seid jetzt Kontakte!",
  "mutual.verifiedTitle": "Gegenseitig verifiziert!",
  "mutual.you": "Du",
  "mutual.contactBody": "Du und {name} seid jetzt Kontakte.",
  "mutual.verifiedBody": "Du und {name} habt euch gegenseitig verifiziert.",

  // --- Fehlergrenzen ---
  "errorBoundary.title": "{label} konnte nicht angezeigt werden",
  "errorBoundary.thisArea": "Dieser Bereich",
  "errorBoundary.thisDialog": "Dieser Dialog",
  "errorBoundary.closeHint": "Du kannst ihn schließen — der Rest der App funktioniert weiter.",
  "errorBoundary.retryHint": "Der Rest der App funktioniert weiter. Du kannst es erneut versuchen.",

  // --- Seitenleiste ---
  "sidebar.title": "Seitenleiste",
  "sidebar.description": "Zeigt die Seitenleiste auf dem Telefon.",
  "sidebar.toggle": "Seitenleiste ein-/ausblenden",

  // --- Modul-Panel und Modul-Host ---
  "modulePanel.settingsTitle": "{module}-Einstellungen",
  "modulePanel.settingsPlaceholder": "Moduleinstellungen sind in Vorbereitung. Hier konfigurierst du später, wie das {module}-Modul in diesem Space aussieht und sich verhält.",
  "modulePanel.planned": "Geplant",
  "moduleOutlet.noAccess": "Kein Zugang zu diesem Space",
  "moduleOutlet.searchIn": "In {name} suchen",
  "moduleOutlet.noView": "Für dieses Modul ist keine Ansicht hinterlegt.",
  "moduleHost.create": "Erstellen",

  // --- Routing ---
  "workspace.overview": "Mein Netzwerk",

  // --- Ungespeicherte Änderungen ---
  "discardChanges.title": "Änderungen verwerfen?",
  "discardChanges.description": "Du hast ungespeicherte Änderungen. Wenn du fortfährst, gehen sie verloren.",
  "discardChanges.keepEditing": "Weiter bearbeiten",
  "discardChanges.discard": "Verwerfen",

  // --- Speichern eines Items (useItemEditor) ---
  "item.untitled": "Ohne Titel",
  "itemEditor.createdElsewhere": "Schon in einem anderen Space angelegt – Änderungen dort bearbeiten; ohne Änderung setzt „Erneut“ fort",
  "itemEditor.needsOpenSpace": "„Braucht“ lässt sich nur im geöffneten Space speichern – zum Verknüpfen dorthin wechseln",
  "itemEditor.readOnly": "Dieser Speicher ist nur lesbar",
  "itemEditor.linkedUnreachable": "Eine verknüpfte Aufgabe ist hier nicht erreichbar – die Verknüpfung wurde nicht gespeichert",
  "itemEditor.linkedNotWritable": "Keine Schreibrechte an „{title}“ – die Verknüpfung wurde dort nicht gespeichert",
} as const

/** Ein Eintrag: fester Text oder Plural-Formen nach `Intl.PluralRules`. */
export type Message = string | (Partial<Record<Intl.LDMLPluralRule, string>> & { other: string })

/** Die Schlüssel, die das Toolkit selbst mitbringt. */
export type ToolkitMessageKey = keyof typeof de

/**
 * Das erweiterbare Register der App-Schlüssel (rls#614).
 *
 * Leer im Toolkit; eine App trägt ihre Schlüssel per Deklarations-
 * verschmelzung ein und bekommt damit dieselbe Compilerprüfung für `t` und
 * `extendMessages` wie das Toolkit selbst:
 *
 * ```ts
 * declare module "@real-life/toolkit" {
 *   interface AppMessages {
 *     "myApp.greeting": string
 *   }
 * }
 * ```
 *
 * Nur die Schlüssel zählen, der Werttyp ist Doku. Für Schlüssel, die erst zur
 * Laufzeit entstehen (Register-Ids, Instanz-Texte), gibt es `tDynamic`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppMessages {}

/** Jeder Schlüssel, den `t` annimmt: Toolkit plus App-Register. */
export type MessageKey = ToolkitMessageKey | Extract<keyof AppMessages, string>
