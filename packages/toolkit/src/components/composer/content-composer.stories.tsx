import type { Meta, StoryObj } from "@storybook/react-vite"
import { ContentComposer, type ContentTypeConfig } from "./content-composer"
import {
  FileText,
  Calendar,
  CheckSquare,
  FolderOpen,
  Megaphone,
} from "lucide-react"

/**
 * **ContentComposer** is the form for creating and editing an item. It offers
 * the content types it is given — in the app all types of the space, from the
 * type register (spec 06) — and for each type the widgets that type declares:
 * title, text, date, place, status, people, tags, media. Create strips empty
 * defaults; edit starts from the existing data and treats an emptied field as
 * an intentional clear.
 *
 * In the app the composer is opened by the create host (sheet or fullscreen)
 * and by the detail's edit; here it stands alone so its modes and widgets can
 * be compared. What you submit here goes nowhere.
 *
 * Where next: how the host opens it under [Focus, panel, create](?path=/docs/rls-app-fokus--docs).
 */
const meta: Meta<typeof ContentComposer> = {
  id: "rls-module-components-contentcomposer",
  title: "RLS/Items/Create and edit/ContentComposer",
  component: ContentComposer,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-xl mx-auto p-4">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ContentComposer>

// ── Shared Configs ───────────────────────────────────────────────────────

const postType: ContentTypeConfig = {
  id: "post",
  label: "Post",
  icon: FileText,
  defaultWidgets: ["text"],
  submitLabel: "Posten",
}

const eventType: ContentTypeConfig = {
  id: "event",
  label: "Veranstaltung",
  icon: Calendar,
  defaultWidgets: ["title", "text", "date", "location", "people"],
  widgetLabels: {
    people: "Teilnehmer einladen",
  },
}

const taskType: ContentTypeConfig = {
  id: "task",
  label: "Task",
  icon: CheckSquare,
  defaultWidgets: ["group", "title", "text", "status", "people", "tags"],
  widgetLabels: {
    text: "Beschreibung",
    people: "Zugewiesen",
  },
  submitLabel: "Task erstellen",
  statusOptions: [
    { id: "open", label: "To Do" },
    {
      id: "in-progress",
      label: "In Arbeit",
      className: "bg-blue-100 text-blue-700",
    },
    {
      id: "done",
      label: "Erledigt",
      className: "bg-green-100 text-green-700",
    },
  ],
  defaultStatus: "open",
  groupOptions: [
    { id: "g1", name: "Klimagruppe" },
    { id: "g2", name: "Nachbarschaftshilfe" },
    { id: "g3", name: "Gemeinschaftsgarten" },
  ],
  defaultGroup: "g1",
}

/** Two people fields per type: "can do" and "wants to learn" (peopleRelations). */
const skillTaskType: ContentTypeConfig = {
  id: "skill-task",
  label: "Aufgabe mit Lernwunsch",
  icon: CheckSquare,
  defaultWidgets: ["title", "text", "people"],
  widgetLabels: { text: "Beschreibung" },
  peopleRelations: [
    { predicate: "assignedTo", label: "Kann ich" },
    { predicate: "wantsToLearn", label: "Will lernen" },
  ],
  submitLabel: "Aufgabe erstellen",
}

const projectType: ContentTypeConfig = {
  id: "project",
  label: "Projekt",
  icon: FolderOpen,
  defaultWidgets: ["title", "text", "people"],
  widgetLabels: {
    title: "Name",
    people: "Mitglieder einladen",
  },
}

const adType: ContentTypeConfig = {
  id: "ad",
  label: "Anzeige",
  icon: Megaphone,
  defaultWidgets: ["title", "text", "tags"],
}

const allTypes = [postType, eventType, taskType, projectType, adType]

const peopleOptions = [
  { id: "u1", name: "Anna Schmidt" },
  { id: "u2", name: "Max Mustermann" },
  { id: "u3", name: "Thomas Mueller" },
  { id: "u4", name: "Lisa Weber" },
  { id: "u5", name: "Jan Becker" },
  { id: "u6", name: "Sarah Koch" },
]

const peopleSuggestions = peopleOptions.map((p) => p.name)

const tagSuggestions = [
  "Wichtig",
  "Freizeit",
  "Projekt",
  "Idee",
  "Dringend",
  "Diskussion",
  "Planung",
]

// ── Action helpers ───────────────────────────────────────────────────────

const action =
  (name: string) =>
  (...args: unknown[]) =>
    console.log(`[${name}]`, ...args)

// ── Stories ──────────────────────────────────────────────────────────────

export const MultiTyp: Story = {
  name: "All types",
  args: {
    contentTypes: allTypes,
    onSubmit: action("onSubmit"),
    peopleSuggestions,
    tagSuggestions,
  },
}

export const PostOnly: Story = {
  name: "Post only",
  args: {
    contentTypes: [postType],
    onSubmit: action("onSubmit"),
    tagSuggestions,
  },
}

export const EventVorausgefuellt: Story = {
  name: "Event, prefilled",
  args: {
    contentTypes: allTypes,
    initialContentType: "event",
    initialData: {
      title: "Fruehlings-Pflanzaktion",
      start: "2026-03-28T10:00",
    },
    onSubmit: action("onSubmit"),
    peopleSuggestions,
  },
}

export const TaskEinzelTyp: Story = {
  name: "Task, single-type mode",
  args: {
    contentTypes: [taskType],
    mode: "task",
    showVisibility: false,
    showPreview: false,
    onSubmit: action("onSubmit"),
    peopleSuggestions,
    tagSuggestions,
    tagQuickSuggestions: tagSuggestions,
    peopleQuickSuggestions: peopleOptions,
  },
}

export const EditModus: Story = {
  name: "Edit mode",
  args: {
    contentTypes: [taskType],
    mode: "task",
    editMode: true,
    initialData: {
      group: "g2",
      title: "Beete umgraben",
      text: "Die **Hochbeete** im Gemeinschaftsgarten muessen fuer die Saison vorbereitet werden.",
      status: "in-progress",
      people: ["u1", "u2"],
      tags: ["Wichtig", "Projekt"],
    },
    showVisibility: false,
    showPreview: false,
    onSubmit: action("onSubmit"),
    onDelete: action("onDelete"),
    peopleOptions,
    tagSuggestions,
    tagQuickSuggestions: tagSuggestions,
    peopleQuickSuggestions: peopleOptions,
  },
}

export const MitAbbrechen: Story = {
  name: "With cancel button",
  args: {
    contentTypes: [postType],
    onSubmit: action("onSubmit"),
    onCancel: action("onCancel"),
    tagSuggestions,
  },
}

export const OhneVorschau: Story = {
  name: "Without preview, with visibility",
  args: {
    contentTypes: [postType],
    showVisibility: false,
    showPreview: false,
    onSubmit: action("onSubmit"),
  },
}

export const ProjektMitMedien: Story = {
  name: "Project with media widget",
  args: {
    contentTypes: [
      {
        ...projectType,
        defaultWidgets: ["title", "text", "media", "people"],
      },
    ],
    mode: "project",
    onSubmit: action("onSubmit"),
    peopleSuggestions,
  },
}

export const MitQuickSuggestions: Story = {
  name: "Quick suggestions: tags and people",
  args: {
    contentTypes: [taskType],
    mode: "task",
    showVisibility: false,
    initialData: {
      title: "Beispiel-Task",
      tags: ["Wichtig"],
      people: ["u1"],
    },
    onSubmit: action("onSubmit"),
    peopleOptions,
    tagSuggestions,
    tagQuickSuggestions: tagSuggestions,
    peopleQuickSuggestions: peopleOptions,
  },
}

export const ZweiPersonenfelder: Story = {
  name: "Two people fields",
  args: {
    contentTypes: [skillTaskType],
    mode: "skill-task",
    showVisibility: false,
    showPreview: false,
    initialData: {
      title: "Hochbeet bauen",
      people: ["u1"],
      "people:wantsToLearn": ["u2", "u3"],
    },
    onSubmit: action("onSubmit"),
    peopleOptions,
    peopleQuickSuggestions: peopleOptions,
  },
}
