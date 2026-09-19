import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AdaptivePanel, type PanelMode } from "./adaptive-panel"
import { Button } from "../primitives/button"

const meta: Meta<typeof AdaptivePanel> = {
  id: "rls-app-shell-layout-adaptivepanel",
  title: "RLS/App Shell/Inhalts-Panel und Dialoge/AdaptivePanel",
  component: AdaptivePanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof AdaptivePanel>

/** The stack's standard: a floating card beside the content on wide screens, a drawer below 1024px. */
const STANDARD_MODES: PanelMode[] = ["floating", "drawer"]

/** Sample content used across stories */
function SampleContent({ title = "Panel-Inhalt" }: { title?: string }) {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        Das AdaptivePanel wählt seine Form nach der Viewport-Breite: ab 1024px die schwebende Karte
        neben dem Inhalt, darunter der Drawer von unten. Ein Modal gibt es nur, wo es ausdrücklich erlaubt ist.
      </p>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Eintrag {i + 1}</p>
            <p className="text-xs text-muted-foreground">Beispieltext für scrollbare Inhalte</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Wrapper that provides open/close state and a trigger button */
function PanelDemo({
  allowedModes = STANDARD_MODES,
  side,
  sidebarWidth,
  sidebarMinWidth,
  sidebarMaxWidth,
  modalClassName,
  drawerInitialHeight,
  pinned: pinnedProp,
  showPinToggle = false,
  title,
  children,
}: {
  allowedModes?: PanelMode[]
  side?: "left" | "right"
  sidebarWidth?: string
  sidebarMinWidth?: string
  sidebarMaxWidth?: string
  modalClassName?: string
  drawerInitialHeight?: number
  pinned?: boolean
  showPinToggle?: boolean
  title?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(pinnedProp ?? false)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">AdaptivePanel Demo</h1>
        <p className="text-sm text-muted-foreground">
          Fensterbreite ändern, um zwischen schwebender Karte (&ge;1024px) und Drawer (&lt;1024px) zu wechseln.
        </p>
        <Button onClick={() => setOpen(true)}>Panel öffnen</Button>

        {/* Page content to demonstrate content displacement */}
        <div className="space-y-3 transition-all" style={{
          marginRight: "var(--adaptive-panel-margin-right, 0px)",
          marginLeft: "var(--adaptive-panel-margin-left, 0px)",
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4">
              <p className="font-medium">Seiteninhalt {i + 1}</p>
              <p className="text-sm text-muted-foreground">
                Dieser Inhalt rückt ein, wenn die Karte geöffnet ist.
              </p>
            </div>
          ))}
        </div>
      </div>

      <AdaptivePanel
        open={open}
        onClose={() => setOpen(false)}
        allowedModes={allowedModes}
        side={side}
        sidebarWidth={sidebarWidth}
        sidebarMinWidth={sidebarMinWidth}
        sidebarMaxWidth={sidebarMaxWidth}
        modalClassName={modalClassName}
        drawerInitialHeight={drawerInitialHeight}
        pinned={pinned}
        onPinnedChange={showPinToggle ? setPinned : undefined}
      >
        {children ?? <SampleContent title={title} />}
      </AdaptivePanel>
    </div>
  )
}

/**
 * Der Standard im Stack: die schwebende Karte liegt über dem Inhalt statt als
 * Spalte daneben und rückt ihn genauso ein (360px + 2x16px Rand); unter 1024px
 * der Drawer.
 */
export const Default: Story = {
  render: () => <PanelDemo title="Schwebende Karte" />,
}

export const FloatingLeft: Story = {
  render: () => <PanelDemo side="left" title="Schwebend, links" />,
}

export const Drawer: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [375] },
  },
  render: () => (
    <PanelDemo allowedModes={["drawer"]} title="Nur Drawer" />
  ),
}

export const Modal: Story = {
  render: () => (
    <PanelDemo allowedModes={["modal"]} title="Nur Modal" />
  ),
}

