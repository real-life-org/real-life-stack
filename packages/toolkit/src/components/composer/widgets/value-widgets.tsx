"use client"

import * as React from "react"
import { Globe, Lock, Mail, Phone, X } from "lucide-react"

import { Input } from "@/components/primitives/input"
import { cn } from "@/lib/utils"
import { contactKind } from "@/lib/field-values"

/**
 * Schreibformen der einfachen Wert-Widgets (S4a; shared-components →
 * Widget-Paare): Segment oder Dropdown für status (B6) und select (B8), ein
 * Zahlenfeld je Wert (B7), Adresse (B9), Chips (B10), Kontakt (B12).
 * Beschriftung, Einheit und Optionen kommen aus dem Register, nie aus dem
 * Widget (Widget-Paare, Regel 1).
 */

const FIELD_LABEL = "mb-1 block text-xs font-medium text-muted-foreground"

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className={FIELD_LABEL}>
      {children}
    </label>
  ) : (
    <span className={FIELD_LABEL}>{children}</span>
  )
}

function FieldError({ id, text }: { id: string; text: string | null }) {
  if (!text) return null
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {text}
    </p>
  )
}

/** Symbol eines festen Felds (06, Regel 14). */
function FixedMark() {
  return <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="fest" />
}

// ---------------------------------------------------------------------------
// status (B6), select (B8)

export interface OptionFieldOption {
  id: string
  label: string
  /** Klassen des gewählten Segments (nur die alte StatusWidget-Schnittstelle). */
  className?: string
}

export interface OptionFieldProps {
  label: string
  options: readonly OptionFieldOption[]
  value: string
  onChange: (value: string) => void
  /** Ein zweiter Klick auf die gewählte Option nimmt sie zurück (optionale Felder). */
  allowClear?: boolean
  disabled?: boolean
}

/** Bis zu vier Optionen als Segment, sonst als Dropdown (Widget-Paare B6, B8). */
export const SEGMENT_MAX = 4

