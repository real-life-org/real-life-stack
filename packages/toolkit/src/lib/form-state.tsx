"use client"

// Formularzustand und Aktionszustand — der eine Besitzer von Werten, Epoche,
// Warte-Zuständen und Abonnements.
//
// Spec: docs/spec/modules/shared-components.md → „Formular-Epoche" und
// „Formularzustand" (Regeln 1–11).
//
// Der FORMULARZUSTAND (`FormState`) gehört dem `ContentComposer`. Er hält die
// Werte, die Epoche (einen monoton steigenden Zähler, Regel 2 der Epoche),
// die laufenden Arbeiten je Feld und die Hinweise auf nicht übernommene
// Ergebnisse. Ein Widget erhält davon genau einen FELDZUGANG
// (`FieldAccess`): den Wert, die Sperre, einen an die Epoche gebundenen
// Schreibweg für Eingaben, den Start einer Arbeit und deren Warte-Zustand.
// Einen Setter für beliebige Schlüssel gibt es für Widgets nicht.
//
// Zwei Arten von Arbeit (Regel 10):
// - Hintergrund (Vorschläge, Suche, Rückwärtssuche): Jede Änderung der
//   Epoche, der Sperre oder der Abbau des Felds verwirft sie still.
// - Nutzer (gewählte Datei, Kartenklick, gewähltes Ziel): Ein Wechsel von
//   Space oder Typ verwirft sie nicht. Beim Eintreffen prüft der Zustand
//   gegen den Stand JETZT; passt es nicht, steht ein Hinweis am Feld (oder,
//   gibt es das Feld nicht mehr, im Formular).
//
// Der AKTIONSZUSTAND (`useActionState`) ist dasselbe für die Selbstaktion
// (Regel 9): Epoche, Warte-Zustand und das Abonnement auf den geöffneten
// Space, das genau so lange besteht wie eine Arbeit läuft.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"

// ── Feldzugang (das Einzige, was Widgets sehen) ────────────────────────────

/** Hintergrundarbeit wird bei Epochenwechsel still verworfen, Nutzerarbeit nie (Regel 10). */
export type WorkKind = "background" | "user"

/** Der Stand eines Felds beim Eintreffen eines Ergebnisses (Regel 3 der Epoche). */
export interface FieldNow<V, C = undefined> {
  /** Der Wert des Felds JETZT. */
  readonly value: V
  /** Was das Widget zuletzt als aktuellen Prüfstand gemeldet hat (`track`). */
  readonly checks: C | undefined
  /** Schreibt über den Schreibweg des Formulars zu DIESEM Zeitpunkt. */
  set(next: V): void
  /** Nimmt das Ergebnis nicht an; bei Nutzerarbeit steht der Grund sichtbar am Feld. */
  refuse(reason: string): void
}

/** Eine laufende Arbeit eines Felds (Regel 4: Start, Anwenden, Beenden). */
export interface FieldWork<V, C = undefined> {
  /** Bricht ab, sobald die Arbeit verworfen wird (für `fetch` und Co.). */
  readonly signal: AbortSignal
  /** Läuft die Arbeit noch (weder beendet noch verworfen)? */
  valid(): boolean
  /**
   * Wendet ein Ergebnis an: prüft Epoche (Hintergrund) oder Feld und Sperre
   * (Nutzer) und ruft `fn` mit dem Stand JETZT. Sagt, ob angenommen wurde.
   */
  apply(fn: (now: FieldNow<V, C>) => void): boolean
  /** Die Arbeit ist fertig; ihr Warte-Zustand endet (idempotent). */
  finish(): void
}

/**
 * Der Feldzugang (Formularzustand, Regel 3): genau einer je Widget. Er ist
 * je Render neu; Start, Verwerfen und Warte-Zustand gehören dem
 * Formularzustand, nicht dem Render.
 */
