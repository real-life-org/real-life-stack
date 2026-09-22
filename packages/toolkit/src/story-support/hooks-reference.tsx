import { Fragment } from "react"

import reference from "../hooks/all-hooks.json"

/**
 * Die Hook-Referenz im Storybook, aus `all-hooks.json` (erzeugt von
 * scripts/hooks/generate.mjs aus den TSDoc-Bloecken). Eine HTML-Tabelle, weil
 * Storybooks MDX keine Markdown-Tabellen rendert; die Docs-Styles greifen
 * ueber die Klasse `docblock-table`.
 */
type Hook = (typeof reference)["groups"][number]["hooks"][number]

const REPO = "https://github.com/real-life-org/real-life-stack/blob/master/"

/** `Text mit \`code\`` → Text mit <code>code</code>. */
function inline(text: string) {
  return text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>))
}

function Without({ value }: { value: string }) {
  const [head, ...note] = value.split(/ — | \(/)
  const tone = head.startsWith("throws") ? { color: "var(--destructive, #b91c1c)" } : head === "—" ? { color: "var(--muted-foreground, #6b7280)" } : {}
  return (
    <>
      <span style={tone}>{head}</span>
      {note.length ? <span style={{ color: "var(--muted-foreground, #6b7280)" }}> — {inline(note.join(" ").replace(/\)$/, ""))}</span> : null}
    </>
  )
}

function Row({ hook }: { hook: Hook }) {
  return (
    <tr>
      <td>
        <code>{hook.name}({hook.signature})</code>
        <div style={{ fontSize: "0.8em", marginTop: 2 }}>
          <a href={`${REPO}${hook.source}#L${hook.line}`} target="_blank" rel="noreferrer">source</a>
          {hook.stories.map((s) => (
            <Fragment key={s}> · <a href={`?path=/story/${s}`}>story</a></Fragment>
          ))}
          {hook.specs.map((s) => (
            <Fragment key={s}> · <a href={`${REPO}${s}`} target="_blank" rel="noreferrer">spec</a></Fragment>
          ))}
        </div>
      </td>
      <td>{inline(hook.answers)}</td>
      <td>{inline(hook.question)}</td>
      <td><Without value={hook.without} /></td>
    </tr>
  )
}

export function HooksReference({ group }: { group?: string }) {
  const groups = group ? reference.groups.filter((g) => g.id === group) : reference.groups
  return (
    <>
      {groups.map((g) => (
        <Fragment key={g.id}>
          {group ? null : <h2 id={g.id}>{g.title} <span style={{ fontWeight: 400, color: "var(--muted-foreground, #6b7280)", fontSize: "0.7em" }}>{g.hooks.length}</span></h2>}
          <table className="docblock-table" style={{ width: "100%", fontSize: "0.9em" }}>
            <thead>
              <tr><th>Hook</th><th>Answers</th><th>Question it answers</th><th>Without capability</th></tr>
            </thead>
            <tbody>{g.hooks.map((h) => <Row key={h.name} hook={h} />)}</tbody>
          </table>
        </Fragment>
      ))}
    </>
  )
}

/** Wie viele Hooks die Referenz kennt — fuer den Einleitungssatz. */
export const hookCount = reference.groups.reduce((n, g) => n + g.hooks.length, 0)
