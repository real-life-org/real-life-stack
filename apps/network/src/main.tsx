import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { MockConnector, type MockConnectorSeed } from "@real-life-stack/mock-connector"

import App from "./App"
// Bindet das Register (Toolkit-Module + Marktplatz) — vor dem ersten Render,
// damit jede Fläche dasselbe Register liest (Spec 01).
import "./module-register"
import { buildDwebCampSeedItems } from "./data/network-seed"
import { NETWORK_RELATION_STORE_OPTIONS } from "./data/network-relation-predicates"
import "./index.css"
import "maplibre-gl/dist/maplibre-gl.css"

const DWEB_CAMP_GROUP_ID = "dwebcamp"
const PERSONAL_GROUP_ID = "privat"
const LOCAL_USER_ID = "did:example:network-local-user"

async function bootstrap() {
  const dwebCampSeedItems = await buildDwebCampSeedItems()
  const networkSeed: MockConnectorSeed = {
    items: [],
    groups: [
      {
        id: DWEB_CAMP_GROUP_ID,
        name: "DWebCamp",
        // Welche Module der Space führt — Reihenfolge = Tab-Reihenfolge.
        data: { scope: "group", primaryColor: "#c98500", modules: ["graph", "collection", "kanban", "calendar", "map", "marketplace"] },
      },
      {
        id: PERSONAL_GROUP_ID,
        name: "Privat",
        data: { scope: "personal", primaryColor: "#2a78d6", modules: ["collection", "graph"] },
      },
    ],
    users: [{ id: LOCAL_USER_ID, displayName: "Mein Profil" }],
    groupMembers: {
      [DWEB_CAMP_GROUP_ID]: [LOCAL_USER_ID],
      [PERSONAL_GROUP_ID]: [LOCAL_USER_ID],
    },
    groupItems: {
      [DWEB_CAMP_GROUP_ID]: [],
      [PERSONAL_GROUP_ID]: [],
    },
  }
  const connector = new MockConnector(networkSeed, {
    symmetricRelationPredicates: NETWORK_RELATION_STORE_OPTIONS.symmetricPredicates,
    // Demo app with foreign-authored seed data injected at runtime — the
    // marked fixture mode (spec 08): no authoritative claim verdict.
    allowFixtureAuthors: true,
  })
  await connector.init()
  connector.injectSeedItems(dwebCampSeedItems, DWEB_CAMP_GROUP_ID)
  connector.setCurrentGroup(DWEB_CAMP_GROUP_ID)

  if (import.meta.hot) {
    import.meta.hot.dispose(() => void connector.dispose())
  }

  // Der Fokus lebt in der URL (Spec 01, Der Modul-Host): `/{space}/{modul}/{item}`.
  const router = createBrowserRouter([{ path: "*", element: <App connector={connector} /> }])

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void bootstrap()
