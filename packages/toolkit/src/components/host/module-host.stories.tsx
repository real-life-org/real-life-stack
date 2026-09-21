import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"

/**
 * Der Modul-Host (Spec 01, „Der Modul-Host"): Register binden, Host rendern,
 * fertig. Diese Story enthält KEINE Zeile Modul-Verdrahtung — kein
 * `useItems`, kein `useRegisterDetail`, kein Plusknopf. Alles davon stellt
 * der Host aus dem Registereintrag her; die Story stellt nur, was eine App
 * stellt: Connector, Filter, Fokus, die zwei Host-Provider und das Panel.
 *
 * Feed, Kalender und Karte laufen heute so; die Verdrahtung dafuer steht
 * einmal in `story-support/host-world.tsx`. Die Karte
 * zeigt hier den Hinweis „Keine Karten-Engine gestellt": Die Engine ist die
 * eine Zeile, die eine App für die Karte schreibt (`MapLibreAdapterProvider`
 * aus `@real-life-stack/toolkit/maplibre`) — und sie fehlt hier mit Absicht,
 * damit man den Hinweis einmal gesehen hat.
 *
 * Klick auf den Termin: der Host öffnet das Detail im Panel, mit Bearbeiten.
 * Klick auf einen leeren Tag: Erstellen mit „Termin" vorgeschlagen und dem
 * Datum vorbelegt — das Typmenü bleibt offen. Der Plusknopf unten rechts:
 * derselbe Vorschlag, ohne Datum.
 */
function DerModulHost() {
  return <HostWorld module="calendar" />
}

const meta: Meta<typeof DerModulHost> = {
  id: "rls-module-host",
  title: "RLS/Module/Der Modul-Host",
  component: DerModulHost,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof DerModulHost>

export const Default: Story = {}
