import type { MockConnectorSeed } from '@real-life/mock-connector'
import { GARDEN_IMAGE, WORKSHOP_IMAGE } from '../story-support/group-images'
export const seed: MockConnectorSeed = {
  users: [
    {
      id: 'mira',
      displayName: 'Mira Beispiel',
      avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
  ],
  // Gruppenbild und Module liegen unter `data`, wie bei den Connectoren (Spec 04):
  // der Space wählt aus dem Register, was er zeigt (Spec 01).
  groups: [
    { id: 'garden', name: 'Gemeinschaftsgarten', data: { image: GARDEN_IMAGE, modules: ['feed', 'calendar', 'map'] } },
    { id: 'workshop', name: 'Offene Werkstatt', data: { image: WORKSHOP_IMAGE, modules: ['collection'] } },
  ],
  groupMembers: { garden: ['mira'], workshop: ['mira'] },
  groupItems: { garden: ['harvest', 'watering'], workshop: ['repair'] },
  items: [
    {
      id: 'harvest',
      type: 'event',
      createdBy: 'mira',
      createdAt: '2026-09-01T10:00:00Z',
      data: {
        title: 'Erntefest',
        description:
          'Wir teilen unsere Ernte. Bring eine Schüssel und eine Idee mit.',
        start: '2026-09-19T14:00:00+02:00',
        end: '2026-09-19T18:00:00+02:00',
        address: 'Am Gemeinschaftsgarten',
        position: { type: 'Point', coordinates: [13.405, 52.52] },
      },
    },
    {
      id: 'watering',
      type: 'task',
      createdBy: 'mira',
      createdAt: '2026-09-02T10:00:00Z',
      data: {
        title: 'Beete gießen',
        description: 'Wer übernimmt die Abendrunde?',
        status: 'open',
      },
    },
    {
      id: 'repair',
      type: 'event',
      createdBy: 'mira',
      createdAt: '2026-09-03T10:00:00Z',
      data: {
        title: 'Reparaturtreff',
        description: 'Gemeinsam Dinge wieder nutzbar machen.',
        start: '2026-09-20T10:00:00+02:00',
        position: { type: 'Point', coordinates: [13.41, 52.522] },
      },
    },
  ],
}

/**
 * Derselbe Bestand auf Englisch: Die Startseite und das Handbuch betten den Garten in der Sprache der Seite ein
 * (Storybook-Global `language`). Nur die Texte wechseln, Ids, Zeiten und Orte bleiben gleich.
 */
const EN: Record<string, string> = {
  'Mira Beispiel': 'Mira Example',
  Gemeinschaftsgarten: 'Community garden',
  'Offene Werkstatt': 'Open workshop',
  Erntefest: 'Harvest festival',
  'Wir teilen unsere Ernte. Bring eine Schüssel und eine Idee mit.': 'We share our harvest. Bring a bowl and an idea.',
  'Am Gemeinschaftsgarten': 'At the community garden',
  'Beete gießen': 'Water the beds',
  'Wer übernimmt die Abendrunde?': 'Who takes the evening round?',
  Reparaturtreff: 'Repair meetup',
  'Gemeinsam Dinge wieder nutzbar machen.': 'Making things usable again, together.',
}
const KEYS = new Set(['displayName', 'name', 'title', 'description', 'address'])
function translate<T>(value: T, key?: string): T {
  if (typeof value === 'string') return (key && KEYS.has(key) ? EN[value] ?? value : value) as T
  if (Array.isArray(value)) return value.map((v) => translate(v)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, translate(v, k)])) as T
  }
  return value
}
export const seedEn: MockConnectorSeed = translate(seed)

/** Der Bestand in der Sprache der Vorschau: Deutsch nur bei `de`, sonst Englisch. */
export function gardenSeed(language: string | undefined): MockConnectorSeed {
  return language === 'de' ? seed : seedEn
}
