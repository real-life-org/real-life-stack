/**
 * Der Scanner hinter dem i18n-Wächter (`i18n-guard.test.ts`).
 *
 * Er zählt je Datei die Stellen, an denen nutzersichtbarer Text noch fest im
 * Code steht, statt über `t()` aus dem Wörterbuch zu kommen. Die Regel ist
 * absichtlich mechanisch — sie muss nicht jede Zeile richtig einordnen, nur
 * jedes Mal gleich. Was sie fälschlich zählt, steht in der Baseline oder
 * bekommt einen begründeten `i18n-exempt`-Kommentar; was sie übersieht, ist
 * der Preis dafür, dass technische Strings (Klassen, Ids, Schlüssel) nicht
 * zählen.
 *
 * **Zählt (eine Stelle je Literal):**
 *
 * 1. JSX-Text mit einem Wort aus mindestens zwei Buchstaben — in jeder
 *    Sprache, denn JSX-Text ist immer sichtbar.
 * 2. Ein String- oder Template-Literal in einem JSX-Kind (`{a ? "x" : "y"}`)
 *    oder als Wert eines Anzeige-Attributs ({@link isUiAttribute}: `title`,
 *    `aria-label`, `placeholder`, `alt`, `label` und jedes Prop auf
 *    `…Label`, `…Message`, `…Title`, `…Text` …) — ebenfalls in jeder Sprache.
 * 3. Jedes andere String- oder Template-Literal, das nach Oberflächentext
 *    aussieht ({@link looksGerman}: Umlaut/ß, ein Wort aus
 *    {@link GERMAN_WORDS} oder eine Wortgruppe wie „Helles Design") —
 *    Fehlerzustände, Labels in Objekten, Standardwerte von Props.
 *
 * **Zählt nicht:**
 *
 * - Entwicklertext: Argumente von `throw`, `new …Error(…)`, `console.*` und
 *   `Error(…)` — sie richten sich an Entwickler und bleiben Deutsch.
 * - Technische Positionen: Import/Export-Pfade, Typ-Literale, `case`-Marken,
 *   Objekt-Schlüssel, Vergleiche (`===`/`!==`), Argumente von `t()`/
 *   `tDynamic()` und technischen Attributen ({@link TECHNICAL_ATTRIBUTES}).
 * - Eine Zeile (oder die Zeile darunter), die ein Kommentar
 *   `i18n-exempt: <Grund>` markiert — der Grund ist Pflicht.
 * - Ganze Pfade aus {@link EXCLUDED_PATHS}, je mit Begründung.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import ts from "typescript"

/**
 * Pfade (relativ zu `src/`, mit `/`), die der Wächter nicht liest — mit Grund.
 * Ein Präfix mit `/` am Ende meint ein Verzeichnis.
 */
export const EXCLUDED_PATHS: ReadonlyArray<{ path: string; reason: string }> = [
  { path: "i18n/", reason: "die Wörterbücher selbst" },
  { path: "story-support/", reason: "Storybook-Hilfen mit deutschen Beispieldaten" },
  { path: "handbook/", reason: "Handbuch-Seiten im Storybook, eigene Übersetzung" },
  { path: "components/debug/", reason: "Debug-Ansichten für Entwickler" },
  { path: "testing.ts", reason: "Test-Einstieg, keine Oberfläche" },
  {
    path: "components/preview/field-register.ts",
    reason: "Validierung des Feldregisters — Meldungen an Modul-Autoren",
  },
  {
    path: "components/preview/list-groups.ts",
    reason: "Validierung der Gruppierungsfelder — Meldungen an Modul-Autoren",
  },
]

/** Dateiendungen, die nie gelesen werden (Stories, Typdeklarationen). */
const EXCLUDED_SUFFIXES = [".stories.tsx", ".stories.ts", ".d.ts"]

/**
 * Attribute, deren Wert angezeigt oder vorgelesen wird: die festen Namen
 * unten und jedes Prop, dessen Name auf eine Text-Rolle endet
 * (`activeLabel`, `emptyMessage`, `searchLabel`, `errorLabel` …).
 */
export function isUiAttribute(name: string): boolean {
  return UI_ATTRIBUTES.has(name) || UI_ATTRIBUTE_SUFFIX.test(name)
}

const UI_ATTRIBUTE_SUFFIX = /[a-z](Label|Title|Text|Message|Placeholder|Description|Heading|Hint|Caption|Tooltip)$/

export const UI_ATTRIBUTES = new Set([
  "title",
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "alt",
  "label",
])