export function OptionField({ label, options, value, onChange, allowClear, disabled }: OptionFieldProps) {
  const id = React.useId()
  if (options.length > SEGMENT_MAX) {
    return (
      <div data-value-field="select">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <select
          id={id}
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
        >
          <option value="">Keine Angabe</option>
          {/* Ein Wert, den das Register nicht kennt, bleibt wählbar stehen. */}
          {value && !options.some((o) => o.id === value) && <option value={value}>{value}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const checkedIndex = options.findIndex((o) => o.id === value)
  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    onChange(options[next]!.id)
    // Der Fokus folgt der Wahl (Radiogruppe).
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => document.getElementById(`${id}-${next}`)?.focus())
  }
  return (
    <div data-value-field="segment">
      <FieldLabel>{label}</FieldLabel>
      <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-muted p-0.5">
        {options.map((option, index) => {
          const checked = index === checkedIndex
          return (
            <button
              key={option.id}
              id={`${id}-${index}`}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              tabIndex={checked || (checkedIndex === -1 && index === 0) ? 0 : -1}
              onClick={() => onChange(checked && allowClear ? "" : option.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault()
                  move(index, 1)
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault()
                  move(index, -1)
                }
              }}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
                checked
                  ? option.className || "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// number (B7)

export interface NumberInputSpec {
  key: string
  unit?: string
  min?: number
  max?: number
}

export interface NumberGroupFieldProps {
  label: string
  fields: readonly NumberInputSpec[]
  values: Readonly<Record<string, unknown>>
  errors: Readonly<Record<string, string | null>>
  onChange: (key: string, value: string) => void
  disabled?: boolean
}

/** Ein Zahlenfeld je Wert, nebeneinander, die Einheit im Feld (Widget-Paare B7). */
export function NumberGroupField({ label, fields, values, errors, onChange, disabled }: NumberGroupFieldProps) {
  const id = React.useId()
  return (
    <div data-value-field="number">
      <FieldLabel>
        <span className="inline-flex items-center gap-1">
          {label}
          {disabled && <FixedMark />}
        </span>
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {fields.map((field) => {
          const raw = values[field.key]
          const error = errors[field.key] ?? null
          const errorId = `${id}-${field.key}-error`
          return (
            <div key={field.key} className="min-w-[7rem] flex-1">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  aria-label={field.unit ? `${label} (${field.unit})` : label}
                  aria-invalid={!!error}
                  aria-describedby={error ? errorId : undefined}
                  disabled={disabled}
                  value={typeof raw === "string" || typeof raw === "number" ? String(raw) : ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className={cn("tabular-nums", field.unit && "pr-8")}
                />
                {field.unit && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                    {field.unit}
                  </span>
                )}
              </div>
              <FieldError id={errorId} text={error} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// url (B9), contact (B12)

interface TextValueFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error: string | null
  disabled?: boolean
}

function IconInput({
  kind,
  icon,
  label,
  value,
  onChange,
  error,
  disabled,
  hint,
  placeholder,
  inputMode,
}: TextValueFieldProps & { kind: string; icon: React.ReactNode; hint?: string; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  const id = React.useId()
  const described = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined
  return (
    <div data-value-field={kind}>
      <FieldLabel htmlFor={id}>
        <span className="inline-flex items-center gap-1">
          {label}
          {disabled && <FixedMark />}
        </span>
      </FieldLabel>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
          {icon}
        </span>
        <Input
          id={id}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={described}
          inputMode={inputMode}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <FieldError id={`${id}-error`} text={error} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Adresse mit Globus, geprüft: nur http und https (Widget-Paare B9). */
export function UrlField(props: TextValueFieldProps) {
  return <IconInput {...props} kind="url" icon={<Globe className="h-3.5 w-3.5" />} placeholder="gartenprojekt.org" inputMode="url" />
}

/** Telefon oder E-Mail mit Sichtbarkeits-Hinweis (Widget-Paare B12). */
export function ContactField({ visibility, ...props }: TextValueFieldProps & { visibility?: string }) {
  const Icon = contactKind(props.value) === "email" ? Mail : Phone
  return <IconInput {...props} kind="contact" icon={<Icon className="h-3.5 w-3.5" />} placeholder="Telefon oder E-Mail" hint={visibility} />
}

// ---------------------------------------------------------------------------
// chips (B10)

export interface ChipsFieldProps {
  label: string
  value: readonly string[]
  onChange: (value: string[]) => void
  /** Vorschläge; gewählte fallen heraus. */
  suggestions?: readonly string[]
  disabled?: boolean
}

const SUGGESTIONS_SHOWN = 8

/** Chips mit Vorschlägen und „+ eigenes" (Widget-Paare B10). */
export function ChipsField({ label, value, onChange, suggestions = [], disabled }: ChipsFieldProps) {
  const [adding, setAdding] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const add = (text: string) => {
    const t = text.trim()
    if (t && !value.includes(t)) onChange([...value, t])
  }
  const open = suggestions.filter((s) => !value.includes(s)).slice(0, SUGGESTIONS_SHOWN)
  const commit = () => {
    add(draft)
    setDraft("")
    setAdding(false)
  }
  return (
    <div data-value-field="chips">
      <FieldLabel>
        <span className="inline-flex items-center gap-1">
          {label}
          {disabled && <FixedMark />}
        </span>
      </FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((chip) => (
          <span key={chip} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">
            {chip}
            {!disabled && (
              <button
                type="button"
                aria-label={`${chip} entfernen`}
                onClick={() => onChange(value.filter((v) => v !== chip))}
                className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled &&
          open.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              + {s}
            </button>
          ))}
        {!disabled &&
          (adding ? (
            <input
              autoFocus
              aria-label={`${label}: eigenes`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  commit()
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  setDraft("")
                  setAdding(false)
                }
              }}
              onBlur={commit}
              className="h-6 min-w-[8rem] rounded-full border bg-card px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-solid hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              + eigenes
            </button>
          ))}
      </div>
    </div>
  )
}
