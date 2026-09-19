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
 * **Wie eine Modulfläche entsteht.**
 *
 * Kein Modul baut seine Fläche selbst. Es gibt genau eine Verschachtelung, und
 * jede App benutzt sie:
 *
 * ```
 * FilterProvider              Suche und Filter überdauern den Modulwechsel
 *   AppShell                  die Hülle, volle Höhe
 *     Navbar                  Space · Module · Person
 *     ModulePanelProvider     EIN Panel für Detail, Composer, Einstellungen
 *       AppShellMain
 *         ModuleFrame         Kopf oben fest, Inhalt scrollt darunter
 *           <Modul>           bringt seine ModuleToolbar selbst mit
 *     BottomNav               dieselben Module, schmal
 * ```
 *
 * Diese Stories zeigen genau das, an echten Daten. Ein Klick auf eine Karte
 * öffnet die Detailansicht im geteilten Panel; die Suche oben filtert die
 * Liste; auf schmalen Schirmen wird das Panel zum Drawer und die Modulreiter
 * zur unteren Leiste.
 *
 * Auch die Werte in der Faktenzeile führen irgendwohin: Ein Klick auf das
 * Datum wechselt in den Kalender, einer auf den Ort auf die Karte. Welches
 * Modul ein Feld zeigt, sagt das Register (`findModulePresenting`); WIE man
 * dorthin kommt, weiß nur die Anwendung — deshalb reicht sie es über den
 * `FieldNavigationProvider` hinein. Ohne ihn bleibt der Wert schlichter Text,
 * und genau das sieht man in den einzelnen Beigaben-Stories.
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
 * Detail im geteilten Panel öffnen. Eine Stelle für alle drei Module: Was
 * „Detail" heißt, folgt dem ITEM, nicht dem Modul, aus dem geklickt wurde.
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

/** Eine Karte in der Liste. Der Klick geht an das geteilte Panel, nicht an das Modul. */
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

/** Der Inhalt des Moduls: eine gefilterte Liste. Die Filter kommen von oben. */
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
        availableTags={["garten", "planung"]}
        availableTypes={[
          { id: "post", label: "Beiträge" },
          { id: "event", label: "Termine" },
          { id: "task", label: "Aufgaben" },
        ]}
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

/** Der Inhalt wechselt mit dem Modul — sonst führte ein Feld-Klick ins Leere. */
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
  title: "RLS/App Shell/Die Modulfläche",
  component: Modulflaeche,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj<typeof Modulflaeche>

/** Alles zusammen: Kopfzeile, Kopf der Fläche, Liste, geteiltes Panel. */
export const Default: Story = {}

/** Schmal: das Panel wird zum Drawer, die Module wandern nach unten. */
export const Schmal: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
}
