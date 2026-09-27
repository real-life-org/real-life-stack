"use client"

import { OptionField } from "./value-widgets"

interface StatusOption {
  id: string
  label: string
  className?: string
}

interface StatusWidgetProps {
  value: string
  onChange: (value: string) => void
  label: string
  options: StatusOption[]
}

/**
 * Status (B6, Schreiben): Segment bis vier Optionen, sonst Liste
 * (shared-components → Widget-Paare). Ein Status hat immer einen Wert; die
 * gewählte Option lässt sich nicht abwählen.
 */
export function StatusWidget({ value, onChange, label, options }: StatusWidgetProps) {
  return <OptionField label={label} options={options} value={value} onChange={onChange} />
}
