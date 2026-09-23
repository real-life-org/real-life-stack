#!/usr/bin/env node
/**
 * Setzt in jeder Uebersetzung den `sourceHash` auf den aktuellen Hash ihrer
 * deutschen Quelle — nach dem Uebersetzen oder Nachziehen. Der Waechter
 * (check.mjs) meldet danach wieder nur echte Abweichungen.
 *
 *   node scripts/site/hash-translations.mjs
 */
import { writeFileSync } from "node:fs"
import { hash, pages, read, root } from "./lib.mjs"

let n = 0
for (const p of pages()) {
  if (p.lang === "de" || !p.meta.translationOf) continue
  const h = hash(read(p.meta.translationOf))
  if (p.meta.sourceHash === h) continue
  const next = p.text.replace(/^sourceHash: .*$/m, `sourceHash: ${h}`)
  writeFileSync(new URL(p.path, root), next)
  console.log(`${p.path}: sourceHash → ${h.slice(0, 12)}…`)
  n++
}
console.log(n ? `${n} Uebersetzung(en) nachgezogen` : "alle Uebersetzungen aktuell")
