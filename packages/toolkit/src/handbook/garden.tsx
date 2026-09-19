import { useEffect, useState } from 'react'
import { Calendar, Map as MapIcon, Newspaper } from 'lucide-react'
import { isWritable, type DataInterface } from '@real-life-stack/data-interface'
import { MockConnector } from '@real-life-stack/mock-connector'
import {
  AppShell,
  AppShellMain,
  Navbar,
  NavbarStart,
  NavbarCenter,
  NavbarEnd,
  WorkspaceSwitcher,
  UserMenu,
  ModuleTabs,
  BottomNav,
  AdaptivePanel,
} from '../components/layout'
import { ItemMetaRow } from '../components/preview/item-meta-row'
import { ItemTypeBadge } from '../components/preview/item-type-badge'
import { ItemPreview } from '../components/preview/item-preview'
import { ItemDetailBody } from '../components/detail/item-detail-body'
import { ItemDetailView } from '../components/detail/item-detail-view'
import type { ContentTypeConfig } from '../components/composer/content-composer'
import { createComposerMapping } from '../components/composer/composer-mapping'
import { CalendarView } from '../components/calendar/calendar-view'
import { MapView } from '../components/map/map-view'
import { MapLibreMapAdapter } from '../maplibre'
import { ConnectorProvider, useConnector } from '../hooks/connector-context'
import { useItems } from '../hooks/use-items'
import { seed } from './garden-data'

// This adapter intentionally exposes only the six DataInterface methods.
// Hiding a button alone would not demonstrate capability detection.
function reader(source: MockConnector): DataInterface {
  return {
    init: () => source.init(),
    dispose: () => source.dispose(),
    getItems: (f) => source.getItems(f),
    getItem: (id) => source.getItem(id),
    observe: (f) => source.observe(f),
    observeItem: (id) => source.observeItem(id),
  }
}
const mapStyle =
  'data:application/json,' +
  encodeURIComponent(
    JSON.stringify({
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#e4ece5' },
        },
      ],
    }),
  )
const createAdapter = () => new MapLibreMapAdapter()

// The three modules of this example, as the app shell lists them: tabs in the
// navbar on wide screens, the bottom bar on narrow ones.
const MODULES = [
  { id: 'Feed', label: 'Feed', icon: Newspaper },
  { id: 'Kalender', label: 'Kalender', icon: Calendar },
  { id: 'Karte', label: 'Karte', icon: MapIcon },
]

