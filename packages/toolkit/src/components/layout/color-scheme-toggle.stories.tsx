import type { Meta, StoryObj } from '@storybook/react-vite'
import { Navbar, NavbarEnd, NavbarStart } from './navbar'
import { ColorSchemeToggle } from './color-scheme-toggle'
import { UserMenu } from './user-menu'
import { WorkspaceSwitcher } from './workspace-switcher'
import { ActivityBell } from '../activity/activity-bell'
import { STORY_ME, STORY_SEED, StoryWorld } from '../../story-support/story-world'

/**
 * **ColorSchemeToggle** switches between light and dark. It sets both signals
 * on the root element — the `dark` class (Tailwind, the map) and `data-theme`
 * (stylesheets keyed on the attribute) — remembers a deliberate choice per
 * browser, and follows the system setting as long as nothing was chosen,
 * including when the system changes later. Merely showing it writes nothing.
 *
 * The frame places it in `NavbarEnd`, between the bell and the user menu; an
 * app does not build its own. The icon reads the class, so it stays right when
 * something else sets the scheme (the app start, this toolbar).
 *
 * The stories remember their choice under their own storage key
 * (`rls-theme-story`), so a click here is not carried into the instance-wide
 * key that apps on the same origin read.
 */
const meta: Meta<typeof ColorSchemeToggle> = {
  id: 'rls-app-shell-navigation-color-scheme-toggle',
  title: 'RLS/App shell/Navigation/ColorSchemeToggle',
  component: ColorSchemeToggle,
  tags: ['autodocs'],
  args: { storageKey: 'rls-theme-story' },
}

export default meta
type Story = StoryObj<typeof ColorSchemeToggle>

/** The button alone. Click it: class, `data-theme` and the icon flip together. */
export const Default: Story = {
  name: 'Toggle',
}

/** In place: right in the header, as the frame puts it. */
export const InNavbar: Story = {
  name: 'In the header',
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
  render: (args) => (
    <Navbar>
      <NavbarStart>
        <WorkspaceSwitcher workspaces={STORY_SEED.groups} activeWorkspace={STORY_SEED.groups[0]} onWorkspaceChange={() => {}} />
      </NavbarStart>
      <NavbarEnd>
        <ActivityBell open={false} onOpenChange={() => {}} />
        <ColorSchemeToggle {...args} />
        <UserMenu user={STORY_ME} onProfile={() => {}} />
      </NavbarEnd>
    </Navbar>
  ),
}
