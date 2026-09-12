import {
  createObservable,
  type InitialSyncState,
  type Observable,
  type ReactiveObservable,
} from "@real-life-stack/data-interface"

/**
 * Erstsync-Zustand dieses Geräts, abgeleitet aus dem Catch-up-Zustand des
 * Adapters (web-of-trust#343).
 *
 * **Vorher stand hier eine Zustandsmaschine mit drei Zeitfenstern.** Die App
 * hatte keinen Zugang zum Catch-up-Zustand und musste ihn aus mitgelesenen
 * Wire-Rahmen plus Ruhepausen erraten — mit allen Folgeproblemen, die das mit
 * sich brachte: Reihenfolge asynchroner Auswertungen, Lebenszyklus über
 * Re-Logins, Fristen, die offline ablaufen. Nichts davon war ein
 * Anwendungsproblem, und nichts davon ist noch hier.
 *
 * Übrig bleibt eine Übersetzung: `CatchUpOverview.syncing` sagt, ob noch etwas
 * aussteht; die Gruppenzahlen kommen aus der Mitgliedschaftsliste und dienen
 * nur der Anzeige („3 von 12"). Keine Timer, keine Heuristik, keine Vermutung.
 */
export class InitialSyncTracker {
  private readonly obs: ReactiveObservable<InitialSyncState> =
    createObservable<InitialSyncState>({ active: false, loadedGroups: 0, expectedGroups: null })


  /** Von aussen zu erwartende Daten (falsch nur bei frisch erzeugter Identität). */
  private expectRemoteData = false
  /**
   * Die Erstbefüllung dieses Geräts ist durch.
   *
   * Einmal gesetzt, bleibt es gesetzt: ab da ist ein Catch-up normaler Betrieb
   * — eine Einladung am nächsten Tag soll nicht wieder als „Erstsync"
   * erscheinen.
   */
  private firstFillDone = false
  private stopped = false
  /** Läuft laut Adapter gerade ein Catch-up, dem etwas fehlt? */
  private outstanding = false
  /**
   * Hat der Adapter in dieser Runtime einen Lauf als ABGESCHLOSSEN gemeldet?
   *
   * Trennt „nichts steht aus, weil der Lauf durch ist" von „nichts steht aus,
   * weil noch nichts angefangen hat". Nur im ersten Fall darf die
   * Abschlussbedingung greifen; ohne diese Unterscheidung liesse die
   * Nachbewertung in {@link setGroupCounts} das Latch schon beim Login
   * zuschnappen.
   */
  private catchUpSettled = false
  private loadedGroups = 0
  private expectedGroups: number | null = null

  observe(): Observable<InitialSyncState> {
    return this.obs
  }

  /**
   * Ist die Erstbefüllung dieses Geräts durch?
   *
   * Dieselbe Aussage, die `active` intern benutzt, nur ohne die Anzeigelogik
   * darum herum. Die Home-Quelle des Profils (RLS-Spec 12 Regel 12) braucht
   * sie: migriert werden darf erst, wenn die Mitgliedschaftsliste und der
   * Catch-up zusammenpassen — sonst liefe die Bestandsregel über einen
   * halb angekommenen Bestand.
   */
  isFirstFillDone(): boolean {
    return this.firstFillDone
  }

  /** Eine neue Runtime beginnt (Bootstrap, vor dem ersten Sync-Start). */
  prepare(): void {
    this.stopped = false
    this.expectRemoteData = false
    this.firstFillDone = false
    this.outstanding = false
    this.catchUpSettled = false
    this.loadedGroups = 0
    this.expectedGroups = null
    this.publish()
  }