export interface FieldAccess<V, C = undefined> {
  readonly value: V
  /** Gesperrt oder fest: nimmt weder Eingaben noch Ergebnisse an (Regel 7). */
  readonly locked: boolean
  /**
   * Schreibweg für Eingaben, gebunden an die Epoche, in der das Widget ihn
   * erhalten hat: Ein eingefangener alter Schreibweg schreibt nichts mehr.
   */
  set(next: V): void
  /**
   * Startet eine Arbeit der Art `channel`; eine laufende derselben Art in
   * diesem Feld wird verworfen. `what` benennt das Ergebnis im Hinweis
   * („Bild", „Ort").
   */
  begin(channel: string, kind: WorkKind, what: string): FieldWork<V, C>
  /** Verwirft die laufende Arbeit einer Art (Abbrechen, Entfernen); ohne Art alle. */
  cancel(channel?: string): void
  /** Läuft eine Arbeit dieser Art (oder irgendeine)? Der einzige Warte-Zustand. */
  busy(channel?: string): boolean
  /** Meldet den aktuellen Prüfstand des Widgets (Kandidaten, Rechte) für `apply`. */
  track(checks: C): void
  /** Was zuletzt nicht übernommen wurde und warum (Regel 10), sonst `null`. */
  readonly notice: string | null
  dismissNotice(): void
}

// ── Formularzustand (nur der Composer) ─────────────────────────────────────

type Data = Record<string, unknown>

/** Wie ein Feld seine Schlüssel liest und schreibt (Regel 5: nur seine Schlüssel). */
export interface FieldDefinition<V> {
  /** Beschriftung für Hinweise („Der Typ Aufgabe hat kein Feld „Bild“"). */
  label: string
  /** Die Datenschlüssel, die dem Feld laut Register gehören. */
  keys: readonly string[]
  read(data: Data): V
  write(next: V, data: Data): Data
  locked?: boolean
}

interface Slot {
  id: string
  def: FieldDefinition<unknown>
  /** Sperre, wie zuletzt übernommen (commit). */
  locked: boolean
  /** Zähler der Sperr-Wechsel: jeder ist ein Epochenschritt dieses Felds. */
  lockSteps: number
  present: boolean
  checks: unknown
  notice: string | null
}

interface Work {
  slot: Slot
  channel: string
  kind: WorkKind
  what: string
  epoch: number
  lockSteps: number
  controller: AbortController
  ended: boolean
}

export interface FormStateOptions<D extends Data> {
  data: D
  type: string
  /** Der Space des Formulars in `data`: Jede Änderung ist ein Epochenschritt. */
  spaceOf: (data: D) => string | undefined
  /** Wie ein Patch in die Daten kommt (etwa: ein Space-Wechsel nimmt lokale Ziele heraus). */
  normalize?: (data: D, patch: Data) => D
  /** Der Name eines Typs für Hinweise. */
  typeLabel?: (type: string) => string
}

/**
 * Der Formularzustand eines Formulars. Nur der Composer (und Tests) bauen
 * ihn; Widgets erreichen ihn ausschließlich über einen `FieldAccess`.
 */
export class FormState<D extends Data = Data> {
  private data: D
  private type: string
  private readonly spaceOf: (data: D) => string | undefined
  private epoch = 0
  private readonly slots = new Map<string, Slot>()
  private readonly works = new Set<Work>()
  private readonly listeners = new Set<() => void>()
  private version = 0
  private rendered = new Set<string>()
  private committedType: string
  private normalize: (data: D, patch: Data) => D = (data, patch) => ({ ...data, ...patch })
  private typeLabel: (type: string) => string = (type) => type

  constructor(options: FormStateOptions<D>) {
    this.data = options.data
    this.type = options.type
    this.committedType = options.type
    this.spaceOf = options.spaceOf
    this.configure(options)
  }

  // Werte ------------------------------------------------------------------

  getData = (): D => this.data
  getType = (): string => this.type
  getEpoch = (): number => this.epoch

