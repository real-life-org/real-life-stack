import { describe, expect, it } from "vitest"
import { resolveAdaptivePanelMode } from "../src/components/layout/adaptive-panel"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Welche Darstellung ein Panel waehlt, haengt an zwei Dingen: was die Anwendung
// erlaubt und ob der Schirm schmal ist. Auf schmalen Schirmen gewinnt immer der
// Drawer - eine 360px breite Karte neben 375px Viewport waere kein Panel mehr,
// sondern eine Wand.
describe("Darstellung eines AdaptivePanels", () => {
  it("waehlt auf breiten Schirmen die schwebende Karte, wenn sie erlaubt ist", () => {
    expect(resolveAdaptivePanelMode(["floating", "drawer"], false)).toBe("floating")
  })

  it("waehlt auf schmalen Schirmen den Drawer, auch wenn floating erlaubt ist", () => {
    expect(resolveAdaptivePanelMode(["floating", "drawer"], true)).toBe("drawer")
  })

  // Bestandsverhalten: wer floating nicht erlaubt, bekommt weiter die Sidebar.
  it("laesst bestehende Anwendungen bei der Sidebar", () => {
    expect(resolveAdaptivePanelMode(["sidebar", "modal", "drawer"], false)).toBe("sidebar")
    expect(resolveAdaptivePanelMode(["sidebar", "modal", "drawer"], true)).toBe("drawer")
  })

  // Sind beide erlaubt, gewinnt die schwebende Karte - sie ist die neue Form.
  it("zieht die schwebende Karte der Sidebar vor, wenn beide erlaubt sind", () => {
    expect(resolveAdaptivePanelMode(["sidebar", "floating"], false)).toBe("floating")
  })

  it("faellt auf modal zurueck, wenn weder floating noch sidebar erlaubt sind", () => {
    expect(resolveAdaptivePanelMode(["modal"], false)).toBe("modal")
  })

  it("nimmt den ersten erlaubten Modus, wenn nichts Bevorzugtes dabei ist", () => {
    expect(resolveAdaptivePanelMode(["drawer"], false)).toBe("drawer")
  })
})

/**
 * Die Breite der schwebenden Karte stand einmal an zwei Stellen: als Konstante
 * und als Tailwind-Klasse `w-[360px]`. Wer nur die Konstante aendert, bekommt
 * ein Panel, das anders breit ist als der Platz, den es sich nimmt — und die
 * Bedienelemente daneben stehen falsch.
 */
describe("Breite der schwebenden Karte", () => {
  const quelle = readFileSync(
    join(__dirname, "../src/components/layout/adaptive-panel.tsx"),
    "utf8",
  )

  it("steht nur in der Konstante, nicht zusaetzlich als Klasse", () => {
    const breite = quelle.match(/const FLOATING_WIDTH = (\d+)/)?.[1]
    expect(breite).toBeDefined()
    // Nur diese eine Zahl darf nicht doppelt stehen; schmale Hilfsmasse wie
    // der 2px-Ziehgriff sind kein Widerspruch.
    expect(quelle).not.toContain(`w-[${breite}px]`)
  })

  it("nimmt sich diese Breite plus die Luft links und rechts", () => {
    expect(quelle).toContain("const FLOATING_INSET = FLOATING_WIDTH + FLOATING_GAP * 2")
    expect(quelle).toContain("FLOATING_WIDTH + FLOATING_GAP")
  })
})
