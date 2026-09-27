import { describe, expect, it } from "vitest"
import { ATTENDS_PREDICATE, attendsTense, selfStatementFields } from "../src/index.js"

// 08 → Teilnahme am Event, Regel 2: `fields.tense` trägt die Zeitform wie in
// der Netzwerk-App (coming · currently · has-been).

const event = (data: Record<string, unknown>) => ({ data })

describe("attendsTense", () => {
  const now = new Date("2026-09-27T12:00:00.000Z")
  it("coming vor dem Beginn, currently zwischen Beginn und Ende, has-been danach", () => {
    expect(attendsTense(event({ start: "2026-09-28T10:00:00.000Z" }), now)).toBe("coming")
    expect(attendsTense(event({ start: "2026-09-27T11:00:00.000Z", end: "2026-09-27T13:00:00.000Z" }), now)).toBe("currently")
    expect(attendsTense(event({ start: "2026-09-26T11:00:00.000Z", end: "2026-09-26T13:00:00.000Z" }), now)).toBe("has-been")
  })
  it("ohne Ende gilt der Beginn als vergangen, sobald er vorbei ist; ohne Datum coming", () => {
    expect(attendsTense(event({ start: "2026-09-27T11:00:00.000Z" }), now)).toBe("has-been")
    expect(attendsTense(event({}), now)).toBe("coming")
  })
})

describe("selfStatementFields", () => {
  it("attends trägt role und tense, andere Prädikate nur den Qualifier", () => {
    const now = new Date("2026-09-27T12:00:00.000Z")
    expect(ATTENDS_PREDICATE).toBe("attends")
    expect(selfStatementFields("attends", "role", "going", event({ start: "2026-10-01T10:00:00.000Z" }), now)).toEqual({ role: "going", tense: "coming" })
    expect(selfStatementFields("confirms", "role", "yes", event({}), now)).toEqual({ role: "yes" })
  })
})