  /** Wie ein Patch in die Daten kommt (etwa: Space-Wechsel nimmt lokale Ziele heraus). */
  configure(options: { normalize?: (data: D, patch: Data) => D; typeLabel?: (type: string) => string }): void {
    if (options.normalize) this.normalize = options.normalize
    if (options.typeLabel) this.typeLabel = options.typeLabel
  }

  /** Schreibt einen Patch des Composers; ein anderer Space ist ein Epochenschritt. */
  patch(patch: Data): void {
    this.replace(this.normalize(this.data, patch))
  }

  /** Ersetzt die Daten über eine Funktion des aktuellen Stands. */
  update(fn: (data: D) => D): void {
    this.replace(fn(this.data))
  }

  private replace(next: D): void {
    if (next === this.data) return
    const before = this.spaceOf(this.data)
    this.data = next
    if (this.spaceOf(next) !== before) this.step()
    this.changed()
  }

  setType(type: string): void {
    if (type === this.type) return
    this.type = type
    this.step()
    this.changed()
  }

  /** Ein Epochenschritt: Hintergrundarbeit endet sofort (Regel 4), Nutzerarbeit bleibt (Regel 10). */
  private step(): void {
    this.epoch += 1
    for (const work of [...this.works]) if (work.kind === "background") this.end(work)
  }

  // Felder -----------------------------------------------------------------

  /** Zu Beginn jedes Renders des Composers. */
  beginRender(): void {
    this.rendered = new Set()
  }

  /**
   * Der Feldzugang eines Felds für diesen Render. Gebunden an die Epoche
   * JETZT: Ein Schreibweg aus einem früheren Render schreibt nach einem
   * Epochenschritt nichts mehr.
   */
  field<V, C = undefined>(id: string, def: FieldDefinition<V>): FieldAccess<V, C> {
    this.rendered.add(id)
    let slot = this.slots.get(id)
    if (!slot) {
      slot = { id, def: def as FieldDefinition<unknown>, locked: def.locked === true, lockSteps: 0, present: false, checks: undefined, notice: null }
      this.slots.set(id, slot)
    }
    // Der Schreibweg JETZT ist der des letzten Renders (Regel 4, Anwenden).
    slot.def = def as FieldDefinition<unknown>
    const s = slot
    const epochAt = this.epoch
    const lockedAt = def.locked === true
    const lockStepsAt = s.lockSteps
    return {
      value: def.read(this.data),
      locked: lockedAt,
      notice: s.notice,
      set: (next) => {
        // Eingaben im selben Ereignis: Die Epoche steht nie dazwischen (Regel 11).
        if (this.epoch !== epochAt || s.lockSteps !== lockStepsAt || lockedAt || s.locked) return
        this.write(s, next as unknown)
      },
      begin: (channel, kind, what) => this.begin<V, C>(s, channel, kind, what),
      cancel: (channel) => {
        for (const work of [...this.works]) if (work.slot === s && (channel === undefined || work.channel === channel)) this.end(work)
      },
      busy: (channel) => [...this.works].some((w) => w.slot === s && (channel === undefined || w.channel === channel)),
      track: (checks) => {
        s.checks = checks
      },
      dismissNotice: () => {
        if (s.notice === null) return
        s.notice = null
        this.changed()
      },
    }
  }

  /** Die Felder bleiben, ohne gezeigt zu werden (Vorschau); gibt nichts zum Rendern. */
  keepFields(): null {
    for (const slot of this.slots.values()) if (slot.present) this.rendered.add(slot.id)
    return null
  }

