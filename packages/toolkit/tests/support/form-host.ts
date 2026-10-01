import { createElement, Fragment, useEffect, useLayoutEffect, type ReactNode } from "react"

import { useFormState, type FieldAccess, type FieldDefinition, type FormState } from "../../src/lib/form-state"
import { asStrings, incomingField, peopleField, scalarField, type IncomingValue, type PeopleValue } from "../../src/components/composer/form-fields"
import { IncomingRelationField, ItemRelationWidget, type IncomingChecks, type RelationChecks } from "../../src/components/composer/widgets/item-relation-widget"
import { PeopleWidget } from "../../src/components/composer/widgets/people-widget"

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

/**
 * Ein Personenfeld mit Feldzugang. Die Spione sehen je Teil des Werts
 * (Personen, Qualifier, Änderungen an Aussagen), was sich geändert hat.
 */
export function peopleHost(props: {
  value: string[]
  qualifiers?: Record<string, string>
  changes?: Record<string, string | null>
  onChange?: (people: string[]) => void
  onQualifiersChange?: (next: Record<string, string>) => void
  onChangesChange?: (next: Record<string, string | null>) => void
  [prop: string]: unknown
}): ReactNode {
  const { value, qualifiers, onChange, onQualifiersChange, ...widget } = props
  // Die Änderungen an Aussagen gehören dem Feld; ein altes `record.changes` wird übernommen.
  const record = widget.record as { changes?: Record<string, string | null>; onChangesChange?: (next: Record<string, string | null>) => void } | undefined
  const changes = props.changes ?? record?.changes
  const onChangesChange = props.onChangesChange ?? record?.onChangesChange
  delete widget.changes
  delete widget.onChangesChange
  let last: PeopleValue = { people: value, qualifiers: qualifiers ?? {}, changes: changes ?? {} }
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return createElement(FormHost<PeopleValue>, {
    def: peopleField("Personen", { people: "people", qualifiers: "people#q", changes: "people#s" }),
    data: { people: value, "people#q": qualifiers ?? {}, "people#s": changes ?? {} },
    onValue: (next) => {
      if (!same(next.people, last.people)) onChange?.(next.people)
      if (!same(next.qualifiers, last.qualifiers)) onQualifiersChange?.(next.qualifiers)
      if (!same(next.changes, last.changes)) onChangesChange?.(next.changes)
      last = next
    },
    render: (field) => createElement(PeopleWidget, { label: "Personen", ...(widget as object), field } as never),
  })
}

/** Ein Verknüpfungsfeld (C3) mit Feldzugang; `output` zeigt den Wert in `<output id="value">`. */
export function relationHost(props: { value?: readonly string[]; onChange?: (v: string[]) => void; output?: boolean; [prop: string]: unknown }): ReactNode {
  const { value, onChange, output, ...widget } = props
  return createElement(FormHost<string[], RelationChecks>, {
    def: scalarField("relation:feld", "Verknüpfung", asStrings),
    data: { "relation:feld": [...(value ?? [])] },
    onValue: onChange,
    render: (field) =>
      createElement(
        Fragment,
        null,
        createElement(ItemRelationWidget, { ...(widget as object), field } as never),
        output ? createElement("output", { id: "value" }, field.value.join(",")) : null,
      ),
  })
}

/** Eine eingehende Kante („Braucht") mit Feldzugang; `onValue` sieht hinzugefügt und entfernt. */
export function incomingHost(props: { added?: string[]; removed?: string[]; onValue?: (added: string[], removed: string[]) => void; [prop: string]: unknown }): ReactNode {
  const { added, removed, onValue, ...widget } = props
  return createElement(FormHost<IncomingValue, IncomingChecks>, {
    def: incomingField("Braucht", { added: "relation:in:feld", removed: "relation:in:feld#removed" }),
    data: { "relation:in:feld": added ?? [], "relation:in:feld#removed": removed ?? [] },
    onValue: onValue ? (v) => onValue(v.added, v.removed) : undefined,
    render: (field) => createElement(IncomingRelationField, { ...(widget as object), field } as never),
  })
}
