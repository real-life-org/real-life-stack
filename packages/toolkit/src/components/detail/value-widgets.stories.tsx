import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { ItemDetailBody } from "./item-detail-body"
import { ItemDetailRead } from "../host/detail-host"
import { RegisterMeta } from "../preview/register-meta"
import type { FieldEntry } from "../preview/field-register"
import { ContentComposer, type ContentTypeConfig } from "../composer/content-composer"
import { createComposerMapping } from "../composer/composer-mapping"
import { valueFieldsFromRegister } from "../composer/value-fields"
import { composerWidgetsFromRegister } from "../preview/field-register"
import { StoryWorld } from "../../story-support/story-world"

/**
 * **Value widgets** (S4a; spec shared-components → „Item-Detail aus dem
 * Register", Widget-Paare B6–B10, B12; spec 06 → „Feld- und Kantenregister").
 * One widget per data type, not per field; label, unit and options come from
 * the register entry. An empty field makes no row.
 *
 * | Widget | Read (meta box) | Write (form) |
 * |---|---|---|
 * | B6 `status` | chip: the option's tone, else by role (done green, open neutral, active in the type tone) | segment (≤ 4 options), else a list |
 * | B7 `number` | „Aufwand 12 h · 300 €" — number fields with the same label share one row | one number field per value, side by side, unit inside |
 * | B8 `select` | chip in the type tone (or the option's tone) | segment (≤ 4), else dropdown; a second click clears |
 * | B9 `url` | link with globe, only http/https, `rel="noopener noreferrer"` | text field, checked; a bare domain gets `https://` |
 * | B10 `chips` | chip row after the label, capped „+N" by room | chips, suggestions, „+ eigenes" |
 * | B12 `contact` | value with „Anrufen" (`tel:`) or „E-Mail schreiben" (`mailto:`) | text field, checked, with who sees it |
 *
 * Profile, project and resource get their register in S6; these stories
 * declare the entries locally to show the widgets against the Detail
 * Simulator. Task status and the event link use the real toolkit register.
 */