  /**
   * Nach jedem Render (Layout-Effekt): welche Felder es gibt, und ihre
   * Sperren. Ein gesperrtes oder festgesetztes Feld ist ein Epochenschritt
   * des Felds (Regel 7); ein abgebautes verwirft seine Hintergrundarbeit,
   * ein vom Nutzer entferntes alle (Regel 8).
   */
  commit(): void {
    const typeChanged = this.committedType !== this.type
    this.committedType = this.type
    let touched = false
    for (const slot of this.slots.values()) {
      const present = this.rendered.has(slot.id)
      if (slot.present && !present) {
        // Typwechsel: Nutzerarbeit bleibt (Regel 10). Sonst hat der Nutzer
        // das Feld selbst entfernt — dann nimmt er auch seine Arbeit zurück.
        for (const work of [...this.works]) if (work.slot === slot && (!typeChanged || work.kind === "background")) this.end(work)
        touched = true
      }
      slot.present = present
    }
    for (const id of this.rendered) {
      const slot = this.slots.get(id)!
      const locked = slot.def.locked === true
      if (locked !== slot.locked) {
        slot.locked = locked
        slot.lockSteps += 1
        for (const work of [...this.works]) if (work.slot === slot && work.kind === "background") this.end(work)
        touched = true
      }
    }
    if (touched) this.changed()
  }

  /** Hinweise zu Feldern, die es im aktuellen Typ nicht gibt (Regel 10: im Formular). */
  formNotices(): { id: string; text: string; dismiss: () => void }[] {
    return [...this.slots.values()]
      .filter((slot) => !slot.present && slot.notice !== null)
      .map((slot) => ({
        id: slot.id,
        text: slot.notice!,
        dismiss: () => {
          slot.notice = null
          this.changed()
        },
      }))
  }

  /** Schließen des Formulars: alle Arbeiten enden (Regel 8). */
  close(): void {
    for (const work of [...this.works]) this.end(work)
  }

  private write(slot: Slot, next: unknown): void {
    const patch = slot.def.write(next, this.data)
    // Regel 5: Ein Feld schreibt nur seine Schlüssel.
    const own: Data = {}
    for (const key of Object.keys(patch)) if (slot.def.keys.includes(key)) own[key] = patch[key]
    slot.notice = null
    this.patch(own)
    this.changed()
  }

  private begin<V, C>(slot: Slot, channel: string, kind: WorkKind, what: string): FieldWork<V, C> {
    // Dieselbe Art im selben Feld neu: die vorige verliert ihre Gültigkeit.
    for (const other of [...this.works]) if (other.slot === slot && other.channel === channel) this.end(other)
    const work: Work = { slot, channel, kind, what, epoch: this.epoch, lockSteps: slot.lockSteps, controller: new AbortController(), ended: false }
    this.works.add(work)
    this.changed()
    return {
      signal: work.controller.signal,
      valid: () => !work.ended,
      apply: (fn) => this.apply(work, fn as (now: FieldNow<unknown, unknown>) => void),
      finish: () => this.end(work),
    }
  }

  private apply(work: Work, fn: (now: FieldNow<unknown, unknown>) => void): boolean {
    if (work.ended) return false
    const slot = work.slot
    if (work.kind === "background") {
      if (work.epoch !== this.epoch || work.lockSteps !== slot.lockSteps || !slot.present || slot.locked) {
        this.end(work)
        return false
      }
    } else {
      // Nutzerarbeit: gegen den Stand JETZT prüfen, nie still verwerfen (Regel 10).
      if (!slot.present) return this.notTaken(slot, work, `Der Typ ${this.typeLabel(this.type)} hat kein Feld „${slot.def.label}“`)
      if (slot.locked) return this.notTaken(slot, work, "Das Feld ist gesperrt")
    }
    let refused: string | null = null
    fn({
      value: slot.def.read(this.data),
      checks: slot.checks,
      set: (next) => {
        if (work.ended || refused !== null) return
        this.write(slot, next)
      },
      refuse: (reason) => {
        refused = reason
      },
    })
    if (refused !== null) {
      if (work.kind === "user") this.notTaken(slot, work, refused)
      return false
    }
    return true
  }

  private notTaken(slot: Slot, work: Work, reason: string): false {
    slot.notice = `${work.what} nicht übernommen: ${reason}`
    this.changed()
    return false
  }

