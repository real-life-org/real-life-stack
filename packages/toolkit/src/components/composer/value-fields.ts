// Wert-Felder im Formular (S4a): number (B7), select (B8), url (B9), chips
// (B10), contact (B12) — abgeleitet aus dem Feldregister, abgebildet auf
// `item.data[key]`. Seit S4b auch avatar (B11): ein Bild im Kopf des
// Formulars, gespeichert als sichere Bildadresse.
//
// Spec: docs/spec/06-schema-composition.md → „Feld- und Kantenregister",
// Regel 16 (ContentTypeConfig wird abgeleitet); docs/spec/modules/
// shared-components.md → Widget-Paare. Status (B6) bleibt bei
// `statusOptions`, weil Kanban und Selbstaktionen `status` lesen.

import type { FieldEntry } from "../preview/field-register"
import {
  chipValues,
  contactError,
  optionTone,
  type OptionTone,
  normalizeUrl,
  numberError,
  parseNumberInput,
  safeImageSrc,
  urlError,
} from "../../lib/field-values"

export type ValueWidgetId = "number" | "select" | "url" | "chips" | "contact" | "status" | "avatar"

/** Wert-Widgets, die nur das Register setzt (nie zum Zuschalten). Status ist zuschaltbar und steht darum nicht hier. */
export const VALUE_WIDGETS: ReadonlySet<string> = new Set<ValueWidgetId>(["number", "select", "url", "chips", "contact"])

/** Widgets, deren Register-Felder im Formular gemeinsam in Register-Reihenfolge stehen. */
export const ORDERED_VALUE_WIDGETS: ReadonlySet<string> = new Set<ValueWidgetId>([...VALUE_WIDGETS, "status"] as ValueWidgetId[])

export interface ValueFieldConfig {
  /** `item.data[key]`. */
  key: string
  widget: ValueWidgetId
  label: string
  /** number: Einheit und Grenzen. */
  unit?: string
  min?: number
  max?: number
  /** select: die Werte. */
  options?: readonly { id: string; label: string; tone?: OptionTone | "type" }[]
  /** chips: Vorschläge des Hosts; dazu kommen die Werte desselben Felds im Formular-Space. */
  suggestions?: readonly string[]
  /** `edit: "fixed"` (06, Regel 14): sichtbar, nicht bearbeitbar. */
  fixed?: boolean
}

/** Die Wert-Felder des Formulars, in Register-Reihenfolge; `edit: false` fehlt. */
export function valueFieldsFromRegister(fields: readonly FieldEntry[]): ValueFieldConfig[] {
  return fields
    // Status (B6) steht mit, damit das Formular die Register-Reihenfolge hält;
    // geschrieben wird er wie bisher über `statusOptions`.
    // Der Avatar (B11) steht im Kopf des Formulars, nicht bei den Werten;
    // abgebildet wird er wie sie.
    .filter((x) => (ORDERED_VALUE_WIDGETS.has(x.widget) || x.widget === "avatar") && (x.widget !== "status" || !!x.options?.length) && x.edit !== false && x.pos !== "module" && x.pos !== "system")
    .map((x) => ({
      key: x.key,
      widget: x.widget as ValueWidgetId,
      label: x.label ?? x.key,
      ...(x.unit !== undefined ? { unit: x.unit } : {}),
      ...(x.min !== undefined ? { min: x.min } : {}),
      ...(x.max !== undefined ? { max: x.max } : {}),
      ...(x.options ? { options: x.options.map((o) => ({ id: o.id, label: o.label, tone: optionTone(x.widget, o) })) } : {}),
      ...(x.edit === "fixed" ? { fixed: true } : {}),
    }))
}

/** Der Fehler eines Werts im Formular, oder `null`. Leer ist nie ein Fehler. */
export function valueFieldError(field: ValueFieldConfig, value: unknown): string | null {
  switch (field.widget) {
    case "number":
      return numberError(value, field)
    case "url":
      return typeof value === "string" ? urlError(value) : null
    case "contact":
      return typeof value === "string" ? contactError(value) : null
    default:
      return null
  }
}

/** Formularwert aus `item.data` (Vorbelegung beim Bearbeiten), oder `undefined`. */
export function valueFieldFromData(field: ValueFieldConfig, stored: unknown): unknown {
  switch (field.widget) {
    case "number":
      return typeof stored === "number" && Number.isFinite(stored) ? String(stored) : typeof stored === "string" ? stored : undefined
    case "chips": {
      const values = chipValues(stored)
      return values.length > 0 ? values : undefined
    }
    default:
      return typeof stored === "string" ? stored : undefined
  }
}

/**
 * `item.data`-Wert aus dem Formular: `undefined`, wenn nichts zu speichern
 * ist (leer), `null`, wenn der Wert ungültig ist (dann bleibt der alte).
 */
export function valueFieldToData(field: ValueFieldConfig, value: unknown): unknown {
  switch (field.widget) {
    case "number": {
      const n = parseNumberInput(value)
      if (n === undefined) return undefined
      return Number.isNaN(n) || numberError(n, field) ? null : n
    }
    case "chips": {
      const values = chipValues(value)
      return values.length > 0 ? values : undefined
    }
    case "url": {
      if (typeof value !== "string" || value.trim() === "") return undefined
      return normalizeUrl(value)
    }
    case "contact": {
      if (typeof value !== "string" || value.trim() === "") return undefined
      return contactError(value) ? null : value.trim()
    }
    case "select":
    case "status": {
      if (typeof value !== "string" || value === "") return undefined
      return value
    }
    case "avatar": {
      // Nur eine sichere Bildadresse (B11); Unsicheres lässt den alten Wert stehen.
      if (typeof value !== "string" || value.trim() === "") return undefined
      return safeImageSrc(value)
    }
  }
}
