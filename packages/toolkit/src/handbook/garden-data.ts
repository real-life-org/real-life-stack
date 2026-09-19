import type { MockConnectorSeed } from '@real-life-stack/mock-connector'
export const seed: MockConnectorSeed = {
  users: [{ id: 'mira', displayName: 'Mira Beispiel' }],
  groups: [
    { id: 'garden', name: 'Gemeinschaftsgarten' },
    { id: 'workshop', name: 'Offene Werkstatt' },
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
        content:
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
        content: 'Wer übernimmt die Abendrunde?',
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
        content: 'Gemeinsam Dinge wieder nutzbar machen.',
        start: '2026-09-20T10:00:00+02:00',
        position: { type: 'Point', coordinates: [13.41, 52.522] },
      },
    },
  ],
}
