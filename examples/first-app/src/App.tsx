import type { DataInterface } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { MapLibreAdapterProvider } from "@real-life-stack/toolkit/maplibre"
import { RoutedAppFrame } from "@real-life-stack/toolkit/router"

// Die App stellt drei Dinge: den Connector, die Karten-Engine und den Rahmen.
// Kopfzeile, Tabs, Panel, Erstellen, Detail und alle Module kommen aus dem Toolkit.
export function App({ connector }: { connector: DataInterface }) {
  return (
    <ConnectorProvider connector={connector}>
      <MapLibreAdapterProvider>
        <RoutedAppFrame fallbackModule="collection" />
      </MapLibreAdapterProvider>
    </ConnectorProvider>
  )
}
