import { beforeEach, describe, expect, it } from "vitest"
import {
  canonicalItem,
  canonicalItemType,
  canonicalTypeValue,
  composeTypeManifest,
  filterForHint,
  getTypeManifest,
  itemTypes,
  matchesFilter,
  moduleHintsFor,
  normalizeItemType,
  registerModuleHint,
  setTypeManifest,
  TOOLKIT_TYPE_LAYER,
  typeSpellings,
  typesWithAffordance,
  VOCAB_STATEMENT,
  type Item,
} from "../src/index.js"

/**
 * Spec 06 „Klassen haben IRIs", Regeln 6–10 (rls#413), und Spec 01
 * „Der Ladevertrag" (rls#411). Schema-Tests prüfen diese Semantik nicht;
 * hier stehen die Abnahmefälle aus beiden Issues.
 */
const STATEMENT_IRI = `${VOCAB_STATEMENT}#Statement`
const item = (teil: Partial<Item>): Item =>
  ({ id: "x", type: "post", createdAt: "t", createdBy: "u", data: {}, ...teil }) as Item

beforeEach(() => setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER])))

describe("Klassen: Identität ist die IRI, kanonisch ist der Kurzname (Regel 6, 7)", () => {
  it("normalisiert eine bekannte volle IRI auf den Kurznamen", () => {
    expect(normalizeItemType(STATEMENT_IRI)).toEqual(["statement"])
  })
  it("lässt einen Kurznamen, wie er ist", () => {
    expect(normalizeItemType("event")).toEqual(["event"])
  })
  it("lässt eine fremde IRI unverändert stehen — weder verworfen noch umgedeutet", () => {
    const fremd = "https://example.org/vocab#Sighting"
    expect(normalizeItemType(fremd)).toEqual([fremd])
  })
  it("liefert für ein Item die Klassenmenge, doppelte Schreibweisen zusammengeführt", () => {
    expect(itemTypes(item({ type: ["statement", STATEMENT_IRI, "post"] }))).toEqual(["statement", "post"])
  })
  it("nennt die Klassen-IRI jedes Toolkit-Typs im Manifest", () => {
    expect(getTypeManifest().get("event")?.classIri).toBe("https://real-life-stack.org/vocab/event/v1#Event")
    expect(getTypeManifest().get("post")?.classIri).toBe("https://real-life-stack.org/vocab/base/v1#Post")
  })
})

describe("Filter: Mengen nach Normalisierung, nie Strings in Reihenfolge (Regel 8, Abnahmefall d)", () => {
  it("trifft Kurzname und volle IRI gleichermaßen", () => {
    expect(matchesFilter(item({ type: "statement" }), { type: "statement" })).toBe(true)
    expect(matchesFilter(item({ type: STATEMENT_IRI }), { type: "statement" })).toBe(true)
  })
  it("trifft ein Item mit mehreren Klassen, egal in welcher Reihenfolge", () => {
    expect(matchesFilter(item({ type: ["post", "statement"] }), { type: "statement" })).toBe(true)
    expect(matchesFilter(item({ type: ["statement", "post"] }), { type: "statement" })).toBe(true)
  })
  it("nimmt im Filter eine Liste als Oder", () => {
    expect(matchesFilter(item({ type: "event" }), { type: ["place", "event"] })).toBe(true)
    expect(matchesFilter(item({ type: "task" }), { type: ["place", "event"] })).toBe(false)
  })
})

describe("Aktivierung über die Affordanz der Klasse (Spec 06, Die Rolle von type)", () => {
  it("kennt die Klassen, deren Manifest votesOn deklariert", () => {
    expect(typesWithAffordance("votesOn", "to")).toEqual(["statement"])
  })
  it("aktiviert die Resonanz für eine Aussage ohne @context — die Klasse genügt (Abnahmefall a)", () => {
    expect(moduleHintsFor(item({ type: "statement" })).hasStatement).toBe(true)
    expect(moduleHintsFor(item({ type: STATEMENT_IRI })).hasStatement).toBe(true)
  })
  it("ändert nichts, wenn zwei Klassen vertauscht werden (Abnahmefall b)", () => {
    const a = moduleHintsFor(item({ type: ["post", "statement"] }))
    const b = moduleHintsFor(item({ type: ["statement", "post"] }))
    expect(a).toEqual(b)
    expect(a.hasStatement).toBe(true)
  })
  it("aktiviert nicht über einen Typ-Namen ohne Affordanz", () => {
    expect(moduleHintsFor(item({ type: "post", "@context": [VOCAB_STATEMENT] } as Partial<Item>)).hasStatement).toBe(false)
  })
})

