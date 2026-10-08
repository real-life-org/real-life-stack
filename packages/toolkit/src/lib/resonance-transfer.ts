import type { Item, RelationRecord } from "@real-life/data-interface"
import { itemContentHash, votesFromRelationRecords } from "@real-life/data-interface"
import { variantOfId } from "./resonance-variants"
import type { ResonancePopulation } from "./resonance-sort"

/**
 * Import und Export des Resonanzmoduls (docs/spec/modules/resonance.md →
 * Import, Export). Reine Funktionen: Sie rechnen, geschrieben wird im Modul
 * über den normalen Schreibweg.
 */

export const IMPORT_FORMAT = "resonance-import/1"
export const EXPORT_FORMAT = "resonance-export/1"

/** Ein Eintrag der Importdatei. `title` ist Pflicht. */
export interface ImportEntry {
  title: string
  description?: string
  tags?: string[]
  variantOf?: string
}

export interface ImportError {
  /** Position in `statements` (0-basiert); -1 für die Datei als Ganzes. */
  index: number
  message: string
}

export interface ImportPlan {
  /** Was angelegt wird, in Dateireihenfolge. */
  create: ImportEntry[]
  /** Schon vorhanden (dieselbe Person, derselbe Inhalts-Hash) oder doppelt in der Datei. */
  skipped: ImportEntry[]
  /** Nicht leer → es wird nichts geschrieben (Import-Regel 1). */
  errors: ImportError[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Der Inhalt, den ein Eintrag als Statement hätte (Spec 08, Katalog). */
function entryData(entry: ImportEntry): Record<string, unknown> {
  return {
    title: entry.title,
    ...(entry.description !== undefined ? { description: entry.description } : {}),
    ...(entry.variantOf !== undefined ? { variantOf: entry.variantOf } : {}),
  }
}

/** Die `data` eines neuen Statements aus einem Importeintrag. */
export function importItemData(entry: ImportEntry): Record<string, unknown> {
  return entryData(entry)
}

function validateEntry(raw: unknown, index: number, statementIds: ReadonlySet<string>): ImportEntry | ImportError {
  if (!isRecord(raw)) return { index, message: "ist kein Objekt" }
  const { title, description, tags, variantOf } = raw
  if (typeof title !== "string" || title.trim().length === 0) return { index, message: "„title“ fehlt oder ist leer" }
  if (description !== undefined && typeof description !== "string") return { index, message: "„description“ ist kein Text" }
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))) {
    return { index, message: "„tags“ ist keine Liste von Texten" }
  }
  if (variantOf !== undefined) {
    if (typeof variantOf !== "string" || !variantOf.startsWith("item:")) {
      return { index, message: "„variantOf“ muss die Form item:<id> haben" }
    }
    // Varianten-Regel 2: das Ziel ist ein Statement im selben Space.
    const target = variantOfId({ data: { variantOf } } as unknown as Item)
    if (target === null || !statementIds.has(target)) {
      return { index, message: `„variantOf“ zeigt auf keine Aussage in diesem Space (${variantOf})` }
    }
  }
  return {
    title,
    ...(description !== undefined ? { description } : {}),
    ...(tags !== undefined ? { tags: tags as string[] } : {}),
    ...(variantOf !== undefined ? { variantOf } : {}),
  }
}

/**
 * Prüft die ganze Datei, bevor irgendetwas geschrieben wird (Import-Regel 1),
 * und plant idempotent über den Inhalt (Regel 3): Ein Eintrag wird
 * übersprungen, wenn es im Space schon ein Statement derselben Person mit
 * demselben Inhalts-Hash gibt, oder wenn er in der Datei doppelt steht.
 * Tags gehören nicht zum Inhalt.
 */
