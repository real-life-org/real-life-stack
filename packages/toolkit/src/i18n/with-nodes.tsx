import { Fragment, type ReactNode } from "react"

/**
 * Ein übersetzter Satz mit React-Knoten an Platzhalter-Stellen — für Sätze,
 * in denen ein Teil hervorgehoben ist („**Anna** möchte dich als Kontakt
 * hinzufügen.").
 *
 * Der Satz bleibt EIN Wörterbucheintrag mit `{name}`; nur die Stelle wird
 * ersetzt. Zusammengestückelte Satzteile („<b>Anna</b>" + „ möchte dich …")
 * gingen in Sprachen mit anderer Wortstellung nicht auf. Aufruf: `t` OHNE den
 * Parameter, der ein Knoten werden soll — er bleibt dann als `{name}` im Text
 * stehen (siehe `interpolate` in der Laufzeit) und wird hier ersetzt.
 *
 * Intern, bewusst nicht im öffentlichen Einstieg: sobald Apps es brauchen,
 * wird es dort aufgenommen.
 */
export function withNodes(text: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = text.split(/\{(\w+)\}/g)
  // split mit Gruppe: gerade Indizes sind Text, ungerade die Platzhalternamen.
  return parts.map((part, index) => {
    if (index % 2 === 0) return part === "" ? null : <Fragment key={index}>{part}</Fragment>
    return Object.prototype.hasOwnProperty.call(nodes, part) ? (
      <Fragment key={index}>{nodes[part]}</Fragment>
    ) : (
      <Fragment key={index}>{`{${part}}`}</Fragment>
    )
  })
}
