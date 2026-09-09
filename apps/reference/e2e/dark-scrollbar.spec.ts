import { expect, test } from "@playwright/test"

/**
 * Scrollleisten, Auswahlfelder und Datumswähler malt der Browser selbst —
 * unsere Tokens erreichen sie nicht. Ob die Angaben dafür ankommen, lässt sich
 * nur im echten Browser feststellen: Ein Test über die CSS-Datei sieht die
 * Deklaration, nicht das Ergebnis.
 *
 * Genau dort lag der Fehler: `scrollbar-color` vererbt sich, `scrollbar-width`
 * nicht. Auf der Wurzel gesetzt wechselte nur die Farbe, während der
 * eigentliche Scrollbereich weiter auf `auto` stand — die Leiste blieb 15px
 * breit. Ein Deklarations-Test hätte das durchgewunken.
 */
test.describe("Der Browser malt seine eigenen Flächen mit", () => {
  test("folgt im dunklen Modus dem dunklen Schema, mit schmaler Leiste ohne Spur", async ({ page }) => {
    await page.goto("/group-1/feed?connector=local")
    await page.evaluate(() => localStorage.setItem("rls-theme", "dark"))
    await page.reload()
    await expect(page.locator("main")).toBeVisible()

    const gemessen = await page.evaluate(() => {
      const wurzel = getComputedStyle(document.documentElement)
      const flaeche = getComputedStyle(document.querySelector("main")!)
      return {
        schema: wurzel.colorScheme,
        breiteWurzel: wurzel.scrollbarWidth,
        // Der Scrollbereich, nicht die Wurzel: hier entscheidet es sich.
        breiteFlaeche: flaeche.scrollbarWidth,
        farbeFlaeche: flaeche.scrollbarColor,
      }
    })

    expect(gemessen.schema).toBe("dark")
    expect(gemessen.breiteWurzel).toBe("thin")
    expect(gemessen.breiteFlaeche).toBe("thin")
    // Zweiter Wert ist die Spur — durchsichtig, damit kein grauer Kanal steht.
    expect(gemessen.farbeFlaeche).toContain("rgba(0, 0, 0, 0)")
  })

  test("folgt im hellen Modus dem hellen Schema", async ({ page }) => {
    await page.goto("/group-1/feed?connector=local")
    await page.evaluate(() => localStorage.setItem("rls-theme", "light"))
    await page.reload()
    await expect(page.locator("main")).toBeVisible()

    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light")
  })
})
