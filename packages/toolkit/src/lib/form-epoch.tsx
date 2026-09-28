"use client"

// Formular-Epoche — asynchrone Arbeit beschreibt nie einen Stand, für den sie
// nicht begonnen wurde.
//
// Spec: docs/spec/modules/shared-components.md → „Formular-Epoche".
//
// Die Epoche ist ein monoton steigender ZÄHLER (Regel 2): Jede Änderung von
// Space, Typ, Lebensdauer oder Sperre erhöht ihn; Werte werden nie verglichen,
// ein Hin- und Rückwechsel macht alte Arbeit also nicht wieder gültig. Wer
// asynchron arbeitet, holt sich beim Start einen Wächter (`begin`), wendet das
// Ergebnis mit `apply` an und meldet das Ende mit `finish`. Den Warte-Zustand
// (läuft, fertig, verworfen) führt der Baustein (`useEpochBusy`, Regel 4).

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react"

/** Ein Wächter für EINE asynchrone Arbeit. */
export interface EpochGuard<S> {
  /** Bricht ab, sobald die Arbeit ungültig wird (für `fetch` und Co.). */
  readonly signal: AbortSignal
  /** Gilt der Stand, für den die Arbeit begann, noch? */
  valid(): boolean
  /** Der Stand des Felds JETZT (Regel 3). Nur lesen, wenn `valid()`. */
  now(): S
  /**
   * Führt `fn` mit dem aktuellen Stand aus, wenn die Arbeit noch gilt und das
   * Feld nicht gesperrt ist (Regel 3); sagt, ob es lief.
   */
  apply(fn: (state: S) => void): boolean
  /** Die Arbeit ist fertig (ihr Warte-Zustand endet). */
  finish(): void
}

export interface FieldEpoch<S> {
  /**
   * Beginnt eine Arbeit. Mit `channel` verliert eine vorige Arbeit derselben
   * Art ihre Gültigkeit (neue Suche, neue Bildwahl, neuer Pick — Regel 2).
   */
  begin(channel?: string): EpochGuard<S>
  /** Nimmt die laufende Arbeit einer Art zurück (etwa „Entfernen"); ohne Art alle. */
  invalidate(channel?: string): void
  /** Für `useEpochBusy`: Änderungen der Warte-Zustände abonnieren. */
  subscribe(onChange: () => void): () => void
  /** Für `useEpochBusy`: läuft eine gültige Arbeit dieser Art (oder irgendeiner)? */
  busy(channel?: string): boolean
}

/** Der Zähler des Formulars; ohne Provider 0 (dann zählt nur das Feld). */
const FormEpochContext = createContext<number>(0)

/** Zählt Änderungen eines Werts: jede Änderung gegenüber dem vorigen Render erhöht den Zähler. */
function useChangeCounter(value: string): number {
  const counter = useRef({ value, count: 0 })
  if (counter.current.value !== value) counter.current = { value, count: counter.current.count + 1 }
  return counter.current.count
}

/**
 * Hält die Epoche eines Formulars: Jede Änderung seines Stands (`scope`,
 * etwa `[formSpace, type]`) erhöht den Zähler. Unter dem Provider verlieren
 * dann alle laufenden Arbeiten der Felder ihre Gültigkeit.
 */
export function FormEpochProvider({ scope, children }: { scope: readonly unknown[]; children: ReactNode }) {
  const parent = useContext(FormEpochContext)
  const own = useChangeCounter(JSON.stringify(scope))
  // Verschachtelt: jede Änderung außen oder innen zählt (Summe zweier monotoner Zähler).
  return <FormEpochContext.Provider value={parent + own}>{children}</FormEpochContext.Provider>
}

export interface FieldEpochOptions {
  /** Zusätzlicher Stand des Felds; jede Änderung erhöht die Epoche. */
  scope?: readonly unknown[]
  /**
   * `false`: Der Abbau des Felds beendet die Arbeit NICHT (eine Selbstaktion
   * schreibt auch, wenn das Panel inzwischen zu ist). Standard `true`.
   */
  lifetime?: boolean
  /**
   * Gesperrt oder fest (Regel 3): Ein gesperrtes Feld nimmt keine Ergebnisse
   * an; jede Änderung der Sperre erhöht die Epoche.
   */
  locked?: boolean
  /**
   * Eine Quelle von Änderungen außerhalb des Renders (etwa der geöffnete
   * Space beim Connector). Jede Meldung erhöht die Epoche — auch nachdem das
   * Feld abgebaut ist, solange eine Arbeit läuft (Regel 6).
   */
  watch?: (onChange: () => void) => () => void
}

