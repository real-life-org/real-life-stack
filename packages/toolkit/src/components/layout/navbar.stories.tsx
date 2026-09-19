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
 * Die Kopfzeile ist ein Gerüst aus drei Fächern, nichts weiter: links der
 * Space, in der Mitte die Module, rechts die Person. Womit die App sie füllt,
 * steht nicht im Belieben des Moduls — es sind immer dieselben drei Bausteine
 * (`WorkspaceSwitcher`, `ModuleTabs`, `UserMenu`), und genau die zeigen diese
 * Stories. Die Anmeldung läuft vor der Hülle über den `AuthScreen`, nie als
 * Knopf in der Kopfzeile.
 */

const MODULES = [
  { id: 'feed', label: 'Feed', icon: Newspaper },
  { id: 'map', label: 'Karte', icon: MapIcon },
  { id: 'calendar', label: 'Kalender', icon: Calendar },
]

const meta: Meta<typeof Navbar> = {
  id: 'rls-app-shell-navigation-navbar',
  title: 'RLS/App Shell/Navigation/Navbar',
  component: Navbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj<typeof Navbar>

/** Voll besetzt, wie in der Referenz-App. Alle drei Fächer sind bedienbar. */
export const Default: Story = {
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

/** Mit Verlaufs-Glocke rechts — so sieht die Kopfzeile aus, wenn die App das Aktivitätspanel führt. */
// Exportname bleibt, damit die alte Story-Kennung weiter auflöst
// (docs/reference/story-migration.json); der sichtbare Name sagt, was drin ist.
export const WithMenuButton: Story = {
  name: 'Mit Verlaufs-Glocke',
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

/** Schmal: die Modulreiter verschwinden, die Module wandern in die BottomNav. */
export const Simple: Story = {
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
