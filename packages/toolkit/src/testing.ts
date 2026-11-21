/**
 * `@real-life/toolkit/testing` — Helfer für Tests von Apps und Toolkit,
 * bewusst NICHT im Haupteinstieg: was nur Testsuiten brauchen, gehört nicht
 * in die Oberfläche, die eine App beim Bauen sieht.
 *
 * Teilt sich den Laufzeit-Zustand mit dem Haupteinstieg (gemeinsamer Chunk im
 * Build): `resetI18nForTests("de")` hier wirkt auf `getI18n()` von dort.
 */
export { resetI18nForTests } from "./i18n/runtime"
