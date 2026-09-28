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

/** Befunde in einer Datei: `[{ line, text }]`. */
export function findings(path, source) {
  if (path === RESOLVER) return []
  const out = []
  source.split("\n").forEach((text, i) => {
    if (text.includes(ALLOW_MARK)) return
    const trimmed = text.trim()
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return
    if (PATTERNS.some((re) => re.test(text))) out.push({ line: i + 1, text: trimmed })
  })
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
