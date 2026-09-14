import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ThemeTweaker } from "./theme-tweaker"
import { AdaptivePanel } from "../layout/adaptive-panel"
import { Button } from "../primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../primitives/card"
import { Input } from "../primitives/input"

const meta: Meta<typeof ThemeTweaker> = {
  title: "RLS/App Shell/ThemeTweaker",
  component: ThemeTweaker,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Regler für die Farbtokens des Toolkits — live, mit Werten, und am Ende eine `theme.json` " +
          "für `deploy/app/branding/` (Spec 11). In der App liegt das Panel im geteilten Modul-Panel " +
          "(User-Menü → „Design anpassen“); hier im AdaptivePanel neben einer Beispielseite. " +
          "Über den Toolbar-Schalter „Regler“ lässt es sich auch neben jede andere Story legen.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ThemeTweaker>

/** Eine Seite mit den Flaechen, die die Tokens tragen — damit ein Regler sichtbar etwas bewegt. */
function SamplePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Beispielseite</h1>
      <p className="text-sm text-muted-foreground">
        Primär, Sekundär, Karten, Eingaben und Rahmen — jede Bewegung im Panel zeigt sich hier sofort.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button>Primär</Button>
        <Button variant="secondary">Sekundär</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destruktiv</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Karte</CardTitle>
            <CardDescription>Gedämpfter Text auf der Kartenfläche</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Eingabefeld" />
            <p className="text-sm">Fließtext auf der Karte.</p>
          </CardContent>
        </Card>
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm font-medium">Gedämpfte Fläche</p>
          <p className="text-xs text-muted-foreground">Meta-Text darauf</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="h-6 flex-1 rounded" style={{ background: `var(--chart-${n})` }} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 text-xs">
        <span className="rounded bg-warning px-2 py-1 text-warning-foreground">Warnung</span>
        <span className="rounded bg-pink px-2 py-1 text-pink-foreground">Rosa</span>
        <span className="rounded bg-accent px-2 py-1 text-accent-foreground">Akzent</span>
      </div>
    </div>
  )
}

function Demo() {
  const [open, setOpen] = useState(true)
  // Wie die App: die `dark`-Klasse liegt am Wurzelelement, das Panel folgt ihr.
  const toggle = () => document.documentElement.classList.toggle("dark")
  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div
        className="mx-auto max-w-2xl space-y-4 transition-all"
        style={{ marginRight: "var(--adaptive-panel-margin-right, 0px)" }}
      >
        {!open && <Button variant="outline" onClick={() => setOpen(true)}>Design anpassen</Button>}
        <SamplePage />
      </div>
      <AdaptivePanel open={open} onClose={() => setOpen(false)} allowedModes={["sidebar", "drawer"]} sidebarWidth="420px">
        <ThemeTweaker onToggleScheme={toggle} />
      </AdaptivePanel>
    </div>
  )
}

export const ImPanel: Story = {
  name: "Im AdaptivePanel",
  render: () => <Demo />,
}

export const NurInhalt: Story = {
  name: "Nur Inhalt",
  parameters: { layout: "padded" },
  render: () => (
    <div className="max-w-md rounded-lg border border-border bg-background">
      <ThemeTweaker onToggleScheme={() => document.documentElement.classList.toggle("dark")} />
    </div>
  ),
}
