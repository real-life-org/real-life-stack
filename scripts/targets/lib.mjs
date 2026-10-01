// Wächter für den Auflöser der Kanten-Ziele (Spec 06, Verhältnis zu
// Relations, Regel 6; 04, Target-Konventionen, Regel 6): Im Toolkit zerlegt
// nur `packages/toolkit/src/lib/item-targets.ts` ein Target. Targets BAUEN
// (`item:${id}`) darf jeder.
//
// Gemeldet werden die Muster, mit denen ein Target zerlegt wird:
// `parseLocalItemTarget`, `parseQualifiedItemTarget`, `.startsWith("item:")`,
// `.slice("item:".length)`, `.replace(/^item:/…)` und `.split("/item:")`.
// Eine Zeile, die keinen Target, sondern etwas anderes mit derselben Form
// zerlegt (die Knoten-Ids des Graphen), trägt den Kommentar
// `targets: kein Target` mit Begründung.

export const RESOLVER = "packages/toolkit/src/lib/item-targets.ts"

export const PATTERNS = [
  /\bparseLocalItemTarget\b/,
  /\bparseQualifiedItemTarget\b/,
  /\.startsWith\(\s*["'`]item:["'`]\s*\)/,
  /\.slice\(\s*["'`]item:["'`]\.length\s*\)/,
  /\.replace\(\s*\/\^item:/,
  /\.split\(\s*["'`]\/item:["'`]\s*\)/,
]

export const ALLOW_MARK = "targets: kein Target"

/** Öffentliche Namen des Auflösers (06, Verhältnis zu Relations, Regel 6). */
export const PUBLIC = new Set([
  "resolveTarget", "resolveTargetFromConnector", "useResolvedTarget", "useCarrierScope",
  "carrierScope", "spaceScope", "allSpacesScope", "sameSpaceScope", "scopesFromConnector", "scopesAcrossSpaces",
  "survivesSpaceChange", "isItemTarget", "TargetScope", "ScopeFor", "ScopeOptions", "SpaceSource",
])

/**
 * Abschalten der Space-Prüfung oder ein selbst gebauter Kontext: ein
 * Kontext „alle Spaces" ohne Auskunft, Kontextfelder als Objekt, und
 * `sameSpaceScope` ohne begründende Markierung `targets: ein Bereich`.
 */
export const DISABLE_PATTERNS = [
  /\b(allSpacesScope|scopesAcrossSpaces)\(\s*(undefined|null)\b/,
  /\bcarrierSpace\s*:/,
  /\bspaceOf\s*:\s*(undefined|null)\b/,
]
export const SAME_SPACE_MARK = "targets: ein Bereich"

/** Die Namen, die eine Datei aus dem Auflöser importiert. */
function importedFromResolver(source) {
  const names = []
  const re = /import\s*(type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*item-targets["']/g
  for (const m of source.matchAll(re)) {
    for (const part of m[2].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]
      if (name) names.push(name)
    }
  }
  return names
}

/** Befunde in einer Datei: `[{ line, text }]`. */
export function findings(path, source) {
  if (path === RESOLVER) return []
  const out = []
  const lines = source.split("\n")
  lines.forEach((text, i) => {
    if (text.includes(ALLOW_MARK)) return
    const trimmed = text.trim()
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return
    if (PATTERNS.some((re) => re.test(text))) out.push({ line: i + 1, text: trimmed })
    else if (DISABLE_PATTERNS.some((re) => re.test(text))) out.push({ line: i + 1, text: `Space-Prüfung abgeschaltet oder Kontext selbst gebaut: ${trimmed}` })
    else if (/\bsameSpaceScope\(/.test(text) && !text.includes(SAME_SPACE_MARK)) out.push({ line: i + 1, text: `sameSpaceScope ohne Begründung (${SAME_SPACE_MARK}): ${trimmed}` })
  })
  for (const name of importedFromResolver(source)) {
    if (!PUBLIC.has(name)) {
      const line = lines.findIndex((l) => l.includes("item-targets")) + 1
      out.push({ line, text: `interner Helfer „${name}“ aus dem Auflöser importiert` })
    }
  }
  return out
}

/** Nur Quelltext des Toolkits, ohne Tests, Stories und gebautes. */
export function inScope(path) {
  return (
    path.startsWith("packages/toolkit/src/") &&
    /\.(ts|tsx)$/.test(path) &&
    !/\.stories\.tsx?$/.test(path) &&
    !path.includes("/story-support/")
  )
}

// ---------------------------------------------------------------------------
// Wächter für den Formularzustand (shared-components → Formularzustand,
// Prüfbar „Exporte"): Widgets erreichen ihn nur über den Feldzugang.
//
// - Die Bausteine (`FormState`, `useFormState`, `ActionState`,
//   `useActionState`) importieren nur der Formularzustand selbst (der
//   Composer) und der Aktionszustand (die Selbstaktion). Alle anderen —
//   Widgets vorneweg — importieren aus `lib/form-state` nur Typen.
// - `updateMany` (der rohe Setter von früher) gibt es nicht mehr.
// - Kein Index des Pakets exportiert `lib/form-state`.

export const FORM_STATE = "packages/toolkit/src/lib/form-state.tsx"

/** Wer die Bausteine des Formular- und des Aktionszustands benutzen darf. */
export const FORM_STATE_OWNERS = new Set([
  "packages/toolkit/src/components/composer/content-composer.tsx",
  "packages/toolkit/src/components/preview/use-people-line.ts",
])

/** Befunde zum Formularzustand in einer Datei: `[{ line, text }]`. */
export function formFindings(path, source) {
  if (path === FORM_STATE) return []
  const out = []
  const lines = source.split("\n")
  const importRe = /import\s*(type\s*)?\{([^}]*)\}\s*from\s*["'][^"']*form-state["']/g
  for (const m of source.matchAll(importRe)) {
    const line = source.slice(0, m.index).split("\n").length
    const values = m[1] ? [] : m[2].split(",").map((p) => p.trim()).filter((p) => p && !p.startsWith("type "))
    if (values.length > 0 && !FORM_STATE_OWNERS.has(path)) {
      out.push({ line, text: `Baustein des Formularzustands außerhalb von Formular- und Aktionszustand: ${values.join(", ")}` })
    }
  }
  if (/export\s+(\*|\{[^}]*\})\s*from\s*["'][^"']*form-state["']/.test(source)) {
    const line = lines.findIndex((l) => /export.*form-state/.test(l)) + 1
    out.push({ line, text: "lib/form-state wird exportiert" })
  }
  lines.forEach((text, i) => {
    const trimmed = text.trim()
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return
    if (/\bupdateMany\b/.test(text)) out.push({ line: i + 1, text: `roher Setter: ${trimmed}` })
  })
  return out
}
