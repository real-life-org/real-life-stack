import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Calendar, Map as MapIcon, Newspaper } from "lucide-react"
import { isAggregateVisibleItemType } from "@real-life-stack/data-interface"
import { AppShell, AppShellMain } from "./app-shell"
import { Navbar, NavbarStart, NavbarCenter, NavbarEnd } from "./navbar"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { ModuleTabs } from "./module-tabs"
import { UserMenu } from "./user-menu"
import { BottomNav } from "./bottom-nav"
import { ModuleFrame } from "./module-frame"
import { ModuleToolbar } from "./module-toolbar"
import { FilterProvider } from "../filter/filter-store"
import { FieldNavigationProvider } from "../navigation/field-navigation"
import { CalendarView } from "../calendar/calendar-view"
import { MapView } from "../map/map-view"
import { MapLibreMapAdapter } from "../../maplibre"
import { findModulePresenting } from "../../lib/module-register"
import { ModulePanelProvider, useModulePanel } from "../module-panel/module-panel"
import { ItemDetailView } from "../detail/item-detail-view"
import { ItemDetailBody } from "../detail/item-detail-body"
import { ItemPreview } from "../preview/item-preview"
import { ItemMetaRow } from "../preview/item-meta-row"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { useItems } from "../../hooks/use-items"
import { useMembers } from "../../hooks/use-groups"
import { useItemAuthor } from "../../hooks/use-item-author"
import { useModuleFilteredItems } from "../../hooks/use-filterable-items"
import { createComposerMapping } from "../composer/composer-mapping"
import { STORY_ME, STORY_SEED, StoryWorld } from "../../story-support/story-world"

/**
 * **How a module surface comes about.**
 *
 * No module builds its surface itself. There is exactly one nesting, and the
 * frame (`AppFrame`) uses it for every app:
 *
 * ```
 * FilterProvider              search and filter survive the module switch
 *   AppShell                  the shell, full height
 *     Navbar                  space · modules · person
 *     ModulePanelProvider     ONE panel for detail, composer, settings
 *       AppShellMain
 *         ModuleFrame         header fixed at the top, content scrolls below
 *           <module>          brings its ModuleToolbar itself
 *     BottomNav               the same modules, narrow
 * ```
 *
 * These stories show exactly that, on real data, built by hand so each layer
 * is visible. A click on a card opens the detail in the shared panel; the
 * search at the top filters the list; on narrow screens the panel becomes a
 * drawer and the module tabs the bottom bar.
 *
 * The values in the facts row lead somewhere too: a click on the date switches
 * to the calendar, one on the place to the map. Which module shows a field is
 * said by the register (`findModulePresenting`); HOW to get there only the
 * app knows — so it hands it in through `FieldNavigationProvider`. Without it
 * the value stays plain text, which is exactly what the single adornment
 * stories show.
 *
 * In an app you do not write this nesting: [The app in 40 lines](?path=/docs/rls-app-01-the-app-in-40-lines--docs).
 */

const MODULES = [
  { id: "feed", label: "Feed", icon: Newspaper },
  { id: "map", label: "Karte", icon: MapIcon },
  { id: "calendar", label: "Kalender", icon: Calendar },
]

const mapStyle =
  "data:application/json," +
  encodeURIComponent(
    JSON.stringify({
      version: 8,
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": "#e4ece5" } }],
    }),
  )
const createAdapter = () => new MapLibreMapAdapter()

const mapping = createComposerMapping([
  { id: "post", label: "Beitrag", defaultWidgets: ["title", "text", "tags"] },
  { id: "event", label: "Termin", defaultWidgets: ["title", "text", "date"] },
  { id: "task", label: "Aufgabe", defaultWidgets: ["title", "text"] },
])

/**
 * Open the detail in the shared panel. One place for all three modules: what
 * "detail" means follows the ITEM, not the module the click came from.
 */
function useOeffneDetail() {
  const { data: items } = useItems()
  const { data: members } = useMembers(null)
  const panel = useModulePanel()
  return (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const author = members.find((m) => m.id === item.createdBy)
    panel.open({
      kind: "detail",
      itemId: item.id,
      content: (
        <ItemDetailView
          itemId={item.id}
          renderRead={(live, actions) => (
            <ItemDetailBody
              item={live}
              author={author}
              headerAdornment={<ItemTypeBadge type={live.type} />}
              actions={actions}
              meta={<ItemMetaRow item={live} />}
            />
          )}
          contentTypes={[{ id: item.type, label: "Inhalt", defaultWidgets: ["title", "text", "date"] }]}
          mapper={mapping.mapSubmission}
          editInitialData={mapping.editInitialData}
          composerProps={{ showVisibility: false }}
          onClose={() => panel.close()}
        />
      ),
    })
  }
}

