import type { Meta, StoryObj } from "@storybook/react-vite"
import { RelativeTime } from "./relative-time"

/**
 * **RelativeTime** renders a timestamp the way people read it — "gerade eben",
 * "vor 3 Std.", "gestern", then the date — and keeps the exact time in the
 * tooltip. Every card and every comment uses it, so time reads the same
 * everywhere. Output is German until the toolkit texts are translated.
 */
const meta: Meta<typeof RelativeTime> = {
  id: "rls-primitives-relativetime",
  title: "RLS/Foundations/UI primitives/RelativeTime",
  component: RelativeTime,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof RelativeTime>

export const JustNow: Story = {
  name: "Just now",
  args: {
    date: new Date(Date.now() - 10_000).toISOString(),
  },
}

export const Minutes: Story = {
  name: "5 minutes ago",
  args: {
    date: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
}

export const Hours: Story = {
  name: "3 hours ago",
  args: {
    date: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
}

export const Yesterday: Story = {
  name: "Yesterday",
  args: {
    date: new Date(Date.now() - 24 * 3_600_000).toISOString(),
  },
}

export const Days: Story = {
  name: "4 days ago",
  args: {
    date: new Date(Date.now() - 4 * 24 * 3_600_000).toISOString(),
  },
}

export const OlderSameYear: Story = {
  name: "Older date, same year",
  args: {
    date: new Date(new Date().getFullYear(), 0, 15).toISOString(),
  },
}

export const DifferentYear: Story = {
  name: "Anderes Jahr",
  args: {
    date: "2024-06-10T14:30:00Z",
  },
}

export const AllVariants: Story = {
  name: "Alle Varianten",
  render: () => {
    const now = Date.now()
    const variants = [
      { label: "10 Sekunden", date: new Date(now - 10_000).toISOString() },
      { label: "3 Minuten", date: new Date(now - 3 * 60_000).toISOString() },
      { label: "45 Minuten", date: new Date(now - 45 * 60_000).toISOString() },
      { label: "2 Stunden", date: new Date(now - 2 * 3_600_000).toISOString() },
      { label: "1 Tag", date: new Date(now - 24 * 3_600_000).toISOString() },
      { label: "3 Tage", date: new Date(now - 3 * 24 * 3_600_000).toISOString() },
      { label: "2 Wochen", date: new Date(now - 14 * 24 * 3_600_000).toISOString() },
      { label: "Anderes Jahr", date: "2024-06-10T14:30:00Z" },
    ]

    return (
      <table className="text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pr-8 pb-2">Alter</th>
            <th className="pr-8 pb-2">Anzeige</th>
            <th className="pb-2">Tooltip (hovern)</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.label}>
              <td className="pr-8 py-1 text-muted-foreground">{v.label}</td>
              <td className="pr-8 py-1"><RelativeTime date={v.date} /></td>
              <td className="py-1 text-xs text-muted-foreground">{v.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
}
