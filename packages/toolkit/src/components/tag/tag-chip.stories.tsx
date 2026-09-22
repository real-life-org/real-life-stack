import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TagChip } from './tag-chip'

/**
 * **TagChip** is the one appearance of a tag: on the card, in the detail, in
 * the filter card and in the chip row of the header. Its colour is derived
 * from the tag's name, so the same tag looks the same on every surface. As a
 * picker it toggles; as an active filter it carries a remove button; a click
 * on a card's tag sets the shared filter (tag navigation).
 */
const meta: Meta<typeof TagChip> = {
  id: "rls-items-tag-chip",
  title: "RLS/Items/Detail view/Tags and author/TagChip",
  component: TagChip,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
}

export default meta
type Story = StoryObj<typeof TagChip>

const SAMPLE = ['garten', 'permakultur', 'workshop', 'bauen', 'musik', 'kochen']

export const Static: Story = {
  name: "On a card",
  args: { tag: 'garten' },
}

/** Deterministic palette — the same colours the preview cards use: a tag keeps its colour everywhere. */
export const Palette: Story = {
  name: "Palette",
  render: () => (
    <div className="flex flex-wrap gap-1.5">
      {SAMPLE.map((tag) => (
        <TagChip key={tag} tag={tag} />
      ))}
    </div>
  ),
}

/** Filter picker: toggleable, dimmed when unselected, ring when selected. */
export const Picker: Story = {
  name: "As a picker",
  render: () => {
    const [selected, setSelected] = useState<string[]>(['garten', 'workshop'])
    return (
      <div className="flex flex-wrap gap-1.5">
        {SAMPLE.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            size="md"
            selected={selected.includes(tag)}
            onToggle={() =>
              setSelected((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
              )
            }
          />
        ))}
      </div>
    )
  },
}

/** Active filter chips with a remove button. */
export const Removable: Story = {
  name: "As an active filter",
  render: () => {
    const [tags, setTags] = useState(['garten', 'permakultur', 'workshop'])
    return (
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            size="md"
            onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}
          />
        ))}
      </div>
    )
  },
}
