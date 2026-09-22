import type { Meta, StoryObj } from "@storybook/react-vite"

import { useCreate } from "../../components/host/create-host"
import { useModulePanel } from "../../components/module-panel/module-panel"
import { Button } from "../../components/primitives/button"
import { useItemFocus } from "../../hooks/use-item-focus"
import { HostWorld } from "../../story-support/host-world"
import { STORY_EVENT, STORY_TASK } from "../../story-support/story-world"

/**
 * **Der Fokus** (Spec 01, „Der Modul-Host"): welches Item offen ist, ob es
 * bearbeitet wird, ob gerade erstellt wird. Der Vertrag ist einer
 * (`useItemFocus`), die Ablage nicht: In einer App mit Router lebt der Fokus
 * in der **URL** — `/{space}/{modul}/{item}`, `?edit`, `?comment`, `?compose=` —
 * damit Zurück im Browser das Panel schließt und ein Link zum Item führt.
 * Ohne Router (Story, Test) hält `MemoryFocusProvider` denselben Vertrag im
 * Speicher.
 *
 * Die Leiste unten zeigt, **welche Adresse** der Zustand in einer App hätte.
 * Klick auf eine Karte, „Bearbeiten“ im Panel, der Plusknopf, ein Modulwechsel:
 * jedes Mal ändert sich die Zeile — und in der App die URL.
 *
 * Regel: Ein Modul ruft `focusItem(id)` und `focusItem(id, "calendar")` (Modul
 * und Item in **einem** Schritt); es hält keinen eigenen Auswahlzustand.
 */
function Adresszeile() {
  const f = useItemFocus()
  const params = new URLSearchParams()
  if (f.isEditing) params.set("edit", "1")
  if (f.isCommenting) params.set("comment", "1")
  if (f.composeType) params.set("compose", f.composeType)
  const q = params.toString()
  const url = `/${f.scope ?? "?"}/${f.module ?? "?"}${f.itemId ? `/${f.itemId}` : ""}${q ? `?${q}` : ""}`
  return (
    <div className="pointer-events-auto fixed bottom-2 left-32 right-24 z-[60] rounded-lg border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">In der App wäre die URL jetzt</span>
        <code className="rounded bg-muted px-2 py-0.5 font-mono text-[13px]">{url}</code>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_EVENT.id)}>Termin öffnen</Button>
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_TASK.id, "kanban")}>Aufgabe im Kanban</Button>
          <Button size="sm" variant="outline" onClick={() => f.editItem()} disabled={!f.itemId}>Bearbeiten</Button>
          <Button size="sm" variant="outline" onClick={() => f.startCompose("event")}>Erstellen: Termin</Button>
          <Button size="sm" variant="ghost" onClick={() => (f.composeType ? f.stopCompose() : f.clearFocus())}>Loslassen</Button>
        </span>
      </div>
    </div>
  )
}

/**
 * **Das Panel**: Detail, Erstellen (als Blatt), Verlauf und Einstellungen teilen
 * sich **ein** Panel je App (`ModulePanelProvider`). Inhalt wird getauscht,
 * nicht gestapelt: eine Z-Ebene, ein Drawer auf dem Handy. `panelFit:
 * "overlay"` (Karte, Graph) lässt den Schleier weg, damit die Fläche bewegbar
 * bleibt. Ein Modul öffnet das Panel nie selbst für ein Item — es setzt den
 * Fokus, der Detail-Host öffnet.
 */
function Panelzeile() {
  const panel = useModulePanel()
  const { startCreate, isComposing } = useCreate()
  const f = useItemFocus()
  return (
    <div className="pointer-events-auto fixed bottom-2 left-32 right-24 z-[60] rounded-lg border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Im Panel steht gerade</span>
        <code className="rounded bg-muted px-2 py-0.5 font-mono text-[13px]">{panel.current ? `${panel.current.kind}${panel.current.itemId ? ` · ${panel.current.itemId}` : ""}` : "nichts"}</code>
        <span className="text-muted-foreground">· Erstellen offen: {String(isComposing)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_EVENT.id)}>Detail: Termin</Button>
          <Button size="sm" variant="outline" onClick={() => startCreate("task")}>Erstellen: Aufgabe</Button>
          <Button size="sm" variant="ghost" onClick={() => panel.close()}>Panel schließen</Button>
        </span>
      </div>
    </div>
  )
}

/**
 * **Erstellen**: Der Plusknopf bietet in jedem Modul **alle** Typen des Space;
 * ein Modul schlägt einen vor (`options.suggestType`) und belegt Felder vor
 * (der Kalender das Datum), es schränkt nie ein (Regel 3). `createShell` wählt
 * Blatt oder Vollbild (der Feed). Ein Modul mit eigenem Einstieg meldet ihn
 * (`setCreateAnchor`), und der Plusknopf tritt zurück, solange der im Bild ist
 * (die Feed-Pille). Verlässt jemand mit Eingaben das Formular, fragt der Guard.
 *
 * Wechsle unten die Tabs und öffne den Plusknopf: Der Vorschlag folgt dem Modul,
 * das Menü bleibt gleich.
 */
function Erstellzeile() {
  const { startCreate, patchCreate, isComposing } = useCreate()
  return (
    <div className="pointer-events-auto fixed bottom-2 left-32 right-24 z-[60] rounded-lg border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">useCreate(): isComposing = {String(isComposing)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => startCreate("event", { start: "2026-10-03T15:00" })}>Termin am 3.10., 15 Uhr</Button>
          <Button size="sm" variant="outline" onClick={() => startCreate("place")}>Ort</Button>
          <Button size="sm" variant="outline" onClick={() => patchCreate({ title: "Erntedank" })} disabled={!isComposing}>Titel vorbelegen</Button>
        </span>
      </div>
    </div>
  )
}

const meta: Meta = {
  id: "rls-app-fokus",
  title: "RLS/App/05 Fokus, Panel, Erstellen",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta

export const Fokus: StoryObj = { name: "Der Fokus — und seine Adresse", render: () => <HostWorld module="feed"><Adresszeile /></HostWorld> }
export const Panel: StoryObj = { name: "Das eine Panel", render: () => <HostWorld module="calendar"><Panelzeile /></HostWorld> }
export const Erstellen: StoryObj = { name: "Erstellen: Vorschlag, kein Zaun", render: () => <HostWorld module="kanban"><Erstellzeile /></HostWorld> }
