import { createElement, Fragment, useEffect, useLayoutEffect, type ReactNode } from "react"

import { useFormState, type FieldAccess, type FieldDefinition, type FormState } from "../../src/lib/form-state"

/**
 * Prüfstand für Widgets mit Feldzugang: ein Formularzustand mit EINEM Feld,
 * wie der Composer ihn baut. Space und Typ kommen als Props (wie der Kopf
 * des Formulars), `present: false` baut das Feld ab, ohne das Formular zu
 * schließen. `onValue` sieht jede Änderung des Feldwerts.
 */
export interface FormHostProps<V, C> {
  def: FieldDefinition<V>
  data?: Record<string, unknown>
  space?: string
  type?: string
  locked?: boolean
  present?: boolean
  onValue?: (value: V) => void
  form?: { current: FormState | null }
  render: (field: FieldAccess<V, C>) => ReactNode
}

export function FormHost<V, C = undefined>(props: FormHostProps<V, C>): ReactNode {
  const form = useFormState(() => ({
    data: { group: props.space ?? "", ...(props.data ?? {}) } as Record<string, unknown>,
    type: props.type ?? "typ",
    spaceOf: (d: Record<string, unknown>) => (typeof d.group === "string" && d.group !== "" ? d.group : undefined),
  }))
  if (props.form) props.form.current = form as FormState
  const onValue = props.onValue
  useEffect(() => {
    if (!onValue) return
    let last = JSON.stringify(props.def.read(form.getData()))
    return form.subscribe(() => {
      const value = props.def.read(form.getData())
      const now = JSON.stringify(value)
      if (now === last) return
      last = now
      onValue(value)
    })
  }, [form, onValue]) // eslint-disable-line react-hooks/exhaustive-deps
  // Kopf zuerst: Space und Typ wechseln vor dem Commit des Formulars, wie
  // ein Wechsel im Kopf des Composers (Kind-Effekte laufen vor denen des Elternteils).
  const head = createElement(Head, { form: form as FormState, space: props.space ?? "", type: props.type ?? "typ" })
  if (props.present === false) return createElement(Fragment, null, head)
  const field = form.field<V, C>("feld", { ...props.def, ...(props.locked ? { locked: true } : {}) })
  return createElement(Fragment, null, head, props.render(field))
}

function Head({ form, space, type }: { form: FormState; space: string; type: string }): ReactNode {
  useLayoutEffect(() => {
    if (form.getData().group !== space) form.patch({ group: space })
    form.setType(type)
  }, [form, space, type])
  return null
}

/** Kurzform: ein Feld mit einem Schlüssel. */
export function single<V>(key: string, read: (raw: unknown) => V, label = "Feld"): FieldDefinition<V> {
  return { label, keys: [key], read: (d) => read(d[key]), write: (v) => ({ [key]: v }) }
}
