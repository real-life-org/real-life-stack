// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { formatBuild } from "../src/lib/build-info"
import { BuildLine } from "../src/components/layout/user-menu"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("Build-Zeile: welcher Stand laeuft", () => {
  it("formatiert nur, was gesetzt ist, und kuerzt den Commit", () => {
    expect(formatBuild({ version: "0.4.0", commit: "a1b2c3d4e5f6", channel: "android-foss" })).toBe("0.4.0 · a1b2c3d · android-foss")
    expect(formatBuild({ commit: "a1b2c3d" })).toBe("a1b2c3d")
    expect(formatBuild(undefined)).toBe("")
    expect(formatBuild({})).toBe("")
  })

  it("rendert nichts ohne Angaben und kopiert den Text auf Tipp", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host)
    await act(async () => { root.render(createElement(BuildLine, { build: {} })) })
    expect(host.querySelector("[data-testid=build-line]")).toBeNull()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    await act(async () => { root.render(createElement(BuildLine, { build: { version: "0.4.0", commit: "a1b2c3d" } })) })
    const line = host.querySelector<HTMLButtonElement>("[data-testid=build-line]")!
    expect(line.textContent).toBe("0.4.0 · a1b2c3d")
    await act(async () => { line.click() })
    expect(writeText).toHaveBeenCalledWith("0.4.0 · a1b2c3d")
    expect(line.textContent).toBe("kopiert")
    act(() => root.unmount()); host.remove(); vi.unstubAllGlobals()
  })
})
