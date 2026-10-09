import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { formatTimeRange as formatTimeRangeImpl } from "../src/components/preview/item-time-range"
import { formatEventRange as formatEventRangeImpl } from "../src/components/preview/item-meta-row"
import { getI18n, resetI18nForTests, setLanguage } from "../src/i18n"

// Diese Erwartungen sind deutsche Literale — die Sprache wird deshalb
// FESTGENAGELT statt vom System geerbt. Vorher liefen die Tests nur auf
// deutschen Maschinen grün: CI-Node meldet navigator.language "en-US",
// und die Suite bekam "All day"/"Jul 24" (Blocker aus dem Review von #288).
beforeEach(() => setLanguage("de"))
afterEach(() => resetI18nForTests())

const formatTimeRange = (start: string, end?: string) => formatTimeRangeImpl(getI18n(), start, end)
const formatEventRange = (start: string, end?: string) => formatEventRangeImpl(getI18n(), start, end)

describe("formatTimeRange", () => {
  it("shows a single all-day event as Ganztägig", () => {
    expect(formatTimeRange("2026-07-20")).toBe("Ganztägig")
    expect(formatTimeRange("2026-07-20", "2026-07-20")).toBe("Ganztägig")
  })

  it("names the end date of a multi-day all-day event", () => {
    // The regression: this returned a bare "Ganztägig", so a five-day festival
    // was indistinguishable from a one-day event.
    expect(formatTimeRange("2026-07-20", "2026-07-24")).toBe("Ganztägig, bis 24. Juli")
  })

  it("keeps same-day timed ranges as a time range", () => {
    expect(formatTimeRange("2026-07-20T18:00", "2026-07-20T20:00")).toBe("18:00 – 20:00")
  })

  it("shows only the start when there is no end", () => {
    expect(formatTimeRange("2026-07-20T18:00")).toBe("18:00")
  })

  it("names the end date of a multi-day timed event", () => {
    expect(formatTimeRange("2026-07-20T18:00", "2026-07-24T12:00")).toBe("18:00 – 24. Juli, 12:00")
    expect(formatTimeRange("2026-07-20T18:00", "2026-07-24")).toBe("18:00 – 24. Juli")
  })

  it("falls back to the start for an unparseable end", () => {
    expect(formatTimeRange("2026-07-20T18:00", "nonsense")).toBe("18:00")
    expect(formatTimeRange("2026-07-20", "nonsense")).toBe("Ganztägig")
  })
})

describe("formatEventRange", () => {
  it("spells out a multi-day all-day range with both dates", () => {
    expect(formatEventRange("2026-07-20", "2026-07-24")).toBe("20. Juli – 24. Juli")
  })

  it("keeps a single all-day event to its date", () => {
    expect(formatEventRange("2026-07-20")).toBe("20. Juli")
  })
})

/**
 * rls#291: Beide Helfer waren schon vor der i18n-Laufzeit öffentlich
 * exportiert — `formatEventRange(start, end?)` / `formatTimeRange(start, end?)`.
 * Die neue Form nimmt das `I18n`-Bündel zuerst; die alte bleibt als
 * (deprecated) Überladung erhalten und liest die aktive Sprache über
 * `getI18n()`. Externe Apps auf Toolkit 0.4.x brechen damit nicht.
 */
describe("öffentliche Signaturen bleiben kompatibel (rls#291)", () => {
  it("formatTimeRange: alte Form ohne Bündel liefert dasselbe wie die neue", () => {
    expect(formatTimeRangeImpl("2026-07-20")).toBe("Ganztägig")
    expect(formatTimeRangeImpl("2026-07-20T18:00", "2026-07-20T20:00")).toBe("18:00 – 20:00")
    expect(formatTimeRangeImpl("2026-07-20", "2026-07-24")).toBe(
      formatTimeRangeImpl(getI18n(), "2026-07-20", "2026-07-24"),
    )
  })

  it("formatEventRange: alte Form ohne Bündel liefert dasselbe wie die neue", () => {
    expect(formatEventRangeImpl("2026-07-20")).toBe("20. Juli")
    expect(formatEventRangeImpl("2026-07-20", "2026-07-24")).toBe("20. Juli – 24. Juli")
    expect(formatEventRangeImpl("2026-07-20T18:00", "2026-07-20T20:00")).toBe(
      formatEventRangeImpl(getI18n(), "2026-07-20T18:00", "2026-07-20T20:00"),
    )
  })

  it("die alte Form folgt der aktiven Sprache", () => {
    setLanguage("en")
    expect(formatTimeRangeImpl("2026-07-20")).toBe("All day")
    expect(formatEventRangeImpl("2026-07-20T18:00", "2026-07-20")).toBe(
      formatEventRangeImpl(getI18n(), "2026-07-20T18:00", "2026-07-20"),
    )
  })

  it("die neue Form folgt dem übergebenen Bündel, nicht der globalen Sprache", () => {
    const de = getI18n()
    setLanguage("en")
    // Ein an „de" gebundenes Bündel bleibt deutsch, auch nach dem Wechsel —
    // genau das macht es als React-Snapshot konsistent (rls#290).
    expect(formatTimeRangeImpl(de, "2026-07-20")).toBe("Ganztägig")
    expect(formatTimeRangeImpl(getI18n(), "2026-07-20")).toBe("All day")
  })

  it("ein unlesbarer Start kommt in beiden Formen unverändert zurück", () => {
    expect(formatTimeRangeImpl("nonsense")).toBe("nonsense")
    expect(formatEventRangeImpl(getI18n(), "nonsense")).toBe("nonsense")
  })
})
