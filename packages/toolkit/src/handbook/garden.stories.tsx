import type { Meta, StoryObj } from '@storybook/react-vite'
import { GardenDemo } from './garden'
const meta = {
  title: 'RLS/App/00 Gemeinschaftsgarten',
  id: 'rls-handbook-app',
  component: GardenDemo,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof GardenDemo>
export default meta
type Story = StoryObj<typeof meta>
export const Garden: Story = { name: '01 · Vom Space zum Item' }
export const Calendar: Story = {
  name: '02 · Dasselbe Item im Kalender',
  args: { initialModule: 'Kalender' },
}
export const ReadOnly: Story = {
  name: '03 · Ohne Schreibfähigkeit',
  args: { readOnly: true },
}
