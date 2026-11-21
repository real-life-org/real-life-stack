import type { Meta, StoryObj } from '@storybook/react-vite'
import { GardenDemo } from './garden'
const meta: Meta<typeof GardenDemo> = {
  title: 'RLS/App/00 Community garden',
  id: 'rls-app-00-community-garden',
  component: GardenDemo,
  parameters: { layout: 'fullscreen' },
  // Der Bestand folgt der Sprache der Vorschau (Global `language`), wie die Oberfläche
  render: (args, { globals }) => <GardenDemo {...args} language={globals.language === 'en' ? 'en' : 'de'} />,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof meta>
export const Garden: Story = { name: '01 · From space to item' }
export const Calendar: Story = {
  name: '02 · The same item in the calendar',
  args: { module: 'calendar' },
}
export const ReadOnly: Story = {
  name: '03 · Without write capability',
  args: { readOnly: true },
}