/** Attribute, deren Wert nie angezeigt wird. */
export const TECHNICAL_ATTRIBUTES =
  /^(className|class|id|key|href|src|type|role|name|value|style|variant|size|side|align|as|htmlFor|target|rel|autoComplete|inputMode|mode|lang|dir|data-.*|aria-(controls|labelledby|describedby|hidden|live|current|haspopup|expanded|selected|pressed|checked))$/

/**
 * Wörter, die einen Literal als deutschen Text kennzeichnen. Bewusst
 * Funktions- und Oberflächenwörter, die in technischen Strings nicht vorkommen.
 */
export const GERMAN_WORDS = [
  "und", "oder", "nicht", "kein", "keine", "noch", "mit", "für", "von", "bis", "nach", "zum", "zur",
  "der", "die", "das", "den", "dem", "ein", "eine", "einen", "ist", "sind", "wird", "werden", "hier",
  "alle", "neu", "neue", "neuen", "Gruppe", "Gruppen", "Kontakt", "Kontakte", "Profil", "Abbrechen",
  "Speichern", "Löschen", "Bearbeiten", "Schließen", "Suchen", "Suche", "Titel", "Beschreibung", "Ort",
  "Datum", "Uhr", "Tag", "Tage", "Mitglied", "Mitglieder", "Einladen", "Einladung", "Beitrag",
  "Kommentar", "Kommentare", "Antworten", "Senden", "Fertig", "Zurück", "Weiter", "Abmelden",
  "Anmelden", "Einstellungen", "Karte", "Liste", "Kalender", "Teilen", "Hinzufügen", "Entfernen",
  "Laden", "lädt", "Fehler", "Erstellen", "Anlegen", "Ohne", "Mehr", "weniger", "heute", "morgen",
  "gestern", "Woche", "Monat", "Jahr", "öffnen", "schließen", "Bild", "Bilder", "Datei", "Aufgabe",
  "Aufgaben", "Termin", "Termine", "Veranstaltung", "Mein", "Meine", "Dein", "Deine", "Sie", "du",
  "wir", "dich", "dein", "deine", "deinen", "Konto", "Passwort", "Farbe", "Modul", "Module",
  "Bestätigen", "Später", "Aussehen",
]

const GERMAN_RE = new RegExp(`[äöüÄÖÜß]|(?<![\\p{L}\\p{N}_-])(${GERMAN_WORDS.join("|")})(?![\\p{L}\\p{N}_-])`, "u")
const WORD_RE = /\p{L}{2,}/u

/**
 * Ein Satz oder eine Wortgruppe: beginnt mit einem Großbuchstaben, mindestens
 * zwei Wörter, nur Buchstaben, Bindestriche und Satzzeichen („Helles Design",
 * „Toggle Sidebar"). Technische Strings haben fast immer Punkte ohne
 * Leerzeichen, Schrägstriche, Klammern oder Ziffern.
 */
const PHRASE_RE = /^[\p{Lu}][\p{L}'’-]*(?:[ ,]+[\p{L}'’-]+)+[.!?…:]?$/u

/** Sieht ein Text nach Oberflächensprache aus (deutsch oder als Wortgruppe)? */
export function looksGerman(text: string): boolean {
  return GERMAN_RE.test(text) || PHRASE_RE.test(text.trim())
}

/** Ruft ein Aufruf Entwicklertext oder einen Übersetzungsschlüssel ab? */
const NON_UI_CALL =
  /^(console\.\w+|Error|TypeError|RangeError|t|tDynamic|i18n\.t|i18n\.tDynamic|\w+\.t|\w+\.tDynamic|cn|clsx|cva|twMerge|describe|it|test|expect)$/

export interface Finding {
  line: number
  text: string
}

function exemptLines(source: string): Set<number> {
  const lines = new Set<number>()
  source.split("\n").forEach((line, index) => {
    if (/i18n-exempt:\s*\S/.test(line)) {
      lines.add(index + 1) // dieselbe Zeile (Kommentar am Ende)
      lines.add(index + 2) // die Zeile darunter
    }
  })
  return lines
}

/**
 * Trägt der Literal oder einer seiner Vorfahren einen führenden Kommentar
 * `i18n-exempt: <Grund>`? So nimmt ein Kommentar über einer Funktion deren
 * ganzen Rumpf aus — für Entwicklertext, der nicht über `throw`/`console`
 * läuft (z.B. eine Funktion, die einen Warntext baut).
 */
