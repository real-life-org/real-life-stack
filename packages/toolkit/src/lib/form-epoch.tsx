"use client"

// Formular-Epoche — asynchrone Arbeit beschreibt nie einen Stand, für den sie
// nicht begonnen wurde.
//
// Spec: docs/spec/modules/shared-components.md → „Formular-Epoche".
//
// Ein Formular hat einen Stand (Space des Formulars, Typ, Lebensdauer); jedes
// Feld hat seine eigene Lebensdauer. Wer asynchron arbeitet (Geocoding,
// Rückwärtssuche, Pick-Rückruf, Bild verkleinern, Suche, Frisch-Lesen), holt
// sich beim Start einen Wächter (`begin`) und wendet das Ergebnis nur an, wenn
// der Wächter noch gilt. Widgets bauen das nicht selbst.

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react"

/** Ein Wächter für EINE asynchrone Arbeit. */
export interface EpochGuard<S> {
  /** Bricht ab, sobald die Arbeit ungültig wird (für `fetch` und Co.). */
  readonly signal: AbortSignal
  /** Gilt der Stand, für den die Arbeit begann, noch? */
  valid(): boolean
  /**
   * Der Stand des Felds JETZT (Regel 3: gegen den aktuellen Stand prüfen und
   * schreiben, nicht gegen den beim Start). Nur aufrufen, wenn `valid()`.
   */
  now(): S
  /** Führt `fn` mit dem aktuellen Stand aus, wenn der Wächter gilt; sagt, ob es lief. */
  apply(fn: (state: S) => void): boolean
}

export interface FieldEpoch<S> {
  /**
   * Beginnt eine Arbeit. Mit `channel` verliert eine vorige Arbeit derselben
   * Art ihre Gültigkeit (neue Suche, neue Bildwahl, neuer Pick — Regel 2).
   */
  begin(channel?: string): EpochGuard<S>
  /** Nimmt die laufende Arbeit einer Art zurück (etwa „Entfernen"); ohne Art alle. */
  invalidate(channel?: string): void
}

/** Die Epoche des Formulars; ohne Provider 0 (dann zählt nur die Lebensdauer des Felds). */
const FormEpochContext = createContext<number>(0)

/**
 * Hält die Epoche eines Formulars: Sie steigt, wenn sich der Stand (`scope`,
 * etwa `[formSpace, type]`) ändert. Unter dem Provider verlieren alle
 * laufenden Arbeiten der Felder dann ihre Gültigkeit.
 */
export function FormEpochProvider({ scope, children }: { scope: readonly unknown[]; children: ReactNode }) {
  const key = JSON.stringify(scope)
  const epoch = useRef({ key, value: 0 })
  if (epoch.current.key !== key) epoch.current = { key, value: epoch.current.value + 1 }
  return <FormEpochContext.Provider value={epoch.current.value}>{children}</FormEpochContext.Provider>
}

export interface FieldEpochOptions {
  /**
   * Zusätzlicher Stand des Felds; ändert er sich, steigt die Epoche (etwa
   * Item und geöffneter Space einer Selbstaktion, Regel 5).
   */
  scope?: readonly unknown[]
  /**
   * `false`: Der Abbau des Felds beendet die Arbeit NICHT (eine Selbstaktion
   * schreibt auch, wenn das Panel inzwischen zu ist). Standard `true`.
   */
  lifetime?: boolean
}

/**
 * Die Epoche eines Felds: die des Formulars, der eigene `scope` und die
 * Lebensdauer des Felds. `state` ist der Stand des Felds in diesem Render;
 * ein Wächter liest ihn mit `now()` zum Zeitpunkt des Eintreffens.
 *
 * @answers `{ begin, invalidate }`
 * @without — (ohne `FormEpochProvider` zählt nur die Lebensdauer des Felds)
 * @group state
 * @see spec docs/spec/modules/shared-components.md
 */
export function useFieldEpoch<S = undefined>(state?: S, options: FieldEpochOptions = {}): FieldEpoch<S> {
  const formEpoch = useContext(FormEpochContext)
  const scopeKey = JSON.stringify(options.scope ?? [])
  const lifetime = options.lifetime !== false

  // Der Stand, gegen den ein Wächter JETZT prüft. Im Render gesetzt: Ein
  // Wechsel von Space oder Typ gilt sofort, nicht erst nach einem Effekt.
  const live = useRef({ key: `${formEpoch}|${scopeKey}`, state: state as S, alive: true })
  live.current.key = `${formEpoch}|${scopeKey}`
  live.current.state = state as S

  // Laufende Arbeiten: je Art die letzte, dazu ihre Abbrecher.
  const running = useRef(new Map<string, { token: object; controller: AbortController }>())
  const anonymous = useRef(new Set<AbortController>())

  const abortAll = () => {
    for (const { controller } of running.current.values()) controller.abort()
    running.current.clear()
    for (const controller of anonymous.current) controller.abort()
    anonymous.current.clear()
  }

  // Ein neuer Stand bricht die laufende Arbeit sofort ab (für `signal`);
  // gültig ist sie ohnehin nicht mehr (`valid` vergleicht den Schlüssel).
  const key = `${formEpoch}|${scopeKey}`
  const seenKey = useRef(key)
  useEffect(() => {
    if (seenKey.current !== key) {
      seenKey.current = key
      abortAll()
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    live.current.alive = true
    return () => {
      if (lifetime) {
        live.current.alive = false
        abortAll()
      }
    }
  }, [lifetime]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo<FieldEpoch<S>>(
    () => ({
      begin(channel) {
        const startKey = live.current.key
        const controller = new AbortController()
        const token = {}
        if (channel !== undefined) {
          running.current.get(channel)?.controller.abort()
          running.current.set(channel, { token, controller })
        } else {
          anonymous.current.add(controller)
        }
        const valid = () =>
          !controller.signal.aborted &&
          (live.current.alive || !lifetime) &&
          live.current.key === startKey &&
          (channel === undefined || running.current.get(channel)?.token === token)
        return {
          signal: controller.signal,
          valid,
          now: () => live.current.state,
          apply(fn) {
            if (!valid()) return false
            fn(live.current.state)
            return true
          },
        }
      },
      invalidate(channel) {
        if (channel === undefined) {
          abortAll()
          return
        }
        running.current.get(channel)?.controller.abort()
        running.current.delete(channel)
      },
    }),
    [lifetime],
  )
}
