import { describe, expect, it } from "vitest"
import { resolveAdaptivePanelMode } from "../src/components/layout/adaptive-panel"

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