export const WithPinToggle: Story = {
  render: () => (
    <PanelDemo showPinToggle title="Pinned-Modus">
      <div className="space-y-4 p-4">
        <h2 className="text-lg font-semibold">Angeheftetes Panel</h2>
        <p className="text-sm text-muted-foreground">
          Klicke auf das Pin-Icon oben rechts, um das Panel anzuheften.
          Im angehefteten Modus bleibt das Panel offen — es wird nur durch
          explizites Schließen (X-Button oder Drawer-Herunterziehen) geschlossen.
        </p>
        <p className="text-sm text-muted-foreground">
          Bei der schwebenden Karte gibt es keinen Backdrop; beim Drawer wird er
          entfernt und die Seite bleibt interaktiv.
        </p>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium">Beispiel-Aktion</p>
          <p className="text-xs text-muted-foreground">
            Im Kanban-Board bleibt das Formular nach dem Speichern offen,
            wenn pinned aktiv ist.
          </p>
        </div>
      </div>
    </PanelDemo>
  ),
}

export const PinnedByDefault: Story = {
  render: () => (
    <PanelDemo showPinToggle pinned title="Standardmäßig angeheftet" />
  ),
}

export const CustomWidth: Story = {
  render: () => (
    <PanelDemo
      sidebarWidth="500px"
      sidebarMinWidth="350px"
      sidebarMaxWidth="700px"
      title="Breite Karte (500px)"
    />
  ),
}

export const CustomDrawerHeight: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    chromatic: { viewports: [375] },
  },
  render: () => (
    <PanelDemo
      allowedModes={["drawer"]}
      drawerInitialHeight={0.75}
      title="Großer Drawer (75%)"
    />
  ),
}

export const ScrollableContent: Story = {
  render: () => (
    <PanelDemo title="Scrollbarer Inhalt">
      <div className="space-y-4 p-4">
        <h2 className="text-lg font-semibold">Viel Inhalt</h2>
        <p className="text-sm text-muted-foreground">
          Das Panel scrollt den Inhalt intern. Beim Öffnen wird immer nach oben gescrollt.
        </p>
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-muted p-3">
            <p className="text-sm font-medium">Element {i + 1}</p>
            <p className="text-xs text-muted-foreground">
              Langer Inhalt zum Testen des Scroll-Verhaltens im Drawer und in der Karte.
            </p>
          </div>
        ))}
      </div>
    </PanelDemo>
  ),
}

export const WithFormContent: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [pinned, setPinned] = useState(true)
    const [submissions, setSubmissions] = useState<string[]>([])

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto space-y-4" style={{
          marginRight: "var(--adaptive-panel-margin-right, 0px)",
          marginLeft: "var(--adaptive-panel-margin-left, 0px)",
          transition: "margin 300ms ease-out",
        }}>
          <h1 className="text-xl font-bold">Formular im Panel</h1>
          <p className="text-sm text-muted-foreground">
            Zeigt das Zusammenspiel von Pinned-Modus und Formular-Aktionen.
            Das Panel bleibt nach dem Absenden offen, weil es angeheftet ist.
          </p>
          <Button onClick={() => setOpen(true)}>Formular öffnen</Button>

          {submissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Einträge:</p>
              {submissions.map((s, i) => (
                <div key={i} className="rounded-lg border p-2 text-sm">{s}</div>
              ))}
            </div>
          )}
        </div>

        <AdaptivePanel
          open={open}
          onClose={() => setOpen(false)}
          allowedModes={STANDARD_MODES}
          pinned={pinned}
          onPinnedChange={setPinned}
        >
          <div className="space-y-4 p-4">
            <h2 className="text-lg font-semibold">Neuer Eintrag</h2>
            <input
              type="text"
              placeholder="Titel eingeben..."
              className="w-full rounded-md border px-3 py-2 text-sm"
              id="demo-input"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (!pinned) setOpen(false)
                }}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const input = document.getElementById("demo-input") as HTMLInputElement
                  if (input.value.trim()) {
                    setSubmissions((prev) => [...prev, input.value.trim()])
                    input.value = ""
                  }
                  if (!pinned) setOpen(false)
                }}
              >
                Speichern
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {pinned
                ? "Panel ist angeheftet — bleibt nach Speichern/Abbrechen offen."
                : "Panel ist nicht angeheftet — schließt nach Speichern/Abbrechen."}
            </p>
          </div>
        </AdaptivePanel>
      </div>
    )
  },
}
