import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { MockConnector } from "@real-life-stack/mock-connector"

import { App } from "./App"
import "./index.css"
import "maplibre-gl/dist/maplibre-gl.css"

async function start() {
  // Die Daten: ein Space, ein Mensch, ein Item — im Speicher, für den Anfang.
  const connector = new MockConnector({
    users: [{ id: "mira", displayName: "Mira" }],
    groups: [{ id: "garten", name: "Gemeinschaftsgarten", data: { modules: ["calendar", "map", "collection"] } }],
    groupMembers: { garten: ["mira"] },
    items: [{
      id: "erntefest", type: "event", createdBy: "mira", createdAt: "2026-09-01T10:00:00Z",
      data: { title: "Erntefest", content: "Wir teilen unsere Ernte.", start: "2026-09-26T14:00:00+02:00", position: { type: "Point", coordinates: [13.4, 52.5] } },
    }],
    groupItems: { garten: ["erntefest"] },
  })
  await connector.init()
  connector.setCurrentGroup("garten")

  // Die Adresse: /{space}/{modul}/{item} — der Rahmen liest sie, die App stellt nur den Router.
  const router = createBrowserRouter([{ path: "*", element: <App connector={connector} /> }])

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void start()
