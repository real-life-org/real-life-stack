import { useMemo, useState, type ReactNode } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Store } from "lucide-react"

import { Button } from "../../components/primitives/button"
import { TOOLKIT_DEFINITION, composeModules, type ModuleExtension } from "../../lib/module-register"

/**
 * **Das Register** (Spec 01, „Modul-Register"): Welche Module es gibt, sagt
 * genau eine Liste — komponiert aus Beiträgen, zuerst dem des Toolkits, dann
 * denen der App. Eine App **definiert** eigene Module und **ergänzt**
 * vorhandene; ersetzen darf sie ein Feld nur ausdrücklich (`replaces`, Regel 2).
 * Ein Konflikt ist ein Fehler beim Start, kein stilles Überschreiben.
 *
 * Die Liste steht nirgends ein zweites Mal: Tabs, Routen, Benachrichtigungen,
 * „Feld führt zur Sicht" — alles liest aus `getModules()`. Welche Module ein
 * Space **führt**, steht in `Group.data.modules`, in seiner Reihenfolge.
 *
 * Unten wird live komponiert. Die Beiträge sind die der Netzwerk-App:
 * Marktplatz als eigenes Modul, Karte und Kalender mit eigenen Optionen.
 */
const Dummy = () => null

const MARKTPLATZ: ModuleExtension = {
  name: "network",
  definitions: [{ id: "marketplace", label: "Marktplatz", icon: Store, presents: ["resource"], options: { suggestType: "resource" }, view: Dummy }],
}
const karte = (replaces: boolean): ModuleExtension => ({
  name: "network",
  extensions: [{ id: "map", options: { suggestType: "place", initialView: { center: [12.4066, 52.1183], zoom: 16 } }, ...(replaces ? { replaces: ["options"] } : {}) }],
})

function Spalte({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{titel}</h3>
      {children}
    </div>
  )
}

function Register() {
  const [mitMarktplatz, setMarktplatz] = useState(true)
  const [mitKarte, setKarte] = useState(true)
  const [ausdruecklich, setAusdruecklich] = useState(true)
  const ergebnis = useMemo(() => {
    const beitraege: ModuleExtension[] = [TOOLKIT_DEFINITION]
    if (mitMarktplatz) beitraege.push(MARKTPLATZ)
    if (mitKarte) beitraege.push(karte(ausdruecklich))
    try {
      return { register: composeModules(beitraege), fehler: null as string | null }
    } catch (e) {
      return { register: null, fehler: (e as Error).message }
    }
  }, [mitMarktplatz, mitKarte, ausdruecklich])
  const toolkit = composeModules([TOOLKIT_DEFINITION])

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={mitMarktplatz ? "default" : "outline"} onClick={() => setMarktplatz((v) => !v)}>Marktplatz definieren</Button>
        <Button size="sm" variant={mitKarte ? "default" : "outline"} onClick={() => setKarte((v) => !v)}>Karten-Optionen der App</Button>
        <Button size="sm" variant={ausdruecklich ? "default" : "outline"} onClick={() => setAusdruecklich((v) => !v)} disabled={!mitKarte}>
          {ausdruecklich ? "mit replaces: [\"options\"]" : "ohne replaces"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Spalte titel="Beitrag „toolkit“">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {toolkit.map((m) => (
              <li key={m.id}><code>{m.id}</code> — {m.label}{m.presents?.length ? <span className="text-muted-foreground"> · presents {JSON.stringify(m.presents)}</span> : null}</li>
            ))}
          </ol>
        </Spalte>
        <Spalte titel="komponiert: toolkit + network">
          {ergebnis.register ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {ergebnis.register.map((m) => (
                <li key={m.id}>
                  <code>{m.id}</code> — {m.label}
                  {m.id === "marketplace" && <span className="text-muted-foreground"> · von der App definiert</span>}
                  {m.id === "map" && mitKarte && <span className="text-muted-foreground"> · options ersetzt: {JSON.stringify(m.options)}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <pre className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-xs text-destructive">{ergebnis.fehler}</pre>
          )}
        </Spalte>
      </div>
      <p className="text-sm text-muted-foreground">
        Reihenfolge = Tab-Reihenfolge des Registers; ein Space ordnet für sich um, indem er <code>data.modules</code> in seiner Reihenfolge speichert. Ein Modul, das die App nicht kennt, bleibt gespeichert und bekommt nur keinen Tab.
      </p>
    </div>
  )
}

const meta: Meta<typeof Register> = {
  id: "rls-app-register",
  title: "RLS/App/02 Das Register",
  component: Register,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof Register>
export const Default: Story = { name: "Komponieren, ergänzen, ersetzen" }