export async function planImport(
  raw: unknown,
  context: { userId: string; statements: readonly Item[] },
): Promise<ImportPlan> {
  if (!isRecord(raw)) return { create: [], skipped: [], errors: [{ index: -1, message: "Die Datei enthält kein JSON-Objekt." }] }
  if (raw.format !== IMPORT_FORMAT) {
    return { create: [], skipped: [], errors: [{ index: -1, message: `Unbekanntes Format — erwartet „${IMPORT_FORMAT}“.` }] }
  }
  if (!Array.isArray(raw.statements) || raw.statements.length === 0) {
    return { create: [], skipped: [], errors: [{ index: -1, message: "„statements“ fehlt oder ist leer." }] }
  }

  const statementIds = new Set(context.statements.map((item) => item.id))
  const entries: ImportEntry[] = []
  const errors: ImportError[] = []
  raw.statements.forEach((candidate, index) => {
    const result = validateEntry(candidate, index, statementIds)
    if ("message" in result) errors.push(result)
    else entries.push(result)
  })
  if (errors.length > 0) return { create: [], skipped: [], errors }

  const known = new Set<string>()
  for (const item of context.statements) {
    if (item.createdBy !== context.userId) continue
    const hash = await itemContentHash(item)
    if (hash !== null) known.add(hash)
  }
  const create: ImportEntry[] = []
  const skipped: ImportEntry[] = []
  for (const entry of entries) {
    const hash = await itemContentHash({ type: "statement", data: entryData(entry) })
    if (hash === null || known.has(hash)) {
      skipped.push(entry)
      continue
    }
    known.add(hash)
    create.push(entry)
  }
  return { create, skipped, errors: [] }
}

export interface ExportVote {
  voter: string
  value: string
  contentHash: string
  createdAt: string
  claim?: string
}

export interface ExportStatement {
  id: string
  title: string
  description?: string
  variantOf?: string
  tags: string[]
  createdBy: string
  createdAt: string
  contentHash: string | null
  claim?: string
  votes: ExportVote[]
  summary: { green: number; yellow: number; red: number; noVote: number | null }
}

export interface ResonanceExport {
  format: typeof EXPORT_FORMAT
  exportedAt: string
  space: string | null
  filter: { people: string[] | null; tags: string[] }
  statements: ExportStatement[]
}

/**
 * Die Auswertung als JSON (Export-Regeln 1 und 2): die gezeigten Aussagen,
 * je Aussage nur die Stimmen, die zählen — für den aktuellen Wortlaut einer
 * belegten Aussage (`contentHashes`, Vote-Regel 5) und aus der gewählten
 * Personenmenge —, mit den Claims, damit sich alles außerhalb des Space
 * prüfen lässt.
 */
export async function buildExport(context: {
  space: string | null
  exportedAt: string
  statements: readonly Item[]
  verifiedRecords: readonly RelationRecord[]
  contentHashes: ReadonlyMap<string, string>
  population: ResonancePopulation
  tags: readonly string[]
}): Promise<ResonanceExport> {
  const claims = new Map(context.verifiedRecords.map((record) => [record.id, record.claim]))
  const votesByStatement = new Map<string, ExportVote[]>()
  for (const vote of votesFromRelationRecords([...context.verifiedRecords])) {
    const current = context.contentHashes.get(vote.statementId)
    if (current === undefined || vote.contentHash !== current) continue
    if (context.population.people !== null && !context.population.people.has(vote.voterId)) continue
    const list = votesByStatement.get(vote.statementId) ?? []
    const claim = claims.get(vote.recordId)
    list.push({ voter: vote.voterId, value: vote.value, contentHash: current, createdAt: vote.createdAt, ...(claim ? { claim } : {}) })
    votesByStatement.set(vote.statementId, list)
  }

  const statements: ExportStatement[] = []
  for (const item of context.statements) {
    const votes = (votesByStatement.get(item.id) ?? []).sort((a, b) => a.voter.localeCompare(b.voter))
    const count = (value: string) => votes.filter((vote) => vote.value === value).length
    const claim = typeof item.data.claim === "string" ? item.data.claim : undefined
    statements.push({
      id: item.id,
      title: typeof item.data.title === "string" ? item.data.title : "",
      ...(typeof item.data.description === "string" ? { description: item.data.description } : {}),
      ...(typeof item.data.variantOf === "string" ? { variantOf: item.data.variantOf } : {}),
      tags: [...(item.tags ?? [])],
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      contentHash: context.contentHashes.get(item.id) ?? (await itemContentHash(item)),
      ...(claim ? { claim } : {}),
      votes,
      summary: {
        green: count("green"),
        yellow: count("yellow"),
        red: count("red"),
        noVote: context.population.size === null ? null : Math.max(0, context.population.size - votes.length),
      },
    })
  }

  return {
    format: EXPORT_FORMAT,
    exportedAt: context.exportedAt,
    space: context.space,
    filter: {
      people: context.population.people === null ? null : [...context.population.people].sort(),
      tags: [...context.tags],
    },
    statements,
  }
}
