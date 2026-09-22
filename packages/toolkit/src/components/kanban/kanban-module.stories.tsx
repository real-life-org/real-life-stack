import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"

/**
 * Das Kanban ist ein Toolkit-Modul und laeuft im Modul-Host (Spec 01). Das
 * Board ist der Inhalt; Kopf, Suche und Filterkarte gehoeren der Flaeche, und
 * was nur im Kanban bedeutet — Zuweisung, „Nur meine", die Einstellungen —
 * reicht das Modul in Karte und Kopf hinein. Die Aufgaben laedt der Host aus
 * `presents: ["status"]`; Detail, Erstellen (Vorschlag „Aufgabe") und
 * Plusknopf stellt er.
 *
 * Bis zum 21.09.2026 baute diese Story das Kanban aus Bausteinen nach; jetzt
 * zeigt sie das Modul. Das Board allein hat seine Stories unter „Board".
 */
function KanbanModuleOverview() {
  return <HostWorld module="kanban" />
}

const meta: Meta<typeof KanbanModuleOverview> = {
  id: "rls-space-modules-kanban-overview",
  title: "RLS/Modules/Kanban/Overview",
  component: KanbanModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof KanbanModuleOverview>

export const Default: Story = {}
