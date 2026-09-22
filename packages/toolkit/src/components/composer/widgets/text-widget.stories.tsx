import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { TextWidget } from "./text-widget"

/**
 * **TextWidget** is the text field of the composer: Markdown in, a preview
 * next to it, and the toggles that add further widgets (date, place, people)
 * to a form. Which widgets a type offers is said by the type register
 * (`composerWidgets`); the widget itself is the same for every type.
 */
const meta: Meta<typeof TextWidget> = {
  id: "rls-module-components-widgets-textwidget",
  title: "RLS/Items/Field widgets/TextWidget",
  component: TextWidget,
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
type Story = StoryObj<typeof TextWidget>

function TextWidgetControlled(props: React.ComponentProps<typeof TextWidget>) {
  const [value, setValue] = useState(props.value)
  return <TextWidget {...props} value={value} onChange={setValue} />
}

export const Default: Story = {
  name: "Empty",
  render: () => (
    <TextWidgetControlled value="" onChange={() => {}} label="Beschreibung" />
  ),
}

export const MitInhalt: Story = {
  name: "With content",
  render: () => (
    <TextWidgetControlled
      value={`# Ueberschrift\n\nEin Absatz mit **fettem** und *kursivem* Text.\n\n## Unterueberschrift\n\n- Punkt eins\n- Punkt zwei\n- Punkt drei\n\n> Ein Zitat als Blockquote`}
      onChange={() => {}}
      label="Beschreibung"
    />
  ),
}

export const MitWidgetToggles: Story = {
  name: "With widget toggles",
  render: () => (
    <TextWidgetControlled
      value=""
      onChange={() => {}}
      label="Schreibe etwas..."
      availableWidgets={["media", "date", "location", "people", "tags"]}
      onToggleWidget={(w) => console.log("Toggle widget:", w)}
    />
  ),
}
