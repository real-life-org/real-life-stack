import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Calendar, CheckSquare, MapPin, Search, User } from "lucide-react"
import { FilterBar } from "./filter-bar"
import { FilterSection, FilterToggle, FilterMultiSelect } from "./filter-building-blocks"
import { emptyFilterBarValue, type FilterBarValue, type FilterTypeOption } from "./types"
import { Input } from "../primitives/input"

const TAGS = ["garten", "permakultur", "workshop", "infrastruktur", "planung"]

const TYPES: FilterTypeOption[] = [
  { id: "event", label: "Event", icon: Calendar },
  { id: "task", label: "Task", icon: CheckSquare },
  { id: "place", label: "Ort", icon: MapPin },
  { id: "person", label: "Profil", icon: User },
]

/**
 * **FilterBar** is the shared search and filter of every module surface:
 * search in the header, a filter pill bottom left, the filter card behind it
 * with tags and types, active values as chips. The host renders it once per
 * surface and applies the value to the items before a module sees them (spec
 * 01, rule 2a) — no module builds this itself.
 *
 * A module adds what only means something to it: a toggle in the drawer
 * (`drawerExtra`), a chip for an active extra (`chipsExtra`), an action next to
 * the search (`trailingActions`). The building blocks for that are under
 * [Filter building blocks](?path=/docs/rls-modules-filter-building-blocks--docs).
 *
 * Available tags and types come from the space's vocabulary, never from a list
 * in the module; with no tags in the current items the section stays empty.
 */
const meta: Meta<typeof FilterBar> = {
  id: "rls-modules-search-and-filter",
  tags: ["autodocs"],
  title: "RLS/Modules/Shared tools/Search and filter",
  component: FilterBar,
  decorators: [
    (Story) => (
      <div className="max-w-3xl mx-auto p-6 bg-background space-y-4">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof FilterBar>

function Wrapper({ initial = emptyFilterBarValue, extraDrawer, extraChips, trailing }: {
  initial?: FilterBarValue
  extraDrawer?: (value: FilterBarValue, setValue: (v: FilterBarValue) => void) => React.ReactNode
  extraChips?: React.ReactNode
  trailing?: React.ReactNode
}) {
  const [value, setValue] = useState<FilterBarValue>(initial)
  return (
    <>
      <FilterBar
        value={value}
        onChange={setValue}
        availableTags={TAGS}
        availableTypes={TYPES}
        drawerExtra={extraDrawer?.(value, setValue)}
        chipsExtra={extraChips}
        trailingActions={trailing}
      />
      <pre className="mt-4 rounded bg-muted/40 p-3 text-xs text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </>
  )
}

export const Default: Story = {
  name: "Search, pill, card",
  render: () => <Wrapper />,
}

export const PreSelected: Story = {
  name: "With pre-selected tags and types",
  render: () => <Wrapper initial={{ tags: ["garten"], types: ["event"] }} />,
}

export const KanbanShape: Story = {
  name: "Module extras — Kanban-style (toggle in drawer)",
  render: () => {
    function KanbanExtras({ value, setValue }: { value: FilterBarValue; setValue: (v: FilterBarValue) => void }) {
      void value
      void setValue
      // The Kanban-extras live in caller-state; here we just demo the UI.
      const [myItemsOnly, setMyItemsOnly] = useState(false)
      return (
        <FilterSection label="Schnellfilter">
          <FilterToggle
            label="Nur meine Aufgaben"
            value={myItemsOnly}
            onChange={setMyItemsOnly}
          />
        </FilterSection>
      )
    }
    return (
      <Wrapper
        extraDrawer={(value, setValue) => (
          <KanbanExtras value={value} setValue={setValue} />
        )}
      />
    )
  },
}

export const CalendarShape: Story = {
  name: "Module extras — Calendar location filter",
  render: () => {
    function LocationExtras() {
      const [loc, setLoc] = useState<string[]>([])
      return (
        <FilterSection label="Ort">
          <FilterMultiSelect
            options={[
              { id: "with", label: "Mit Ort" },
              { id: "without", label: "Ohne Ort" },
            ]}
            value={loc}
            onChange={setLoc}
          />
        </FilterSection>
      )
    }
    return <Wrapper extraDrawer={() => <LocationExtras />} />
  },
}

export const WithSearchLeading: Story = {
  name: "With Search next to Filter (Feed/Map/Calendar pattern)",
  render: () => {
    function WithSearch() {
      const [value, setValue] = useState<FilterBarValue>(emptyFilterBarValue)
      const [searchText, setSearchText] = useState("")
      return (
        <>
          <FilterBar
            value={value}
            onChange={setValue}
            availableTags={TAGS}
            availableTypes={TYPES}
            leadingActions={
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Suche…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 w-40 pl-7 text-xs"
                />
              </div>
            }
          />
          <pre className="mt-4 rounded bg-muted/40 p-3 text-xs text-muted-foreground">
            {JSON.stringify({ filter: value, searchText }, null, 2)}
          </pre>
        </>
      )
    }
    return <WithSearch />
  },
}

export const NoAvailableTags: Story = {
  name: "Empty state — no tags in current items",
  render: () => {
    const [value, setValue] = useState<FilterBarValue>(emptyFilterBarValue)
    return (
      <FilterBar
        value={value}
        onChange={setValue}
        availableTags={[]}
        availableTypes={TYPES}
      />
    )
  },
}