function exemptByComment(node: ts.Node, source: string): boolean {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    const ranges = ts.getLeadingCommentRanges(source, current.getFullStart()) ?? []
    if (ranges.some((range) => /i18n-exempt:\s*\S/.test(source.slice(range.pos, range.end)))) return true
  }
  return false
}

function isDeveloperOrTechnical(node: ts.Node): boolean {
  let child: ts.Node = node
  let parent = node.parent
  while (parent) {
    if (ts.isThrowStatement(parent)) return true
    if (ts.isNewExpression(parent) && /Error$/.test(parent.expression.getText())) return true
    if (ts.isCallExpression(parent) && parent.arguments.includes(child as ts.Expression)) {
      if (NON_UI_CALL.test(parent.expression.getText())) return true
    }
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isImportTypeNode(parent)) return true
    if (ts.isLiteralTypeNode(parent) || ts.isCaseClause(parent)) return true
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === child) return true
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(parent.operatorToken.kind)
    ) {
      return true
    }
    // Die Suche endet an der nächsten Anweisung oder JSX-Grenze.
    if (ts.isStatement(parent) || ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) return false
    child = parent
    parent = parent.parent
  }
  return false
}

/**
 * Wo landet dieser Literal in JSX? `{ attribute }` für den Wert eines
 * Attributs, `"child"` für ein JSX-Kind (`{cond ? "a" : "b"}`), sonst `null`.
 * Bedingungen, Klammern und `&&`/`??` dazwischen ändern daran nichts.
 */
function jsxPositionOf(node: ts.Node): { attribute: string } | "child" | null {
  let parent = node.parent
  while (
    parent &&
    (ts.isConditionalExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      (ts.isBinaryExpression(parent) &&
        [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
          parent.operatorToken.kind,
        )))
  ) {
    // Die Bedingung selbst ist kein Text, nur ihre Zweige.
    if (ts.isConditionalExpression(parent) && parent.condition === node) return null
    node = parent
    parent = parent.parent
  }
  if (!parent || !ts.isJsxExpression(parent)) return null
  const container = parent.parent
  if (ts.isJsxAttribute(container)) return { attribute: container.name.getText() }
  if (ts.isJsxElement(container) || ts.isJsxFragment(container)) return "child"
  return null
}

function literalText(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression): string {
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ")
  }
  return node.text
}

/** Die Fundstellen einer Quelldatei — exportiert für den Selbsttest des Wächters. */
export function scanSource(fileName: string, source: string): Finding[] {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  const exempt = exemptLines(source)
  const findings: Finding[] = []

  const add = (node: ts.Node, text: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    if (!exempt.has(line) && !exemptByComment(node, source)) findings.push({ line, text: text.trim().replace(/\s+/g, " ").slice(0, 80) })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (WORD_RE.test(node.text)) add(node, node.text)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const text = literalText(node)
      const parent = node.parent
      const isKey = (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node
      if (WORD_RE.test(text) && !isKey && !isDeveloperOrTechnical(node)) {
        const position = ts.isJsxAttribute(parent) ? { attribute: parent.name.getText() } : jsxPositionOf(node)
        const attribute = position !== null && position !== "child" ? position.attribute : null
        if (attribute !== null && TECHNICAL_ATTRIBUTES.test(attribute)) {
          // technisch — zählt nie
        } else if (position === "child" || (attribute !== null && isUiAttribute(attribute))) {
          add(node, text)
        } else if (looksGerman(text)) {
          add(node, text)
        }
      }
      // Template-Teile nicht noch einmal einzeln besuchen — wohl aber Ausdrücke darin.
      if (ts.isTemplateExpression(node)) node.templateSpans.forEach((span) => visit(span.expression))
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return findings
}

function isExcluded(rel: string): boolean {
  if (EXCLUDED_SUFFIXES.some((suffix) => rel.endsWith(suffix))) return true
  return EXCLUDED_PATHS.some(({ path }) => (path.endsWith("/") ? rel.startsWith(path) : rel === path))
}

/** Alle Fundstellen unter `srcDir`, je Datei (Pfad relativ zu `src/`, mit `/`). */
export function scanTree(srcDir: string): Record<string, Finding[]> {
  const result: Record<string, Finding[]> = {}
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry)
      const rel = relative(srcDir, full).split(sep).join("/")
      if (statSync(full).isDirectory()) {
        if (!isExcluded(`${rel}/`)) walk(full)
      } else if (/\.tsx?$/.test(entry) && !isExcluded(rel)) {
        const findings = scanSource(rel, readFileSync(full, "utf8"))
        if (findings.length > 0) result[rel] = findings
      }
    }
  }
  walk(srcDir)
  return result
}