/** A card in the list. The click goes to the shared panel, not to the module. */
function Karte({ itemId }: { itemId: string }) {
  const { data: items } = useItems()
  const { data: members } = useMembers(null)
  const item = items.find((i) => i.id === itemId)
  const author = useItemAuthor(item, members)
  const panel = useModulePanel()
  const oeffne = useOeffneDetail()
  if (!item) return null
  return (
    <ItemPreview
      item={item}
      author={author}
      active={panel.current?.itemId === item.id}
      headerAdornment={<ItemTypeBadge type={item.type} />}
      metaAdornment={<ItemMetaRow item={item} />}
      onClick={() => oeffne(item.id)}
    />
  )
}

/** The module's content: a filtered list. The filters come from above. */
function FeedInhalt() {
  const { data: items } = useItems()
  const sichtbar = items.filter((item) => isAggregateVisibleItemType(item.type))
  const gefiltert = useModuleFilteredItems(sichtbar)
  return (
    <>
      {/* Die Leiste gehört dem Modul, nicht der Fläche: Kalender und Karte
          bringen ihre eigene mit, der Feed diese hier. Zwei Leisten
          übereinander wären zwei Suchfelder. */}
      <ModuleToolbar
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      {gefiltert.map((item) => (
        <Karte key={item.id} itemId={item.id} />
      ))}
      {gefiltert.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Nichts passt zur Suche.</p>
      )}
      </div>
    </>
  )
}

/** The content switches with the module — otherwise a field click would lead nowhere. */
function Inhalt({ module }: { module: string }) {
  const { data: items } = useItems()
  const oeffne = useOeffneDetail()
  if (module === "calendar") {
    return (
      <CalendarView
        items={items}
        initialVisibleDate="2026-09-19"
        onItemClick={(item) => oeffne(item.id)}
      />
    )
  }
  if (module === "map") {
    return (
      <MapView
        items={items}
        itemsLoading={false}
        inventoryKey="garden"
        viewportMode="lens-auto-fit"
        createAdapter={createAdapter}
        initialView={{ center: [13.405, 52.52], zoom: 13, tileSource: mapStyle }}
        onItemClick={(item) => oeffne(item.id)}
      />
    )
  }
  return <FeedInhalt />
}

function Modulflaeche() {
  const [space, setSpace] = useState(STORY_SEED.groups[0])
  const [module, setModule] = useState("feed")

  // Welches Modul ein Feld zeigt, sagt das Register; wie man dorthin kommt,
  // weiß nur diese Fläche. Genau diese Aufteilung macht die App auch.
  const feldNavigation = useMemo(
    () => ({
      openField: (field: string) => {
        const ziel = findModulePresenting(field, MODULES.map(({ id }) => id))
        if (!ziel || ziel.id === module) return null
        return () => setModule(ziel.id)
      },
    }),
    [module],
  )

  return (
    <FilterProvider>
      <FieldNavigationProvider value={feldNavigation}>
      <AppShell>
        <Navbar>
          <NavbarStart>
            <WorkspaceSwitcher workspaces={STORY_SEED.groups} activeWorkspace={space} onWorkspaceChange={setSpace} />
          </NavbarStart>
          <NavbarCenter>
            <ModuleTabs modules={MODULES} activeModule={module} onModuleChange={setModule} />
          </NavbarCenter>
          <NavbarEnd>
            <UserMenu user={STORY_ME} onProfile={() => {}} />
          </NavbarEnd>
        </Navbar>
        <ModulePanelProvider allowedModes={["floating", "drawer"]}>
          <AppShellMain withBottomNav>
            <ModuleFrame moduleId={module} fill={module === "map" ? "bleed" : "container"} maxWidth="48rem">
              <Inhalt module={module} />
            </ModuleFrame>
          </AppShellMain>
        </ModulePanelProvider>
        <BottomNav items={MODULES} activeItem={module} onItemChange={setModule} />
      </AppShell>
      </FieldNavigationProvider>
    </FilterProvider>
  )
}

const meta: Meta<typeof Modulflaeche> = {
  id: "rls-app-shell-modulflaeche",
  title: "RLS/App shell/The module surface",
  component: Modulflaeche,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj<typeof Modulflaeche>

/** Everything together: header, surface head, list, shared panel. */
export const Default: Story = { name: "Wide" }

/** Narrow: the panel becomes a drawer, the modules move to the bottom. */
export const Schmal: Story = {
  name: "Narrow",
  parameters: { viewport: { defaultViewport: "mobile1" } },
}
