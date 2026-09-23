import type { MockConnectorSeed } from '@real-life-stack/mock-connector'
import { GARDEN_IMAGE, WORKSHOP_IMAGE } from '../story-support/group-images'
export const seed: MockConnectorSeed = {
  users: [
    {
      id: 'mira',
      displayName: 'Mira Beispiel',
      avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
  ],
  // Das Gruppenbild liegt unter `data.image`, wie bei den Connectoren (Spec 04).
  groups: [
    { id: 'garden', name: 'Gemeinschaftsgarten', data: { image: GARDEN_IMAGE } },
    { id: 'workshop', name: 'Offene Werkstatt', data: { image: WORKSHOP_IMAGE } },
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
        status: 'todo',
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