  /**
   * Nach abgeschlossenem Login aufrufen.
   *
   * @param expectRemoteData `false` für eine gerade erzeugte Identität — dort
   *   ist „keine Gruppe" die Wahrheit und keine Wartesituation.
   * @param localGroups Gruppen, die schon lokal vorliegen. Sind welche da, hat
   *   die Oberfläche etwas zu zeigen; der Nachlauf ist dann normaler Sync.
   */
  begin({ expectRemoteData, localGroups }: { expectRemoteData: boolean; localGroups: number }): void {
    this.stopped = false
    this.expectRemoteData = expectRemoteData
    this.loadedGroups = localGroups
    // NICHT „hat schon Gruppen" als Kriterium: der Sync startet vor dem
    // lokalen Lesevorgang, eine erste eingetroffene Gruppe würde den laufenden
    // Erstsync sonst unsichtbar machen. Entscheidend ist, ob die
    // Mitgliedschaftsliste mehr kennt als da ist.
    // Ein bereits gesetztes Latch bleibt: der Sync startet VOR dem lokalen
    // Lesevorgang und kann seinen Abschluss autoritativ gemeldet haben, bevor
    // `begin()` läuft. Das zurückzunehmen liesse den nächsten normalen
    // Catch-up als Erstsync erscheinen.
    this.firstFillDone = this.firstFillDone || this.completeAtLogin()
    this.publish()
  }

  /** Fehlt nachweislich eine Gruppe, die die Liste schon kennt? */
  private missingGroups(): boolean {
    return this.expectedGroups !== null && this.expectedGroups > this.loadedGroups
  }

  /**
   * Beim Login: gilt der Bestand als vollständig?
   *
   * NUR über tatsächlich vorhandene Gruppen. `expected === 0` zählt hier
   * ausdrücklich NICHT — beim Login ist das persönliche Dokument zwar schon
   * initialisiert, aber leer, und „0 von 0" hiesse fertig, bevor überhaupt
   * etwas angefangen hat. Diese Aussage darf erst nach einem abgeschlossenen
   * Catch-up gelten (siehe {@link evaluateFirstFill}).
   */
  private completeAtLogin(): boolean {
    return this.loadedGroups > 0 && !this.missingGroups()
  }

  /**
   * Erstbefüllung abgeschlossen: der Adapter hat einen Lauf beendet, es steht
   * nichts mehr aus UND nichts fehlt. Nach einem abgeschlossenen Lauf darf auch
   * „die Liste kennt keine Gruppe" als Vollzug gelten; beim Login wäre das
   * verfrüht (siehe {@link completeAtLogin}).
   *
   * Die Bedingung wird aus BEIDEN Eingängen bewertet — dem Catch-up-Zustand und
   * den Gruppenzahlen. Die Reihenfolge, in der sie eintreffen, ist nicht
   * festgelegt: meldet der Adapter den Abschluss, während die Liste noch „0 von
   * 1" sagt, holt die Zahl erst danach auf, und ohne Nachbewertung bliebe das
   * Latch für den Rest der Sitzung offen.
   */
  private evaluateFirstFill(): void {
    if (this.firstFillDone || this.outstanding || !this.catchUpSettled) return
    if (this.missingGroups()) return
    if (this.loadedGroups > 0 || this.expectedGroups === 0) this.firstFillDone = true
  }

  /** Der Adapter meldet, ob für irgendein Dokument noch etwas aussteht. */
  setOutstanding(outstanding: boolean): void {
    if (this.stopped || outstanding === this.outstanding) return
    this.outstanding = outstanding
    if (!outstanding) this.catchUpSettled = true
    this.evaluateFirstFill()
    this.publish()
  }

  /**
   * Stand der Gruppenliste — reine Anzeige. `expected` kommt aus der
   * Mitgliedschaftsliste des persönlichen Dokuments, `null` solange die noch
   * nichts hergibt.
   */
  setGroupCounts({ loaded, expected }: { loaded: number; expected: number | null }): void {
    if (this.stopped) return
    if (loaded === this.loadedGroups && expected === this.expectedGroups) return
    this.loadedGroups = loaded
    this.expectedGroups = expected
    this.evaluateFirstFill()
    this.publish()
  }

  /** Abmelden / Teardown: Anzeige aus, Zustand eingefroren. */
  end(): void {
    this.stopped = true
    this.expectRemoteData = false
    this.outstanding = false
    this.publish()
  }

  private publish(): void {
    const active = this.expectRemoteData && !this.firstFillDone && this.outstanding
    const current = this.obs.current
    if (
      current.active === active &&
      current.loadedGroups === this.loadedGroups &&
      current.expectedGroups === this.expectedGroups
    ) return
    this.obs.set({ active, loadedGroups: this.loadedGroups, expectedGroups: this.expectedGroups })
  }
}
