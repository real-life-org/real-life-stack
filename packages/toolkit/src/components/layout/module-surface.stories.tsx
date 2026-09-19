import { useState } from "react"
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
 *           ModuleToolbar     Suche und Filterpille — der einzige Ort dafür
 *           <Inhalt des Moduls>
 *     BottomNav               dieselben Module, schmal
 * ```
 *
 * Diese Stories zeigen genau das, an echten Daten. Ein Klick auf eine Karte
 * öffnet die Detailansicht im geteilten Panel; die Suche oben filtert die
 * Liste; auf schmalen Schirmen wird das Panel zum Drawer und die Modulreiter
 * zur unteren Leiste.
 */

const MODULES = [
  { id: "feed", label: "Feed", icon: Newspaper },
  { id: "map", label: "Karte", icon: MapIcon },
  { id: "calendar", label: "Kalender", icon: Calendar },
]

const mapping = createComposerMapping([
  { id: "post", label: "Beitrag", defaultWidgets: ["title", "text", "tags"] },
  { id: "event", label: "Termin", defaultWidgets: ["title", "text", "date"] },
  { id: "task", label: "Aufgabe", defaultWidgets: ["title", "text"] },
])

/** Eine Karte in der Liste. Der Klick geht an das geteilte Panel, nicht an das Modul. */
function Karte({ itemId }: { itemId: string }) {
  const { data: items } = useItems()
  const { data: members } = useMembers(null)
  const item = items.find((i) => i.id === itemId)
  const author = useItemAuthor(item, members)
  const panel = useModulePanel()
  if (!item) return null
  return (
    <ItemPreview
      item={item}
      author={author}
      active={panel.current?.itemId === item.id}
      headerAdornment={<ItemTypeBadge type={item.type} />}
      metaAdornment={<ItemMetaRow item={item} />}
      onClick={() =>
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
    />
  )
}

/** Der Inhalt des Moduls: eine gefilterte Liste. Die Filter kommen von oben. */
function FeedInhalt() {
  const { data: items } = useItems()
  const sichtbar = items.filter((item) => isAggregateVisibleItemType(item.type))
  const gefiltert = useModuleFilteredItems(sichtbar)
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4">
      {gefiltert.map((item) => (
        <Karte key={item.id} itemId={item.id} />
      ))}
      {gefiltert.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Nichts passt zur Suche.</p>
      )}
    </div>
  )
}

function Modulflaeche() {
  const [space, setSpace] = useState(STORY_SEED.groups[0])
  const [module, setModule] = useState("feed")
  return (
    <FilterProvider>
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
            <ModuleFrame fill="container" maxWidth="48rem">
              <ModuleToolbar
                searchLabel="Im Gemeinschaftsgarten suchen"
                availableTags={["garten", "planung"]}
                availableTypes={[
                  { id: "post", label: "Beiträge" },
                  { id: "event", label: "Termine" },
                  { id: "task", label: "Aufgaben" },
                ]}
              />
              <FeedInhalt />
            </ModuleFrame>
          </AppShellMain>
        </ModulePanelProvider>
        <BottomNav items={MODULES} activeItem={module} onItemChange={setModule} />
      </AppShell>
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
