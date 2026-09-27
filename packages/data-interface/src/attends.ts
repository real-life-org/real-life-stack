// Teilnahme am Event: `attends`.
//
// Spec: docs/spec/08-relation-records.md → „Teilnahme am Event: attends und
// invited". Die Zusage ist ein Record von der Person (`from`) zum Event
// (`to`), Zählregel `one-per-subject`, Claim-Profil `authorial`. Der
// Qualifier liegt in `fields.role`, die Zeitform in `fields.tense` — wie in
// der Netzwerk-App.

export const ATTENDS_PREDICATE = "attends"

export type AttendsTense = "coming" | "currently" | "has-been"

function time(value: unknown): number | undefined {
  if (typeof value !== "string" || value === "") return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Die Zeitform einer Zusage zum Zeitpunkt, an dem sie geschrieben wird:
 * `coming` vor dem Beginn (oder ohne Datum), `currently` zwischen Beginn und
 * Ende, `has-been` danach. Ohne Ende ist das Event mit seinem Beginn vorbei.
 */
export function attendsTense(event: { data?: Record<string, unknown> }, now: Date = new Date()): AttendsTense {
  const start = time(event.data?.start)
  if (start === undefined) return "coming"
  const at = now.getTime()
  if (at < start) return "coming"
  const end = time(event.data?.end)
  if (end !== undefined && at <= end) return "currently"
  return "has-been"
}

/**
 * Die Felder einer Selbstaussage über eine Record-Kante: der Qualifier unter
 * seinem Schlüssel, und was das Prädikat dazu verlangt (bei `attends` die
 * Zeitform, 08 → Teilnahme am Event, Regel 2).
 */
export function selfStatementFields(
  predicate: string,
  qualifierKey: string,
  value: string,
  target: { data?: Record<string, unknown> },
  now: Date = new Date(),
): Record<string, unknown> {
  const fields: Record<string, unknown> = { [qualifierKey]: value }
  if (predicate === ATTENDS_PREDICATE) fields.tense = attendsTense(target, now)
  return fields
}
