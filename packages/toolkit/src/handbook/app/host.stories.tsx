import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"
import { ProbeWorld } from "../../story-support/probe-world"
import { useModuleHost } from "../../components/host/module-host"
import type { ModuleEntry, ModuleViewProps } from "../../lib/module-register"
import { List } from "lucide-react"

/**
 * **Der Modul-Host** (Spec 01, „Der Modul-Host"): Register binden, Host rendern,
 * fertig. Der Host ist die Stelle, die aus einem Registereintrag eine laufende
 * Fläche macht — einmal, für alle Module. Was er herstellt, und woher er es
 * weiß:
 *
 * | Der Host … | … aus |
 * |---|---|
 * | stellt die Fläche (Kopf, Suche, Vokabular, Filterkarte, Chips) | `fill`, `panelFit`, `maxWidth` |
 * | lädt die Items und wendet den geteilten Filter an | `presents` + `options` über die Hinweis-Tabelle; `loads: "module"` = keine Abfrage |
 * | löst den Space-Kontext auf (Mitglieder, Autoren, Farben, Übersicht) | aktiver Space; `__overview__` an genau einer Stelle |
 * | begrenzt aggregierende Module auf eigene Karten | `isAggregateVisibleItemType` |
 * | nennt aktives Item und ob ein Filter aktiv ist | Panel + Fokus, geteilter Filterzustand |
 * | scrollt die fokussierte Karte in den Blick | `registerItemElement` |
 * | registriert Detail und Erstellen | Typ-Register: alle Typen, `options.suggestType`, `options.createShell` |
 * | hält den Fokus | URL (App) oder Speicher (Story) |
 *
 * Ein Modul bekommt all das über `useModuleHost()` und `ModuleViewProps` fertig;
 * es darf nichts davon selbst bauen (Regel 2). Die Story „Probe" zeigt genau
 * diese Werte live für einen künstlichen Eintrag. Diese Story enthält KEINE Zeile Modul-Verdrahtung — kein
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

/** Ein Modul, das nur zeigt, was der Host ihm gibt — nichts sonst. */
function ProbeModul({ items = [], itemsLoading }: ModuleViewProps) {
  const host = useModuleHost()
  const zeile = (k: string, v: unknown) => (
    <div key={k} className="grid grid-cols-[13rem_minmax(0,1fr)] gap-3 border-b py-1.5 last:border-b-0 text-sm">
      <code className="font-mono text-[13px] text-primary">{k}</code>
      <span className="break-all">{typeof v === "string" ? v : JSON.stringify(v)}</span>
    </div>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <p className="text-sm text-muted-foreground">Alles unten kommt aus <code>useModuleHost()</code> und den Props — das Modul hat keinen einzigen Hook zum Laden aufgerufen. Suche oben und die Items hier ändern sich zusammen.</p>
      <div className="rounded-xl border bg-card px-4 py-1">
        {zeile("entry.id / presents / loads", `${host.entry.id} / ${JSON.stringify(host.entry.presents ?? [])} / ${host.entry.loads ?? "host"}`)}
        {zeile("groupId / isOverview", `${host.groupId} / ${host.isOverview}`)}
        {zeile("members", host.members.map((m) => m.displayName ?? m.id))}
        {zeile("currentUser", host.currentUser?.displayName ?? "—")}
        {zeile("items (gefiltert)", items.map((i) => i.data.title ?? i.id))}
        {zeile("itemsLoading", String(itemsLoading))}
        {zeile("filterActive", String(host.filterActive))}
        {zeile("activeItemId", host.activeItemId ?? "—")}
        {zeile("resolveAuthor(items[0])", items[0] ? host.resolveAuthor(items[0].createdBy)?.displayName ?? "unbekannt" : "—")}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i.id} type="button" className="rounded-md border px-2 py-1 text-xs hover:bg-accent" onClick={() => host.setCreateAnchor?.(null)}>
            {String(i.data.title ?? i.id)}
          </button>
        ))}
      </div>
    </div>
  )
}
const PROBE: ModuleEntry = { id: "probe", label: "Probe", icon: List, presents: ["start"], options: { suggestType: "event" }, view: ProbeModul }

function Probe() {
  return <ProbeWorld entry={PROBE} />
}

const meta: Meta<typeof DerModulHost> = {
  id: "rls-module-host",
  title: "RLS/App/03 Der Modul-Host",
  component: DerModulHost,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof DerModulHost>

export const Default: Story = { name: "Der Kalender im Host" }
/** Ein Eintrag mit `presents: ["start"]`: Der Host lädt Termine, filtert nach Suche, stellt Mitglieder, Autor, Plusknopf mit Vorschlag „Termin". */
export const ProbeStory: StoryObj = { name: "Probe: was der Host gibt", render: () => <Probe /> }
