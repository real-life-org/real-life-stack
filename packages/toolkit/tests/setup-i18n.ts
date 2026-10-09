import { beforeEach } from "vitest"

import { resetI18nForTests } from "../src/testing"

/**
 * Die Toolkit-Suiten prüfen deutsche Literale („Ganztägig", „bearbeitet",
 * „kopiert"). Ohne Festnageln erbten sie die Sprache vom System — auf einer
 * deutschen Maschine grün, auf CI-Node (`navigator.language` = `en-US`) rot.
 * Jeder Test startet deshalb auf Deutsch, ohne gespeicherte Nutzerwahl und
 * ohne Erweiterungen; Tests, die die Sprache selbst prüfen, schalten sie
 * ausdrücklich um. Gegenprobe: `LC_ALL=en_US.UTF-8 pnpm exec vitest run`.
 */
beforeEach(() => {
  resetI18nForTests("de")
})
