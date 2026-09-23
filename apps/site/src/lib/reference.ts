/**
 * Die Referenz der Site liest dieselben Quellen wie Storybook und llms.txt:
 * die Hook-Referenz (all-hooks.json, aus den TSDoc-Bloecken erzeugt), die
 * package.json der Pakete und den Spec-Index. Englisch, wie ihre Quellen.
 */
import hooksJson from '../../../../packages/toolkit/src/hooks/all-hooks.json'
import modulesJson from '../../../../packages/toolkit/src/lib/all-modules.json'
import { packages as readPackages, specDocs as readSpecDocs } from '../../../../scripts/agents/lib.mjs'

export const REPO = 'https://github.com/real-life-org/real-life-stack/blob/master/'
export const STORYBOOK = 'https://real-life-stack.de/storybook/'
export const storyUrl = (id: string) => `${STORYBOOK}?path=/${id.endsWith('--docs') ? 'docs' : 'story'}/${id}`

export interface Hook { name: string; signature: string; question: string; answers: string; without: string; stories: string[]; specs: string[]; source: string; line: number }
export interface HookGroup { id: string; title: string; hooks: Hook[] }
export const hookGroups: HookGroup[] = hooksJson.groups
export const hookCount = hookGroups.reduce((n, g) => n + g.hooks.length, 0)

export interface Pkg { name: string; version: string; description: string; dir: string }
export const packages: Pkg[] = readPackages()
export interface SpecDoc { label: string; href: string; status: string; description: string }
export const specDocs: SpecDoc[] = readSpecDocs()

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** `Text mit \`code\`` → HTML mit <code>; alles andere wird maskiert. */
export const inline = (text: string) => text.split('`').map((part, i) => (i % 2 ? `<code>${esc(part)}</code>` : esc(part))).join('')
/** Das Verhalten ohne Faehigkeit: festes Wort, optionale Notiz nach „—“ oder in Klammern. */
export function without(value: string) {
  const [head, ...rest] = value.split(/ — | \(/)
  const note = rest.join(' ').replace(/\)$/, '')
  const tone = head.startsWith('throws') ? 'throws' : head === '—' ? 'none' : 'soft'
  return { head, note, tone }
}

export interface ModuleRef { id: string; label: string; icon: string | null; view: string | null; enabledByDefault: boolean; fill: string; panelFit: string; maxWidth: string | null; keepMounted: boolean; presents: string[]; loads: string; options: Record<string, unknown>; hints: { name: string; key: string; filter: string }[]; story: string; storyFile: string | null; spec: string | null; intro: string }
export const modules: ModuleRef[] = modulesJson.modules as ModuleRef[]
/** Markdown-Fett im Storybook-Intro (`**The feed**`) → <strong>. */
export const intro = (text: string) => inline(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
