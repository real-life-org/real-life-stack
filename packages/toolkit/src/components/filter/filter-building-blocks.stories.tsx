import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CalendarDays, MapPin, Tag, User } from "lucide-react"
import { FilterChip, FilterMultiSelect, FilterSection, FilterToggle } from "./filter-building-blocks"

/**
 * **Die Bausteine, aus denen ein Modul seinen Filter baut.**
 *
 * Die gemeinsame Filterfläche ist `ModuleToolbar`: Suche im Kopf, Filterpille
 * unten links, Filterkarte dahinter. Was in dieser Karte steht, ist zur Hälfte
 * geteilt (Tags, Typen) und zur Hälfte Sache des Moduls — der Kalender filtert
 * nach Ort, das Kanban nach Spalte, die Karte nach Ausschnitt.
 *
 * Damit diese modul-eigenen Abschnitte überall gleich aussehen, baut sie kein
 * Modul selbst, sondern setzt sie aus diesen vier Teilen zusammen und reicht
 * sie als `drawerExtra` an die Leiste. Aktive Werte gehen zusätzlich als
 * `chipsExtra` in die Chip-Zeile des Kopfes, damit man sie sieht, ohne die
 * Karte zu öffnen.
 */

const meta: Meta = {
  id: "rls-module-filterbausteine",
  title: "RLS/Modules/Shared tools/Filter building blocks",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj

/** Die vier Teile einzeln, jeder mit dem Satz, den er beantwortet. */
export const Bausteine: Story = {
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

/** So sieht der modul-eigene Teil aus, den der Kalender als `drawerExtra` durchreicht. */
export const AlsModulabschnitt: Story = {
  name: "Als Modulabschnitt",
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
