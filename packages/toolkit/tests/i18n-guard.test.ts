/**
 * Der i18n-Wächter — eine Sperrklinke gegen fest geschriebene Oberflächentexte.
 *
 * Das Toolkit spricht über `t()` (`src/i18n/`). Was noch fest im Code steht,
 * zählt `i18n-scan.ts` je Datei; `i18n-baseline.json` hält den Bestand fest.
 * Der Wächter lässt den Bestand nur sinken:
 *
 * - Eine Datei, die nicht in der Baseline steht, darf keinen festen Text
 *   bekommen.
 * - Eine Datei darf nicht mehr festen Text haben als in der Baseline.
 * - Sinkt eine Zahl, muss die Baseline mitsinken — sonst wüchse sie still
 *   wieder zu. Nachziehen: `pnpm --filter @real-life/toolkit i18n:baseline`.
 *
 * Die Regel selbst (was zählt, was nicht) steht in `i18n-scan.ts` und ist
 * unten an Beispielen festgenagelt.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { EXCLUDED_PATHS, scanSource, scanTree, type Finding } from "./i18n-scan"

const SRC = resolve(__dirname, "../src")
const BASELINE_FILE = resolve(__dirname, "i18n-baseline.json")
const FIX = "pnpm --filter @real-life/toolkit i18n:baseline"

const findings = scanTree(SRC)
const current: Record<string, number> = Object.fromEntries(
  Object.keys(findings)
    .sort()
    .map((file) => [file, findings[file].length]),
)

if (process.env.I18N_WRITE_BASELINE) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify(current, null, 2)}\n`)
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Record<string, number>

const show = (list: Finding[]) => list.map((f) => `    ${f.line}: ${f.text}`).join("\n")

describe("i18n-Wächter: fest geschriebener Oberflächentext", () => {
  it("kommt in keiner Datei dazu, die bisher frei davon war", () => {
    const neu = Object.keys(current).filter((file) => !(file in baseline))
    expect(
      neu.map((file) => `${file}:\n${show(findings[file])}`),
      "Texte über t() aus src/i18n/de.ts + en.ts holen (oder Entwicklertext mit `i18n-exempt: <Grund>` markieren)",
    ).toEqual([])
  })

  it("wächst in keiner Datei über die Baseline", () => {
    const mehr = Object.keys(current).filter((file) => file in baseline && current[file] > baseline[file])
    expect(
      mehr.map((file) => `${file}: Baseline ${baseline[file]}, jetzt ${current[file]}\n${show(findings[file])}`),
      "Neue Texte über t() aus src/i18n/de.ts + en.ts holen",
    ).toEqual([])
  })

  it("Baseline sinkt mit dem Abbau mit", () => {
    const weniger = Object.keys(baseline).filter((file) => (current[file] ?? 0) < baseline[file])
    expect(
      weniger.map((file) => `${file}: Baseline ${baseline[file]}, jetzt ${current[file] ?? 0}`),
      `Abgebaut — Baseline nachziehen: ${FIX}`,
    ).toEqual([])
  })

  it("jede Ausnahme nennt einen Grund", () => {
    for (const { path, reason } of EXCLUDED_PATHS) expect(reason.trim(), path).not.toBe("")
  })
})

describe("i18n-Wächter: die Regel", () => {
  const count = (source: string, file = "x.tsx") => scanSource(file, source).length

  it("zählt JSX-Text in jeder Sprache", () => {
    expect(count(`const A = () => <p>Noch keine Kontakte</p>`)).toBe(1)
    expect(count(`const A = () => <span>Toggle Sidebar</span>`)).toBe(1)
    expect(count(`const A = () => <span>{count} · </span>`)).toBe(0)
  })

  it("zählt Anzeige-Attribute in jeder Sprache, technische nie", () => {
    expect(count(`const A = () => <input placeholder="Search…" />`)).toBe(1)
    expect(count(`const A = () => <b aria-label={open ? "Schließen" : "Öffnen"} />`)).toBe(2)
    expect(count(`const A = () => <List emptyMessage="Nothing here" />`)).toBe(1)
    expect(count(`const A = () => <b className="flex items-center Gruppe" data-x="Liste der Dinge" />`)).toBe(0)
  })

  it("zählt Literale in JSX-Kindern, aber nicht die Bedingung", () => {
    expect(count(`const A = () => <p>{saving ? "Saving" : "Save"}</p>`)).toBe(2)
    expect(count(`const A = () => <p>{mode === "signup" ? x : y}</p>`)).toBe(0)
  })

  it("zählt deutsche Literale und Wortgruppen auch ausserhalb von JSX", () => {
    expect(count(`setError("Fehler beim Speichern")`, "x.ts")).toBe(1)
    expect(count(`const label = dunkel ? "Helles Design" : "Dunkles Design"`, "x.ts")).toBe(2)
    expect(count(`const id = "rls.language"; const c = "bg-primary/10"`, "x.ts")).toBe(0)
  })

  it("lässt Entwicklertext und Schlüssel aus", () => {
    expect(count(`throw new Error("Kein Space zum Bearbeiten")`, "x.ts")).toBe(0)
    expect(count(`console.warn("Das Modul hat keinen Besitzer")`, "x.ts")).toBe(0)
    expect(count(`t("groupDialog.newGroup", { name: "Gruppe" })`, "x.ts")).toBe(0)
    expect(count(`if (x === "Mein Netzwerk") y()`, "x.ts")).toBe(0)
  })

  it("respektiert begründete Ausnahmen, aber keine ohne Grund", () => {
    expect(count(`// i18n-exempt: Konsolenwarnung\nconst w = () => "Das Modul hat keinen Besitzer"`, "x.ts")).toBe(0)
    expect(count(`const w = "Das ist ein Satz" // i18n-exempt: Testdaten`, "x.ts")).toBe(0)
    expect(count(`// i18n-exempt:\nconst w = "Das ist ein Satz"`, "x.ts")).toBe(1)
  })
})
