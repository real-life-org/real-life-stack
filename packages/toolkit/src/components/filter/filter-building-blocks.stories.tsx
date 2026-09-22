import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarDays, MapPin, Tag, User } from "lucide-react"
import { FilterChip, FilterMultiSelect, FilterSection, FilterToggle } from "./filter-building-blocks"

/**
 * **The building blocks a module composes its own filter section from.**
 *
 * The shared filter surface is the header's search, the filter pill bottom
 * left and the filter card behind it. Half of what is in that card is shared
 * (tags, types), the other half is the module's business — the calendar
 * filters by location, the kanban by assignment, the map by viewport.
 *
 * So that these module-owned sections look the same everywhere, no module
 * builds them itself: it composes them from these four parts — `FilterSection`,
 * `FilterMultiSelect`, `FilterToggle`, `FilterChip` — and hands them to the
 * bar as `drawerExtra`. Active values also go into the header's chip row as
 * `chipsExtra`, so you see them without opening the card.
 */

const meta: Meta = {
  id: "rls-module-filterbausteine",
  title: "RLS/Modules/Shared tools/Filter building blocks",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj

/** The four parts one by one, each with the sentence it answers. */
export const Bausteine: Story = {
  name: "The four parts",
  render: function Render() {
    const [tags, setTags] = useState<string[]>(["garten"])
    const [nurMeine, setNurMeine] = useState(false)
    const [mitOrt, setMitOrt] = useState(true)
    return (
      <div className="mx-auto max-w-sm space-y-6 rounded-xl border bg-card p-5">
        <FilterSection label="Tags">
          <FilterMultiSelect
            options={[
              { id: "garten", label: "garten" },
              { id: "planung", label: "planung" },
              { id: "werkstatt", label: "werkstatt" },
            ]}
            value={tags}
            onChange={setTags}
            emptyLabel="Alle Tags"
          />
        </FilterSection>
        <FilterSection label="Eigenes">
          <FilterToggle label="Nur meine" value={nurMeine} onChange={setNurMeine} icon={<User className="h-4 w-4" />} />
          <FilterToggle label="Nur mit Ort" value={mitOrt} onChange={setMitOrt} icon={<MapPin className="h-4 w-4" />} />
        </FilterSection>
        <FilterSection label="Aktiv">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <FilterChip key={t} label={t} icon={<Tag className="h-3.5 w-3.5" />} onRemove={() => setTags((v) => v.filter((x) => x !== t))} />
            ))}
            {nurMeine && <FilterChip label="Nur meine" icon={<User className="h-3.5 w-3.5" />} onRemove={() => setNurMeine(false)} />}
            {mitOrt && <FilterChip label="Nur mit Ort" icon={<MapPin className="h-3.5 w-3.5" />} onRemove={() => setMitOrt(false)} />}
            {!tags.length && !nurMeine && !mitOrt && <span className="text-sm text-muted-foreground">nichts gewählt</span>}
          </div>
        </FilterSection>
      </div>
    )
  },
}

/** What the module-owned part looks like that the calendar hands over as `drawerExtra`. */
export const AlsModulabschnitt: Story = {
  name: "As a module section",
  render: function Render() {
    const [orte, setOrte] = useState<string[]>([])
    const [nurMeine, setNurMeine] = useState(false)
    return (
      <div className="mx-auto max-w-sm space-y-5 rounded-xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          Kalender · eigene Abschnitte unter den geteilten
        </p>
        <FilterSection label="Ort">
          <FilterMultiSelect
            options={[
              { id: "garten", label: "Am Gemeinschaftsgarten" },
              { id: "werkstatt", label: "Offene Werkstatt" },
              { id: "online", label: "Online" },
            ]}
            value={orte}
            onChange={setOrte}
            emptyLabel="Alle Orte"
          />
        </FilterSection>
        <FilterSection label="Zeitraum">
          <FilterToggle label="Nur kommende" value={nurMeine} onChange={setNurMeine} icon={<CalendarDays className="h-4 w-4" />} />
        </FilterSection>
      </div>
    )
  },
}
