import type { Meta, StoryObj } from '@storybook/react-vite'
import { GardenDemo } from './garden'
const meta = {
  title: 'RLS/App/00 Community garden',
  id: 'rls-handbook-app',
  component: GardenDemo,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof GardenDemo>
export default meta
type Story = StoryObj<typeof meta>
export const Garden: Story = { name: '01 · From space to item' }
export const Calendar: Story = {
  name: '02 · The same item in the calendar',
  args: { initialModule: 'Kalender' },
}
export const ReadOnly: Story = {
  name: '03 · Without write capability',
  args: { readOnly: true },
}
