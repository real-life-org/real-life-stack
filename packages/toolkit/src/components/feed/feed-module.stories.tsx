import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"

/**
 * Der Feed ist ein Toolkit-Modul und laeuft im Modul-Host (Spec 01) — diese
 * Story enthaelt keine Zeile Feed-Verdrahtung. Bis zum 21.09.2026 baute sie
 * den Feed aus Bausteinen nach; das war eine zweite Fassung neben der App,
 * und die beiden liefen auseinander.
 *
 * Die Pille oben ist der Einstieg ins Schreiben, solange sie im Bild ist; der
 * Plusknopf des Hosts tritt an ihre Stelle, sobald sie weggescrollt ist.
 * Erstellen oeffnet im Vollbild (`options.createShell`), mit „Beitrag"
 * vorgeschlagen — alle Typen bleiben waehlbar.
 */
function FeedModuleOverview() {
  return <HostWorld module="feed" />
}

const meta: Meta<typeof FeedModuleOverview> = {
  id: "rls-space-modules-feed-overview",
  title: "RLS/Modules/Feed/Overview",
  component: FeedModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof FeedModuleOverview>

export const Default: Story = {}
