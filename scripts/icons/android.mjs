#!/usr/bin/env node
/**
 * Die Android-Startsymbole der Referenz-App aus EINER Quelle: dem Favicon
 * (apps/reference/public/favicon.svg), das auch Site und Web-App tragen
 * (Anton, 23.09.2026: ein Symbol ueberall). Braucht `rsvg-convert` (librsvg).
 *
 *   node scripts/icons/android.mjs
 *
 * Erzeugt je Dichte das adaptive Vordergrund-Bild (Glyphe auf transparent,
 * in der sicheren Zone), die Hintergrundfarbe und die Legacy-Symbole
 * (eckig und rund), dazu das iOS-Symbol (1024 px, ohne Rundung — iOS rundet
 * selbst). Die PNGs sind eingecheckt; das Skript ist die Herleitung.
 */
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))
const source = resolve(root, "apps/reference/public/favicon.svg")
const res = resolve(root, "apps/reference/android/app/src/main/res")
const svg = readFileSync(source, "utf8")
const background = svg.match(/fill="(#[0-9a-fA-F]{6})"/)?.[1] ?? "#e87520"
const glyph = svg.match(/<g [^>]*>[\s\S]*?<\/g>/)?.[0]
if (!glyph) throw new Error("favicon.svg: keine Glyphen-Gruppe gefunden")
// Die Glyphe steht im Favicon in einem 24er-Raster, um 5.5 verschoben und auf 0.875 skaliert.
const glyphOnly = glyph.replace(/transform="[^"]*"/, 'transform="translate(28.8 28.8) scale(2.1)"')

const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${glyphOnly}</svg>`
const round = svg.replace("<svg ", '<svg ').replace(/(viewBox="0 0 32 32">)/, '$1<defs><clipPath id="r"><circle cx="16" cy="16" r="16"/></clipPath></defs><g clip-path="url(#r)">').replace("</svg>", "</g></svg>")

const tmp = mkdtempSync(join(tmpdir(), "rls-icons-"))
const render = (name, markup, size, out) => {
  const file = join(tmp, `${name}.svg`)
  writeFileSync(file, markup)
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), "-o", out, file])
}
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, f] of Object.entries(densities)) {
  const dir = resolve(res, `mipmap-${d}`)
  render("foreground", foreground, 108 * f, join(dir, "ic_launcher_foreground.png"))
  render("legacy", svg, 48 * f, join(dir, "ic_launcher.png"))
  render("round", round, 48 * f, join(dir, "ic_launcher_round.png"))
}
// iOS: ein Quadrat ohne Rundung, iOS maskiert selbst.
render("ios", svg.replace(/ rx="6"/, ""), 1024, resolve(root, "apps/reference/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"))
writeFileSync(resolve(res, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background.toUpperCase()}</color>\n</resources>\n`)
console.log(`App-Symbole aus ${source.slice(root.length)}: Android 5 Dichten (Hintergrund ${background}), iOS 1024 px`)