const meta: Meta = {
  id: "rls-items-detail-values",
  title: "RLS/Items/Detail view/Values",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj

const at = (day: number) => `2026-09-${String(day).padStart(2, "0")}T10:00:00+02:00`

// Register-Einträge nach der Tabelle „Register je Typ" (Spec 06, nichtnormativ).
const PROFILE_FIELDS: FieldEntry[] = [
  { key: "address", widget: "location", pos: "meta", label: "Ort" },
  { key: "skills", widget: "chips", pos: "meta", label: "Kann" },
  { key: "offers", widget: "chips", pos: "meta", label: "Bietet" },
  { key: "needs", widget: "chips", pos: "meta", label: "Sucht" },
  { key: "phone", widget: "contact", pos: "meta", label: "Telefon" },
  { key: "email", widget: "contact", pos: "meta", label: "E-Mail" },
]
const PROJECT_FIELDS: FieldEntry[] = [
  { key: "website", widget: "url", pos: "meta", label: "Website" },
  { key: "repo", widget: "url", pos: "meta", label: "Repo" },
  { key: "address", widget: "location", pos: "meta", label: "Ort" },
]
const RESOURCE_FIELDS: FieldEntry[] = [
  {
    key: "kind",
    widget: "select",
    pos: "meta",
    label: "Art",
    options: [
      { id: "tool", label: "Werkzeug & Fahrzeug" },
      { id: "room", label: "Raum" },
      { id: "knowledge", label: "Wissen" },
      { id: "material", label: "Material" },
    ],
  },
  {
    key: "availability",
    widget: "select",
    pos: "meta",
    label: "Verfügbarkeit",
    options: [
      { id: "always", label: "Jederzeit" },
      { id: "weekdays", label: "Werktags" },
      { id: "weekend", label: "Am Wochenende" },
      { id: "evenings", label: "Abends" },
      { id: "ask", label: "Auf Anfrage" },
    ],
  },
]
const CARD_FIELDS: FieldEntry[] = [
  { key: "status", widget: "status", pos: "meta", label: "Stand", options: [{ id: "open", label: "Offen", role: "open" }, { id: "done", label: "Erledigt", role: "done" }] },
  { key: "hours", widget: "number", pos: "meta", label: "Aufwand", unit: "h", min: 0 },
  { key: "euros", widget: "number", pos: "meta", label: "Aufwand", unit: "€", min: 0 },
]
const GOAL_FIELDS: FieldEntry[] = [
  {
    key: "priority",
    widget: "select",
    pos: "meta",
    label: "Priorität",
    options: [
      { id: "high", label: "Priorität hoch", tone: "rose" },
      { id: "medium", label: "Priorität mittel", tone: "amber" },
      { id: "low", label: "Priorität niedrig" },
    ],
  },
]

const TONE = {
  person: "bg-violet-50 text-violet-700 border-violet-200",
  project: "bg-indigo-50 text-indigo-700 border-indigo-200",
  resource: "bg-teal-50 text-teal-700 border-teal-200",
  task: "bg-amber-50 text-amber-700 border-amber-200",
}

const LENA: Item = {
  id: "profil-lena",
  type: "person",
  createdAt: at(1),
  createdBy: "lea",
  data: {
    title: "Lena Krüger",
    address: "Neustrelitz",
    skills: ["Gärtnern", "Kinderbetreuung", "Anhänger fahren", "Kochen", "Imkern"],
    offers: ["Anhänger 750 kg", "Saatgut"],
    needs: ["Werkstattplatz"],
    phone: "+49 170 1234567",
    email: "lena@example.org",
  },
}
const GARTEN: Item = {
  id: "projekt-garten",
  type: "project",
  createdAt: at(1),
  createdBy: "mira",
  data: { title: "Gartenprojekt Neustrelitz", website: "https://gartenprojekt.org/", repo: "https://codeberg.org/garten", address: "Markthalle 7, Neustrelitz" },
}
const ANHAENGER: Item = {
  id: "ressource-anhaenger",
  type: "resource",
  createdAt: at(2),
  createdBy: "lea",
  data: { title: "Anhänger 750 kg", kind: "tool", availability: "weekend" },
}
const KARTE: Item = {
  id: "karte-meeting",
  type: "task",
  createdAt: at(3),
  createdBy: "mira",
  data: { title: "Real Life Auswertungs-Meeting im Sommer 2027", status: "open", hours: 12, euros: 300 },
}
const ZIEL: Item = { id: "ziel-team", type: "project", createdAt: at(3), createdBy: "mira", data: { title: "Team-Organisation", priority: "high" } }

/** Detail wie im Panel: Kopf, Meta-Box aus den Einträgen. */
function Detail({ item, fields, tone }: { item: Item; fields: FieldEntry[]; tone: string }) {
  return (
    <StoryWorld seed={{ items: [item] }}>
      <div className="w-[380px] overflow-hidden rounded-2xl border bg-background p-4 shadow-xl">
        <ItemDetailBody item={item} meta={<RegisterMeta item={item} fields={fields} typeTone={tone} />} />
      </div>
    </StoryWorld>
  )
}

/** Formular aus denselben Einträgen (Spec 06, Regel 16), vorbelegt wie beim Bearbeiten. */
function Edit({ item, fields, label }: { item: Item; fields: FieldEntry[]; label: string }) {
  const withTitle: FieldEntry[] = [{ key: "title", widget: "title", pos: "head" }, ...fields]
  const status = fields.find((f) => f.widget === "status")
  const config: ContentTypeConfig = {
    id: item.type,
    label,
    defaultWidgets: composerWidgetsFromRegister(withTitle),
    valueFields: valueFieldsFromRegister(fields),
    ...(status ? { statusOptions: status.options!.map((o) => ({ id: o.id, label: o.label })), widgetLabels: { status: status.label! } } : {}),
    groupOptions: [{ id: "garden", name: "Gartenprojekt" }],
    defaultGroup: "garden",
  }
  const { editInitialData } = createComposerMapping([config])
  return (
    <StoryWorld seed={{ items: [item] }}>
      <div className="w-[380px] rounded-2xl border bg-background p-4 shadow-xl">
        <ContentComposer contentTypes={[config]} mode={item.type} initialData={editInitialData(item)} editMode showPreview={false} onSubmit={() => {}} onCancel={() => {}} />
      </div>
    </StoryWorld>
  )
}

/** Profile: location, three chip rows („Kann" capped „+N"), phone and e-mail with their jumps. */
export const Profile: Story = { render: () => <Detail item={LENA} fields={PROFILE_FIELDS} tone={TONE.person} /> }
/** Profile form: chips with „+ eigenes", contact fields with who sees them. */
export const ProfileEdit: Story = { render: () => <Edit item={LENA} fields={PROFILE_FIELDS} label="Profil" /> }

/** Project: website and repo as safe links. */
export const Project: Story = { render: () => <Detail item={GARTEN} fields={PROJECT_FIELDS} tone={TONE.project} /> }
/** Project form: url fields, checked (try `javascript:`). */
export const ProjectEdit: Story = { render: () => <Edit item={GARTEN} fields={PROJECT_FIELDS} label="Projekt" /> }

/** Resource: kind as a chip in the type tone, availability as a chip. */
export const Resource: Story = { render: () => <Detail item={ANHAENGER} fields={RESOURCE_FIELDS} tone={TONE.resource} /> }
/** Resource form: four kinds as a segment, five availabilities as a dropdown. */
export const ResourceEdit: Story = { render: () => <Edit item={ANHAENGER} fields={RESOURCE_FIELDS} label="Ressource" /> }

/** Karabirrdt card: status „Offen" and „Aufwand 12 h · 300 €" — replaces the app's own AufwandWidget. */
export const KanbanCard: Story = { render: () => <Detail item={KARTE} fields={CARD_FIELDS} tone={TONE.task} /> }
/** Karabirrdt card form: status as a segment, hours and euros side by side. */
export const KanbanCardEdit: Story = { render: () => <Edit item={KARTE} fields={CARD_FIELDS} label="Karte" /> }

/** Karabirrdt goal: priority as a select with its own tones (decision 16: select instead of sticker dots). */
export const Goal: Story = { render: () => <Detail item={ZIEL} fields={GOAL_FIELDS} tone={TONE.project} /> }

const TASK: Item = { id: "task-kompost", type: "task", createdAt: at(3), createdBy: "jonas", data: { title: "Kompost umsetzen", status: "in-progress", start: at(25) } }
const ERNTEFEST: Item = {
  id: "event-ernte",
  type: "event",
  createdAt: at(4),
  createdBy: "mira",
  data: { title: "Gemeinsames Ernten am Beet", start: "2026-07-19T16:00:00+02:00", address: "Markthalle 7", meetingLink: "https://meet.jit.si/gartenprojekt" },
}

/** Toolkit register: the task's status as a chip („In Arbeit" in the type tone), and the event's `meetingLink` (B9). */
export const ToolkitRegister: Story = {
  render: () => (
    <StoryWorld trustRecords seed={{ items: [TASK, ERNTEFEST] }}>
      <div className="flex flex-col gap-4">
        <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
          <ItemDetailRead item={TASK} actions={null} groupId="garden" />
        </div>
        <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
          <ItemDetailRead item={ERNTEFEST} actions={null} groupId="garden" />
        </div>
      </div>
    </StoryWorld>
  ),
}