describe("Der Ladevertrag: eine offene Tabelle Hinweis → Filter (Spec 01)", () => {
  it("leitet zu einem Feld-Hinweis den Präsenzfilter ab", () => {
    expect(filterForHint("position")).toEqual({ hasField: ["position"] })
    expect(filterForHint("start")).toEqual({ hasField: ["start"] })
  })
  it("nimmt für das Kanban das konfigurierte Feld (Abnahmefall: statusField)", () => {
    expect(filterForHint("status")).toEqual({ hasField: ["status"] })
    expect(filterForHint("status", { statusField: "kind" })).toEqual({ hasField: ["kind"] })
    expect(moduleHintsFor(item({ type: "resource", data: { kind: "open" } }), { statusField: "kind" }).hasStatus).toBe(true)
  })
  it("leitet zu einem Klassen-Hinweis den Klassenfilter aus dem Manifest ab", () => {
    expect(filterForHint("statement")).toEqual({ type: ["statement"] })
  })
  it("ist offen: ein Eintrag bringt seinen eigenen Hinweis mit beiden Richtungen", () => {
    registerModuleHint("sighting", {
      test: (it) => typeof it.data.seenAt === "string",
      filter: () => ({ hasField: ["seenAt"] }),
    })
    expect(filterForHint("sighting")).toEqual({ hasField: ["seenAt"] })
    expect(moduleHintsFor(item({ data: { seenAt: "2026-09-21" } })).sighting).toBe(true)
  })
  it("wirft bei einem unbekannten Hinweis, statt still nichts zu laden", () => {
    expect(() => filterForHint("unbekannt")).toThrow(/unbekannt/)
  })
})

describe("Eingangsgrenze und Schreibweisen (Regel 7, rls#416, rls#417)", () => {
  const POST_IRI = "https://real-life-stack.org/vocab/base/v1#Post"

  it("canonicalItem normalisiert eine bekannte IRI und laesst das Objekt sonst identisch", () => {
    const roh = item({ type: POST_IRI, data: { content: "Vorhandener Text" } })
    const kanonisch = canonicalItem(roh)
    expect(kanonisch.type).toBe("post")
    expect(kanonisch.data.content).toBe("Vorhandener Text")
    const schon = item({ type: "post" })
    expect(canonicalItem(schon)).toBe(schon)
  })

  it("canonicalItem laesst eine fremde IRI unveraendert (Regel 7, 10)", () => {
    const fremd = item({ type: "https://example.org/ns#Widget" })
    expect(canonicalItem(fremd)).toBe(fremd)
  })

  it("typeSpellings liefert Kurzname und IRI fuer bekannte Klassen, den Wert selbst fuer fremde", () => {
    expect(typeSpellings("post")).toEqual(["post", POST_IRI])
    expect(typeSpellings(POST_IRI)).toEqual(["post", POST_IRI])
    expect(typeSpellings(["post", "statement"])).toEqual(["post", POST_IRI, "statement", STATEMENT_IRI])
    expect(typeSpellings("https://example.org/ns#Widget")).toEqual(["https://example.org/ns#Widget"])
    expect(typeSpellings([])).toEqual([])
  })

  it("matchesFilter: eine leere Typliste ist ein Oder von nichts und trifft nichts", () => {
    expect(matchesFilter(item({ type: "post" }), { type: [] })).toBe(false)
    expect(matchesFilter(item({ type: "post" }), { type: ["post", "event"] })).toBe(true)
    expect(matchesFilter(item({ type: POST_IRI }), { type: "post" })).toBe(true)
  })
})

describe("Klassenmengen ueberleben die Eingangsgrenze (Regel 7 und 8, Codex zu rls#417)", () => {
  const POST_IRI = "https://real-life-stack.org/vocab/base/v1#Post"
  const FREMD = "https://example.org/ns#Widget"
  // JSON-LD erlaubt eine Menge in `@type`; der TypeScript-Typ sagt `string`,
  // die Daten nicht — der Test geht am Typ vorbei, wie die Daten es tun.
  const mehrklassig = item({ type: [POST_IRI, "statement", FREMD] as unknown as string })

  it("canonicalItem behaelt alle Klassen, normalisiert die bekannten, laesst die fremde", () => {
    expect(canonicalItem(mehrklassig).type).toEqual(["post", "statement", FREMD])
  })

  it("canonicalTypeValue erhaelt die Form: String bleibt String, Menge bleibt Menge", () => {
    expect(canonicalTypeValue(POST_IRI)).toBe("post")
    expect(canonicalTypeValue([POST_IRI])).toEqual(["post"])
  })

  it("das Item trifft danach noch den Resonanz-Filter und den Post-Filter", () => {
    const k = canonicalItem(mehrklassig)
    expect(matchesFilter(k, filterForHint("statement"))).toBe(true)
    expect(matchesFilter(k, { type: "post" })).toBe(true)
    expect(moduleHintsFor(k).hasStatement).toBe(true)
  })

  it("canonicalItemType nennt die erste Klasse — nur fuer die Vorlagenwahl (Regel 9)", () => {
    expect(canonicalItemType([POST_IRI, "statement"])).toBe("post")
  })
})
