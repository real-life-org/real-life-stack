import { describe, expect, it } from "vitest"

import {
  dateWidgetPatch,
  dateWidgetToggles,
  dateWidgetValue,
  NO_DATE_TOGGLES,
  toDateInputValue,
  type DateWidgetToggles,
} from "../src/components/composer/date-widget-state"
import type { WidgetData } from "../src/components/composer/content-composer"

/**
 * Replays one widget interaction the way the composer wires it: render the
 * value, hand the widget's change back, and return the next data + toggles.
 */
function interact(
  data: WidgetData,
  toggles: DateWidgetToggles,
  act: (value: ReturnType<typeof dateWidgetValue>) => ReturnType<typeof dateWidgetValue>,
) {
  const next = act(dateWidgetValue(data, toggles))
  return {
    data: { ...data, ...dateWidgetPatch(next) },
    toggles: dateWidgetToggles(next),
  }
}

describe("date widget state", () => {
  it("keeps the end field open after it was toggled on but before a date is picked", () => {
    // The regression: opening "Enddatum" writes no data, so a purely
    // data-derived `showEnd` closed the field again on the very next render.
    const opened = interact({ start: "2026-07-20" }, NO_DATE_TOGGLES, (value) => ({
      ...value,
      showEnd: true,
    }))

    expect(opened.data.end).toBeUndefined()
    expect(dateWidgetValue(opened.data, opened.toggles).showEnd).toBe(true)
  })

  it("accepts an end date entered into the opened field", () => {
    const opened = interact({ start: "2026-07-20" }, NO_DATE_TOGGLES, (value) => ({
      ...value,
      showEnd: true,
    }))
    const filled = interact(opened.data, opened.toggles, (value) => ({
      ...value,
      end: "2026-07-24",
    }))

    expect(filled.data).toMatchObject({ start: "2026-07-20", end: "2026-07-24" })
    expect(dateWidgetValue(filled.data, filled.toggles).showEnd).toBe(true)
  })

  it("closes the end field and clears the value when toggled off", () => {
    const closed = interact(
      { start: "2026-07-20", end: "2026-07-24" },
      { ...NO_DATE_TOGGLES, end: true },
      (value) => ({ ...value, showEnd: false, end: undefined }),
    )

    expect(closed.data.end).toBeUndefined()
    expect(dateWidgetValue(closed.data, closed.toggles).showEnd).toBe(false)
  })

  it("shows the end field for an item that already has an end date, without a click", () => {
    const value = dateWidgetValue({ start: "2026-07-20", end: "2026-07-24" }, NO_DATE_TOGGLES)
    expect(value.showEnd).toBe(true)
  })

  it("keeps the time field open when time is enabled before a start is picked", () => {
    // Same failure mode as the end date: `showTime` was derived from
    // `data.start.includes("T")`, which is false while start is still empty.
    const opened = interact({}, NO_DATE_TOGGLES, (value) => ({
      ...value,
      showTime: true,
      start: "",
    }))

    expect(dateWidgetValue(opened.data, opened.toggles).showTime).toBe(true)
  })

  it("shows the time field for a start that carries a clock time", () => {
    expect(dateWidgetValue({ start: "2026-07-20T18:00" }, NO_DATE_TOGGLES).showTime).toBe(true)
  })

  it("never writes the recurrence picker's 'none' sentinel into the item data", () => {
    const opened = interact({ start: "2026-07-20" }, NO_DATE_TOGGLES, (value) => ({
      ...value,
      showRecurrence: true,
      rrule: "none",
    }))

    expect(opened.data.rrule).toBeUndefined()
    expect(dateWidgetValue(opened.data, opened.toggles).showRecurrence).toBe(true)
  })

  it("keeps a real recurrence rule", () => {
    const patch = dateWidgetPatch({ start: "2026-07-20", rrule: "FREQ=WEEKLY" })
    expect(patch.rrule).toBe("FREQ=WEEKLY")
  })

  it("coerces cleared inputs to undefined instead of empty strings", () => {
    expect(dateWidgetPatch({ start: "", end: "" })).toEqual({
      start: undefined,
      end: undefined,
      rrule: undefined,
    })
  })
})

/**
 * Spec 06 allows `start`/`end` as any ISO-8601 DateTime or Date. The input can
 * only show `YYYY-MM-DDTHH:mm` in local time; a value with a zone from another
 * client therefore has to be converted, or the field shows up empty in edit.
 */
describe("ISO values in the date input", () => {
  const pad2 = (n: number) => String(n).padStart(2, "0")
  const local = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }

  it("converts a zoned datetime to the local input form", () => {
    expect(toDateInputValue("2026-09-19T14:00:00+02:00")).toBe(local("2026-09-19T14:00:00+02:00"))
    expect(toDateInputValue("2026-09-19T12:00:00Z")).toBe(local("2026-09-19T12:00:00Z"))
  })

  it("passes a date-only value and a local input value through unchanged", () => {
    expect(toDateInputValue("2026-09-19")).toBe("2026-09-19")
    expect(toDateInputValue("2026-09-19T14:00")).toBe("2026-09-19T14:00")
    expect(toDateInputValue(undefined)).toBeUndefined()
  })

  it("shows a zoned start and end in the widget", () => {
    const value = dateWidgetValue(
      { start: "2026-09-19T14:00:00+02:00", end: "2026-09-19T18:00:00+02:00" },
      NO_DATE_TOGGLES,
    )
    expect(value.start).toBe(local("2026-09-19T14:00:00+02:00"))
    expect(value.end).toBe(local("2026-09-19T18:00:00+02:00"))
    expect(value.showTime).toBe(true)
    expect(value.showEnd).toBe(true)
  })
})
