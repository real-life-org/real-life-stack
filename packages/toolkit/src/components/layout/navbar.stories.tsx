import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calendar, Map as MapIcon, Newspaper } from 'lucide-react'
import { Navbar, NavbarStart, NavbarCenter, NavbarEnd } from './navbar'
import { WorkspaceSwitcher } from './workspace-switcher'
import { ModuleTabs } from './module-tabs'
import { UserMenu } from './user-menu'
import { ActivityBell } from '../activity/activity-bell'
import { STORY_ME, STORY_SEED, StoryWorld } from '../../story-support/story-world'

/**
 * **Navbar** is a scaffold of three compartments, nothing more: the space on
 * the left, the modules in the middle, the person on the right. What fills
 * them is not up to a module — it is always the same three building blocks
 * (`WorkspaceSwitcher`, `ModuleTabs`, `UserMenu`), placed by the frame, and
 * exactly those are shown here. Sign-in happens before the shell through the
 * `AuthScreen`, never as a button in the header.
 */

const MODULES = [
  { id: 'feed', label: 'Feed', icon: Newspaper },
  { id: 'map', label: 'Karte', icon: MapIcon },
  { id: 'calendar', label: 'Kalender', icon: Calendar },
]

const meta: Meta<typeof Navbar> = {
  id: 'rls-app-shell-navbar',
  title: 'RLS/App shell/Navigation/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj<typeof Navbar>

/** Fully staffed, as in the reference app. All three compartments work. */
export const Default: Story = {
  name: "Fully staffed",
  render: function Render() {
    const [space, setSpace] = useState(STORY_SEED.groups[0])
    const [module, setModule] = useState('feed')
    return (
      <Navbar>
        <NavbarStart>
          <WorkspaceSwitcher workspaces={STORY_SEED.groups} activeWorkspace={space} onWorkspaceChange={setSpace} />
        </NavbarStart>
        <NavbarCenter>
          <ModuleTabs modules={MODULES} activeModule={module} onModuleChange={setModule} />
        </NavbarCenter>
        <NavbarEnd>
          <UserMenu user={STORY_ME} onProfile={() => {}} />
        </NavbarEnd>
      </Navbar>
    )
  },
}

/** With the activity bell on the right — the header of an app that carries the activity panel. */
// Exportname bleibt, damit die alte Story-Kennung weiter auflöst
// (docs/reference/story-migration.json); der sichtbare Name sagt, was drin ist.
export const WithMenuButton: Story = {
  name: 'With activity bell',
  render: function Render() {
    const [space, setSpace] = useState(STORY_SEED.groups[0])
    const [module, setModule] = useState('map')
    const [bell, setBell] = useState(false)
    return (
      <Navbar>
        <NavbarStart>
          <WorkspaceSwitcher workspaces={STORY_SEED.groups} activeWorkspace={space} onWorkspaceChange={setSpace} />
        </NavbarStart>
        <NavbarCenter>
          <ModuleTabs modules={MODULES} activeModule={module} onModuleChange={setModule} />
        </NavbarCenter>
        <NavbarEnd>
          <ActivityBell open={bell} onOpenChange={setBell} />
          <UserMenu user={STORY_ME} onProfile={() => {}} />
        </NavbarEnd>
      </Navbar>
    )
  },
}

/** Narrow: the module tabs disappear, the modules move into the BottomNav. */
export const Simple: Story = {
  name: "Narrow",
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: function Render() {
    const [space, setSpace] = useState(STORY_SEED.groups[0])
    return (
      <Navbar>
        <NavbarStart>
          <WorkspaceSwitcher workspaces={STORY_SEED.groups} activeWorkspace={space} onWorkspaceChange={setSpace} />
        </NavbarStart>
        <NavbarEnd>
          <UserMenu user={STORY_ME} onProfile={() => {}} />
        </NavbarEnd>
      </Navbar>
    )
  },
}
