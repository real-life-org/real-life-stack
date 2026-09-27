import { readdirSync, readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { itemContentHash } from "@real-life-stack/data-interface"
import { buildExport, planImport } from "../src/lib/resonance-transfer"

/**
 * The JSON Schemas of the Resonance file formats (docs/spec/schemas/formats,
 * resonance.md → Import, Export) against their examples and against the
 * implementation: the import schema judges every example file as planImport
 * does, and whatever buildExport writes passes the export schema.
 */

const FORMATS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "spec", "schemas", "formats")

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)

function load(format: string) {
  const dir = join(FORMATS, format, "v1")
  const validate = ajv.compile(JSON.parse(readFileSync(join(dir, "schema.json"), "utf8")))
  const examples = (kind: "valid" | "invalid") =>
    readdirSync(join(dir, "examples", kind))
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({ name, data: JSON.parse(readFileSync(join(dir, "examples", kind, name), "utf8")) as unknown }))
  return { validate, valid: examples("valid"), invalid: examples("invalid") }
}

const importFormat = load("resonance-import")
const exportFormat = load("resonance-export")

const ME = "did:key:me"
const OTHER = "did:key:other"
const statement = (id: string, createdBy: string, data: Record<string, unknown>, tags?: string[]): Item =>
  ({ id, type: "statement", createdBy, createdAt: "2026-09-27T10:00:00.000Z", data, ...(tags ? { tags } : {}) })

describe("resonance-import/1 schema", () => {
  it("has examples of both kinds", () => {
    expect(importFormat.valid.length).toBeGreaterThan(0)
    expect(importFormat.invalid.length).toBeGreaterThan(0)
  })

  it.each(importFormat.valid)("accepts valid/$name", ({ data }) => {
    expect(importFormat.validate(data), JSON.stringify(importFormat.validate.errors)).toBe(true)
  })

  it.each(importFormat.invalid)("rejects invalid/$name", ({ data }) => {
    expect(importFormat.validate(data)).toBe(false)
  })

  // The target space holds every statement the examples name as variantOf:
  // that check needs the space and is the importer's, not the schema's.
  const space = [statement("s-1", OTHER, { title: "Wir öffnen den Garten einmal im Monat." })]

  it.each([...importFormat.valid, ...importFormat.invalid])("judges $name as planImport does", async ({ data }) => {
    const plan = await planImport(data, { userId: ME, statements: space })
    expect(importFormat.validate(data)).toBe(plan.errors.length === 0)
  })
})

describe("resonance-export/1 schema", () => {
  it("has examples of both kinds", () => {
    expect(exportFormat.valid.length).toBeGreaterThan(0)
    expect(exportFormat.invalid.length).toBeGreaterThan(0)
  })

  it.each(exportFormat.valid)("accepts valid/$name", ({ data }) => {
    expect(exportFormat.validate(data), JSON.stringify(exportFormat.validate.errors)).toBe(true)
  })

  it.each(exportFormat.invalid)("rejects invalid/$name", ({ data }) => {
    expect(exportFormat.validate(data)).toBe(false)
  })

  it("accepts what buildExport writes for a space with a person set", async () => {
    const origin = statement("s-1", ME, { title: "Wir treffen uns montags", description: "Im Garten", claim: "stmt.claim" }, ["garten"])
    const variant = statement("s-2", OTHER, { title: "Wir treffen uns dienstags", variantOf: "item:s-1" })
    const hash = (await itemContentHash(origin))!
    const vote = (id: string, voter: string, value: string, claim?: string): RelationRecord => ({
      id, predicate: "votesOn", from: `global:${voter}`, to: "item:s-1", createdBy: voter, createdAt: "2026-09-27T11:00:00.000Z",
      fields: { value, contentHash: hash }, ...(claim ? { claim } : {}),
    })
    const result = await buildExport({
      space: "g",
      exportedAt: "2026-09-27T12:00:00.000Z",
      statements: [origin, variant],
      verifiedRecords: [vote("v-a", ME, "green", "vote.claim"), vote("v-b", OTHER, "yellow")],
      contentHashes: new Map([["s-1", hash]]),
      population: { people: new Set([ME, OTHER, "did:key:third"]), size: 3 },
      tags: ["garten"],
    })
    expect(exportFormat.validate(result), JSON.stringify(exportFormat.validate.errors)).toBe(true)
  })

  it("accepts what buildExport writes from the overview (no space, no person set)", async () => {
    const result = await buildExport({
      space: null,
      exportedAt: "2026-09-27T12:00:00.000Z",
      statements: [statement("s-1", ME, { title: "A" })],
      verifiedRecords: [],
      contentHashes: new Map(),
      population: { people: null, size: null },
      tags: [],
    })
    expect(exportFormat.validate(result), JSON.stringify(exportFormat.validate.errors)).toBe(true)
  })
})