// The edit form shows title, text and date for every type of this example.
const contentTypeFor = (type: string): ContentTypeConfig => ({
  id: type,
  label: 'Inhalt',
  icon: Calendar,
  defaultWidgets: ['title', 'text', 'date'],
})
// Composer ↔ item comes from the toolkit; the garden only names its types.
const mapping = createComposerMapping(['event', 'task'].map(contentTypeFor))
export function GardenDemo({
  readOnly = false,
  initialModule = 'Feed',
}: {
  readOnly?: boolean
  initialModule?: string
}) {
  const [state, setState] = useState<{
    source: MockConnector
    connector: DataInterface
  }>()
  useEffect(() => {
    const source = new MockConnector(structuredClone(seed))
    let active = true
    source.setCurrentGroup('garden')
    source.init().then(() => {
      if (active)
        setState({ source, connector: readOnly ? reader(source) : source })
    })
    return () => {
      active = false
      void source.dispose()
    }
  }, [readOnly])
  if (!state) return <p role="status">Beispiel wird vorbereitet …</p>
  return (
    <ConnectorProvider connector={state.connector}>
      <Garden source={state.source} initialModule={initialModule} />
    </ConnectorProvider>
  )
}
function Garden({
  source,
  initialModule,
}: {
  source: MockConnector
  initialModule: string
}) {
  const connector = useConnector()
  const { data: items, isLoading } = useItems()
  const [space, setSpace] = useState(seed.groups[0])
  const [module, setModule] = useState(initialModule)
  const [selected, setSelected] = useState<string>()
  const [notice, setNotice] = useState('')
  const item = items.find((i) => i.id === selected)
  return (
    <AppShell>
      <Navbar>
        <NavbarStart>
          <WorkspaceSwitcher
            workspaces={seed.groups}
            activeWorkspace={space}
            onWorkspaceChange={(next) => {
              source.setCurrentGroup(next.id)
              setSpace(next)
              setSelected(undefined)
            }}
          />
        </NavbarStart>
        <NavbarCenter>
          <ModuleTabs
            modules={MODULES}
            activeModule={module}
            onModuleChange={setModule}
          />
        </NavbarCenter>
        <NavbarEnd>
          <UserMenu
            user={{ id: 'mira', name: 'Mira Beispiel' }}
            onProfile={() =>
              setNotice(
                'Mira Beispiel · fiktive Identität dieses Lernbeispiels',
              )
            }
          />
        </NavbarEnd>
      </Navbar>
      <div className="px-4 py-2 text-xs text-muted-foreground">
        Lernbeispiel · September 2026 ·{' '}
        {isWritable(connector)
          ? 'Änderungen nur für diese Sitzung'
          : 'Connector ohne Schreibfähigkeit'}
      </div>
      <AppShellMain className="relative" inset={module !== 'Karte'} withBottomNav={module !== 'Karte'}>
        {isLoading ? (
          <p role="status">Lädt …</p>
        ) : module === 'Feed' ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 overflow-auto p-4">
            <h1 className="text-2xl font-semibold">Was uns zusammenbringt</h1>
            <p className="text-muted-foreground">
              Ein Item. Mehrere Perspektiven.
            </p>
            {items.map((i) => (
              <ItemPreview
                key={i.id}
                item={i}
                author={seed.users[0]}
                headerAdornment={<ItemTypeBadge type={i.type} />}
                metaAdornment={<ItemMetaRow item={i} />}
                active={i.id === selected}
                onClick={() => {
                  setSelected(i.id)
                }}
              />
            ))}
          </div>
        ) : module === 'Kalender' ? (
          <CalendarView
            events={items}
            initialVisibleDate="2026-09-19"
            activeItemId={selected}
            onEventClick={(i) => {
              setSelected(i.id)
            }}
          />
        ) : (
          <MapView
            items={items}
            itemsLoading={false}
            inventoryKey={space.id}
            viewportMode="lens-auto-fit"
            createAdapter={createAdapter}
            initialView={{
              center: [13.405, 52.52],
              zoom: 13,
              tileSource: mapStyle,
            }}
            activeItemId={selected}
            focusedItem={item}
            onItemClick={(i) => {
              setSelected(i.id)
            }}
          />
        )}
      </AppShellMain>
      <BottomNav items={MODULES} activeItem={module} onItemChange={setModule} />
      <AdaptivePanel
        open={!!item}
        onClose={() => setSelected(undefined)}
        allowedModes={['floating', 'drawer']}
      >
        {item && (
          <ItemDetailView
            key={item.id}
            itemId={item.id}
            renderRead={(live, actions) => (
              <ItemDetailBody
                item={live}
                author={seed.users[0]}
                headerAdornment={<ItemTypeBadge type={live.type} />}
                actions={actions}
                meta={
                  typeof live.data.start === 'string' ? (
                    <ItemMetaRow item={live} />
                  ) : null
                }
              />
            )}
            contentTypes={[contentTypeFor(item.type)]}
            mapper={mapping.mapSubmission}
            editInitialData={mapping.editInitialData}
            composerProps={{ showVisibility: false }}
            onClose={() => setSelected(undefined)}
          />
        )}
      </AdaptivePanel>
      <AdaptivePanel
        open={!!notice}
        onClose={() => setNotice('')}
        allowedModes={['modal']}
      >
        <p className="p-6">{notice}</p>
      </AdaptivePanel>
    </AppShell>
  )
}