  /** Beenden ist idempotent (Regel 4): Signal, Warte-Zustand — genau einmal. */
  private end(work: Work): void {
    if (work.ended) return
    work.ended = true
    work.controller.abort()
    this.works.delete(work)
    this.changed()
  }

  // Abonnement des Composers ----------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  private changed(): void {
    this.version += 1
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Der Formularzustand des Composers: einmal gebaut, bei jedem Render neu
 * gelesen; das Schließen beendet alle Arbeiten.
 */
export function useFormState<D extends Data>(init: () => FormStateOptions<D>): FormState<D> {
  const [form] = useState(() => new FormState(init()))
  useSyncExternalStore(form.subscribe, form.getVersion, form.getVersion)
  form.beginRender()
  useLayoutEffect(() => form.commit())
  useEffect(() => () => form.close(), [form])
  return form
}

// ── Aktionszustand (Selbstaktion, Regel 9) ─────────────────────────────────

/** Eine laufende Selbstaktion. */
export interface ActionWork {
  readonly signal: AbortSignal
  /** Gilt der Stand (Item, geöffneter Space) vom Klick noch? */
  valid(): boolean
  finish(): void
}

interface Action {
  controller: AbortController
  ended: boolean
}

/** Meldet Änderungen außerhalb des Renders (der geöffnete Space beim Connector). */
export type ActionWatch = (onChange: () => void) => () => void

/**
 * Der Aktionszustand: Epoche, Warte-Zustand und Abonnement einer
 * Selbstaktion. Das Abonnement besteht genau, solange eine Arbeit läuft —
 * auch nach dem Abbau der Anzeige, nicht länger.
 */
export class ActionState {
  private readonly running = new Set<Action>()
  private readonly listeners = new Set<() => void>()
  private unwatch: (() => void) | null = null
  watch: ActionWatch | undefined

  begin = (): ActionWork => {
    const action: Action = { controller: new AbortController(), ended: false }
    this.running.add(action)
    if (this.unwatch === null && this.watch) {
      // Eine Meldung schon beim Anmelden zählt erst danach (sonst fehlte die Abmeldung).
      let early = false
      let registering = true
      const stop = this.watch(() => {
        if (registering) early = true
        else this.step()
      })
      registering = false
      this.unwatch = stop
      if (early) this.step()
    }
    this.changed()
    return {
      signal: action.controller.signal,
      valid: () => !action.ended,
      finish: () => this.end(action),
    }
  }

  /** Ein Epochenschritt: alle laufenden Aktionen sind verworfen, sofort. */
  step(): void {
    for (const action of [...this.running]) this.end(action)
  }

  busy = (): boolean => this.running.size > 0

  /** Für Tests: Zahl der offenen Abonnements (0 oder 1). */
  subscriptions(): number {
    return this.unwatch === null ? 0 : 1
  }

  private end(action: Action): void {
    if (action.ended) return
    action.ended = true
    action.controller.abort()
    this.running.delete(action)
    if (this.running.size === 0 && this.unwatch) {
      const stop = this.unwatch
      this.unwatch = null
      stop()
    }
    this.changed()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Der Aktionszustand einer Selbstaktion. `scope` (Item, geöffneter Space)
 * ist der Stand: jede Änderung ist ein Epochenschritt. `watch` meldet
 * Space-Wechsel des Connectors, auch nach dem Abbau der Anzeige.
 */
export function useActionState(scope: readonly unknown[], watch?: ActionWatch): { begin: () => ActionWork; busy: boolean; state: ActionState } {
  const [state] = useState(() => new ActionState())
  state.watch = watch
  const key = JSON.stringify(scope)
  const seen = useRef(key)
  useLayoutEffect(() => {
    if (seen.current === key) return
    seen.current = key
    state.step()
  }, [key, state])
  const busy = useSyncExternalStore(state.subscribe, state.busy, state.busy)
  return { begin: state.begin, busy, state }
}