interface Running {
  token: object
  controller: AbortController
  channel: string | undefined
  done: boolean
  valid: () => boolean
}

/**
 * Die Epoche eines Felds: Zähler des Formulars, eigener Zähler (Scope,
 * Sperre, externe Meldungen) und Lebensdauer. `state` ist der Stand des
 * Felds in diesem Render; ein Wächter liest ihn mit `now()`.
 *
 * @answers `{ begin, invalidate, busy, subscribe }`
 * @without — (ohne `FormEpochProvider` zählt nur das Feld)
 * @group state
 * @see spec docs/spec/modules/shared-components.md
 */
export function useFieldEpoch<S = undefined>(state?: S, options: FieldEpochOptions = {}): FieldEpoch<S> {
  const formEpoch = useContext(FormEpochContext)
  const locked = options.locked === true
  const lifetime = options.lifetime !== false
  // Eigener Zähler: Scope und Sperre — jede Änderung zählt.
  const own = useChangeCounter(JSON.stringify([options.scope ?? [], locked]))

  // Monotone Zähler, im Render übernommen: Ein Wechsel gilt sofort.
  const live = useRef({ form: formEpoch, own, external: 0, alive: true, locked, state: state as S })
  live.current.form = formEpoch
  live.current.own = own
  live.current.locked = locked
  live.current.state = state as S

  const running = useRef(new Set<Running>())
  const listeners = useRef(new Set<() => void>())
  const notify = () => {
    for (const l of listeners.current) l()
  }
  const abort = (r: Running) => {
    r.controller.abort()
    running.current.delete(r)
  }
  const abortAll = () => {
    for (const r of [...running.current]) abort(r)
    notify()
  }

  // Jeder Zählerschritt beendet laufende Arbeit sofort (Signal, Warte-Zustand).
  const epochKey = `${formEpoch}|${own}`
  const seen = useRef(epochKey)
  useEffect(() => {
    if (seen.current === epochKey) return
    seen.current = epochKey
    abortAll()
  }, [epochKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Externe Quelle: jede Meldung ist ein Zählerschritt.
  const watch = useRef(options.watch)
  watch.current = options.watch

  useEffect(() => {
    live.current.alive = true
    return () => {
      if (!lifetime) return
      live.current.alive = false
      abortAll()
    }
  }, [lifetime]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo<FieldEpoch<S>>(() => {
    const busy = (channel?: string) =>
      [...running.current].some((r) => !r.done && r.valid() && (channel === undefined || r.channel === channel))
    return {
      begin(channel) {
        const start = { form: live.current.form, own: live.current.own, external: live.current.external }
        const controller = new AbortController()
        const entry: Running = { token: {}, controller, channel, done: false, valid: () => false }
        if (channel !== undefined) {
          for (const r of [...running.current]) if (r.channel === channel) abort(r)
        }
        running.current.add(entry)
        // Die externe Quelle zählt, solange die Arbeit läuft — auch nach dem
        // Abbau des Felds (lifetime: false). Danach wird abgemeldet.
        const stopWatch = watch.current?.(() => {
          live.current.external += 1
          abort(entry)
          stopWatch?.()
          notify()
        })
        const valid = () =>
          !controller.signal.aborted &&
          (live.current.alive || !lifetime) &&
          live.current.form === start.form &&
          live.current.own === start.own &&
          live.current.external === start.external
        entry.valid = valid
        notify()
        return {
          signal: controller.signal,
          valid,
          now: () => live.current.state,
          apply(fn) {
            if (!valid() || live.current.locked) return false
            fn(live.current.state)
            return true
          },
          finish() {
            if (entry.done) return
            entry.done = true
            stopWatch?.()
            running.current.delete(entry)
            notify()
          },
        }
      },
      invalidate(channel) {
        if (channel === undefined) {
          abortAll()
          return
        }
        for (const r of [...running.current]) if (r.channel === channel) abort(r)
        notify()
      },
      subscribe(onChange) {
        listeners.current.add(onChange)
        return () => listeners.current.delete(onChange)
      },
      busy,
    }
  }, [lifetime]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Läuft eine gültige Arbeit dieser Art? Der Warte-Zustand des Bausteins
 * (Regel 4): endet mit `finish`, mit dem Verwerfen (Zählerschritt,
 * `invalidate`) und mit einer neuen Arbeit derselben Art.
 *
 * @answers `boolean`
 * @without — (braucht eine Feld-Epoche)
 * @group state
 * @see spec docs/spec/modules/shared-components.md
 */
export function useEpochBusy(epoch: FieldEpoch<unknown>, channel?: string): boolean {
  const read = () => epoch.busy(channel)
  return useSyncExternalStore(epoch.subscribe, read, read)
}
