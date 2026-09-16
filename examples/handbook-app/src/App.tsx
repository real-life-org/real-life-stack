import { useEffect, useState } from 'react'
import { MockConnector } from '@real-life-stack/mock-connector'
import {
  ConnectorProvider,
  useItems,
  ItemPreview,
  ItemDetailBody,
  Button,
} from '@real-life-stack/toolkit'

export function App() {
  const [connector, setConnector] = useState<MockConnector>()
  useEffect(() => {
    const source = new MockConnector({
      users: [{ id: 'mira', displayName: 'Mira Beispiel' }],
      groups: [],
      groupMembers: {},
      items: [
        {
          id: 'harvest',
          type: 'event',
          createdBy: 'mira',
          createdAt: '2026-09-01T10:00:00Z',
          data: {
            title: 'Erntefest',
            content: 'Wir teilen unsere Ernte.',
            start: '2026-09-19T14:00:00+02:00',
          },
        },
      ],
    })
    let active = true
    source.init().then(() => {
      if (active) setConnector(source)
    })
    return () => {
      active = false
      void source.dispose()
    }
  }, [])
  if (!connector) return <p role="status">Lädt …</p>
  return (
    <ConnectorProvider connector={connector}>
      <Garden />
    </ConnectorProvider>
  )
}
function Garden() {
  const { data: items } = useItems()
  const [selected, select] = useState<string>()
  const item = items.find((i) => i.id === selected)
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Mein Gemeinschaftsgarten</h1>
      <p>Deine erste App mit veröffentlichten RLS-Paketen.</p>
      {item ? (
        <>
          <Button onClick={() => select(undefined)}>Zur Übersicht</Button>
          <ItemDetailBody item={item} />
        </>
      ) : (
        items.map((i) => (
          <ItemPreview key={i.id} item={i} onClick={() => select(i.id)} />
        ))
      )}
    </main>
  )
}
