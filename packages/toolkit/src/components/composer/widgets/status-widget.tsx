"use client"

import { OptionField } from "./value-widgets"
import type { OptionTone } from "@/lib/field-values"

interface StatusOption {
  id: string
  label: string
  tone?: OptionTone | "type"
  className?: string
}

interface StatusWidgetProps {
  value: string
  onChange: (value: string) => void
  label: string
  options: StatusOption[]
  /** Typfarbe des Items, für Optionen ohne Rolle und ohne Ton. */
  typeTone?: string
}

/**
 * Status (B6, Schreiben): Pillen bis vier Optionen, sonst Liste
 * (shared-components → Widget-Paare). Ein Status hat immer einen Wert; die
 * gewählte Option lässt sich nicht abwählen.
 */
export function StatusWidget({ value, onChange, label, options, typeTone }: StatusWidgetProps) {
  return <OptionField label={label} options={options} value={value} onChange={onChange} typeTone={typeTone} />
}
