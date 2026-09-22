import type { Meta, StoryObj } from "@storybook/react-vite"
import { List } from "lucide-react"
import { itemTypes, registerModuleHint } from "@real-life-stack/data-interface"

import { hostFiltersFor, useModuleHost } from "../../components/host/module-host"
import type { ModuleEntry, ModuleViewProps } from "../../lib/module-register"
import { ProbeWorld } from "../../story-support/probe-world"

/**
 * **Der Ladevertrag** (Spec 01, „Der Ladevertrag"): `presents` sagt, was ein
 * Modul zeigen kann — als **Hinweise**. Ein Hinweis ist ein Feld (`start`,
 * `position`, `status`) oder eine Klasse mit Affordanz (`statement`), und die
 * Hinweis-Tabelle in `data-interface` kennt beide Richtungen: Item → Hinweis
 * (Routing, Benachrichtigungen) und Hinweis → Connector-Filter (der Host lädt).
 *
 * Vier Regeln, alle hier sichtbar:
 *
 * 1. **Eine Tabelle, offen.** Ein eigener Hinweis (`resource`) trägt sich mit
 *    beiden Richtungen ein — so macht es der Marktplatz der Netzwerk-App.
 * 2. **Grob lädt der Connector, fein entscheidet das Modul.** Der Filter prüft
 *    Präsenz (`hasField`), keine Werte.
 * 3. **Mehrere Hinweise sind eine Vereinigung.** Je Hinweis eine Abfrage, nie
 *    „alles laden und lokal filtern".
 * 4. **Wer selbst lädt, sagt es** (`loads: "module"`): Der Host stellt keine
 *    Abfrage — die Karte lädt nach Ausschnitt.
 *
 * Wähle unten, was der Eintrag verspricht, und sieh, was der Host daraus
 * fragt und was ankommt. Die Suche oben wirkt zusätzlich — Regel 2a.
 */
try {
  registerModuleHint("resource", {
    test: (item) => itemTypes(item).includes("resource"),
    filter: () => ({ type: ["resource"] }),
  })
} catch {
  // Beim Neuladen der Story ist die Zeile schon da — die Tabelle lehnt Dubletten ab.
}

function Ladeprobe({ items = [] }: ModuleViewProps) {
  const { entry } = useModuleHost()
  const filter = hostFiltersFor(entry)
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Eintrag</div>
        <code>presents: {JSON.stringify(entry.presents ?? [])}{entry.loads ? `, loads: "${entry.loads}"` : ""}</code>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Der Host fragt den Connector</div>
        {filter === null ? (
          <p>keine Abfrage — das Modul lädt selbst</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">{filter.map((f, i) => <li key={i}><code>{JSON.stringify(f)}</code></li>)}</ol>
        )}
        {filter && filter.length > 1 && <p className="mt-2 text-muted-foreground">{filter.length} Abfragen, vereinigt nach Id.</p>}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Was ankommt ({items.length})</div>
        <ul className="space-y-1">{items.map((i) => <li key={i.id}>{String(i.data.title ?? i.id)} <span className="text-muted-foreground">· {itemTypes(i).join(", ")}</span></li>)}</ul>
        {items.length === 0 && <p className="text-muted-foreground">nichts — entweder passt kein Item, oder das Modul lädt selbst</p>}
      </div>
    </div>
  )
}

const eintrag = (presents: string[] | undefined, loads?: "module"): ModuleEntry => ({
  id: "probe", label: "Probe", icon: List, presents, loads, options: { suggestType: presents?.[0] === "start" ? "event" : "post" }, view: Ladeprobe,
})

const meta: Meta = {
  id: "rls-app-ladevertrag",
  title: "RLS/App/04 Der Ladevertrag",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta

/** Ein Hinweis: `presents: ["start"]` → `hasField: ["start"]` → die Termine. */
export const EinHinweis: StoryObj = { name: "Ein Hinweis: start", render: () => <ProbeWorld entry={eintrag(["start"])} /> }
/** Zwei Hinweise sind ODER: zwei Abfragen, die Vereinigung — Termine und Orte. */
export const ZweiHinweise: StoryObj = { name: "Zwei Hinweise: start + position", render: () => <ProbeWorld entry={eintrag(["start", "position"])} /> }
/** Ohne `presents` aggregiert das Modul: alles, was als eigene Karte steht — keine Kommentare, keine Reaktionen. */
export const Aggregierend: StoryObj = { name: "Ohne presents: aggregierend", render: () => <ProbeWorld entry={eintrag(undefined)} /> }
/** Ein eigener Hinweis der App: `resource` ist eine Klasse, kein Feld — die Tabelle kennt beide Richtungen. */
export const EigenerHinweis: StoryObj = { name: "Eigener Hinweis: resource", render: () => <ProbeWorld entry={eintrag(["resource"])} /> }
/** `loads: "module"`: der Host schweigt, das Modul lädt selbst (die Karte, nach Ausschnitt). */
export const LaedtSelbst: StoryObj = { name: "loads: module", render: () => <ProbeWorld entry={eintrag(["position"], "module")} /> }
