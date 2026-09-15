import { describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import { byDeviceOf, flatRegistry } from "./helpers/registry-fixtures.js"
import { createFakeNamedRoots } from "./helpers/named-roots.js"
import type { MirrorRegistryRoot } from "../src/mirror/index.js"
import type { MirrorRegistryContribution, RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 09 §Ablage und Registry und Spec 12 Regel 9: der EINE Schreibpfad in die
 * Mirror-Registry des persoenlichen Space. Jedes Geraet schreibt nur unter
 * seinem eigenen `deviceId`-Schluessel, Eintraege werden NIE geloescht, und die
 * Aufnahme-Kennung wird nur beim Statuswechsel gesetzt, nie still nachgefuehrt.
 *
 * Die Ablage ist die benannte WURZEL `mirrorRegistry` des Home-Docs (Fassung
 * rls#354, Adapter-Capability `NamedRootsCapable`) — nicht der Doc-Baum unter
 * `data`.
 */

const DID = "did:key:z6MkAnton"
const DEVICE = "device-A"

function contribution(partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution {
  return { statusSeq: 1, status: "accepted", seq: 0, tiebreak: "", updatedAt: "2026-09-01T00:00:00.000Z", ...partial }
}

function fakeConnector(options: {
  registry?: MirrorRegistryRoot
  spaces?: Array<{ id: string; members?: string[]; admission?: { keyGeneration: number } }>
  deviceId?: string
} = {}) {
  const doc: RlsSpaceDoc = { _type: "rls", items: {} }
  const named = createFakeNamedRoots({ mirrorRegistry: { ...(options.registry ?? {}) } })
  const handle = {
    id: "home-space",
    getDoc: () => doc,
    transact: (fn: (d: RlsSpaceDoc) => void) => { fn(doc) },
    onRemoteUpdate: () => () => {},
    close: () => {},
    getRoot: named.getRoot,
    transactRoot: named.transactRoot,
    transactRootDurable: named.transactRootDurable,
  }
  const spaces = (options.spaces ?? []).map((space) => ({
    type: "shared", appTag: "rls", members: [DID], createdAt: "", ...space,
  }))
  const connector = Object.create(WotConnector.prototype) as any
  connector.identity = { getDid: () => DID }
  connector.privateSpaceId = "home-space"
  connector.homeHandle = handle
  connector.replication = {
    openSpace: vi.fn(async () => handle),
    watchSpaces: () => ({ getValue: () => spaces }),
  }
  connector.docLogStore = { resolveConnectDeviceId: async () => options.deviceId ?? DEVICE }
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  return { connector, doc, handle, named }
}

function registry(
  named: { roots: Record<string, Record<string, unknown>> },
  targetSpaceId: string,
): Record<string, MirrorRegistryContribution> {
  return byDeviceOf(named.roots.mirrorRegistry as MirrorRegistryRoot, DID, targetSpaceId)
}

describe("writeRegistryContribution — Spec 09 §Ablage und Registry", () => {
  it("schreibt ausschliesslich unter dem eigenen deviceId und laesst fremde Beitraege stehen", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { "device-B": contribution({ status: "pending", statusSeq: 3 }) } }),
      spaces: [{ id: "garten", admission: { keyGeneration: 2 } }],
    })

    await connector.writeRegistryContribution("garten", "accepted")

    const byDevice = registry(named, "garten")
    expect(Object.keys(byDevice).sort()).toEqual(["device-A", "device-B"])
    expect(byDevice["device-B"].status).toBe("pending")
  })

  it("schreibt in die WURZEL, nie in den Doc-Baum unter data", async () => {
    const { connector, doc, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })

    await connector.writeRegistryContribution("garten", "accepted")

    expect(Object.keys(named.roots.mirrorRegistry)).toHaveLength(1)
    expect((doc as Record<string, unknown>).mirrorRegistry).toBeUndefined()
  })

  it("eine Freigabe traegt die aktuelle Aufnahme-Kennung des Ziel-Space", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 7 } }] })

    await connector.writeRegistryContribution("garten", "accepted")

    expect(registry(named, "garten")[DEVICE].admission).toEqual({ keyGeneration: 7 })
  })

  it("eine Freigabe OHNE Kennung ist zulaessig, solange die Person Mitglied ist (09, Fassung #354)", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.writeRegistryContribution("alt", "accepted")

    const own = registry(named, "alt")[DEVICE]
    expect(own.status).toBe("accepted")
    expect(own.admission).toBeUndefined()
  })

  it("auch pending traegt bei einem Alt-Space keine Kennung", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.writeRegistryContribution("alt", "pending")

    expect(registry(named, "alt")[DEVICE]).toMatchObject({ status: "pending" })
    expect(registry(named, "alt")[DEVICE].admission).toBeUndefined()
  })

  it("abgelehnt wird nur, wenn die Person NICHT Mitglied des Ziel-Space ist", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "fremd", members: [] }] })

    await expect(connector.writeRegistryContribution("fremd", "accepted")).rejects.toThrow(/Mitglied/)
    expect(registry(named, "fremd")[DEVICE]).toBeUndefined()
  })

  it("ein unbekannter Ziel-Space ist keine Mitgliedschaft", async () => {
    const { connector } = fakeConnector({ spaces: [] })

    await expect(connector.writeRegistryContribution("unbekannt", "accepted")).rejects.toThrow(/Mitglied/)
  })

  it("ein Widerruf braucht keine Mitgliedschaft — genau dann ist er faellig (09 Inv. 11)", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 2 } }) } }),
      spaces: [],
    })

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(named, "garten")[DEVICE].status).toBe("revoked")
  })

  it("ein Widerruf traegt nie eine niedrigere Kennung als die Freigabe, die er widerruft", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 9 } }) } }),
      spaces: [{ id: "garten", admission: { keyGeneration: 4 } }],
    })

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(named, "garten")[DEVICE].admission).toEqual({ keyGeneration: 9 })
  })

  it("ein Widerruf ohne Kennung im Ziel-Space traegt die Kennung der Lesesicht (09 Inv. 11)", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 3 } }) } }),
      spaces: [],
    })

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(named, "garten")[DEVICE].admission).toEqual({ keyGeneration: 3 })
  })

  it("eine Freigabe deckt jeden beobachteten nicht-accepted Beitrag per supersedes ab", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, {
        garten: {
          "device-B": contribution({ status: "revoked", statusSeq: 5, admission: { keyGeneration: 2 } }),
          "device-C": contribution({ status: "pending", statusSeq: 2, admission: { keyGeneration: 2 } }),
        },
      }),
      spaces: [{ id: "garten", admission: { keyGeneration: 2 } }],
    })

    await connector.writeRegistryContribution("garten", "accepted")

    const own = registry(named, "garten")[DEVICE]
    expect(own.supersedes).toEqual({ "device-B": 5, "device-C": 2 })
    expect(own.statusSeq).toBe(6)
  })

  it("ein Widerruf traegt kein supersedes (nur eine Freigabe loest ab)", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })
    await connector.writeRegistryContribution("garten", "pending")

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(named, "garten")[DEVICE].supersedes).toBeUndefined()
  })

  it("laesst seq und publishedHash unberuehrt — Publikation ist S4", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, {
        garten: {
          [DEVICE]: contribution({ status: "accepted", seq: 12, tiebreak: "abc", publishedHash: "hash-1", admission: { keyGeneration: 1 } }),
        },
      }),
      spaces: [{ id: "garten", admission: { keyGeneration: 1 } }],
    })

    await connector.writeRegistryContribution("garten", "revoked")

    const own = registry(named, "garten")[DEVICE]
    expect(own.seq).toBe(12)
    expect(own.tiebreak).toBe("abc")
    expect(own.publishedHash).toBe("hash-1")
  })

  it("der persoenliche Space ist Home und nie ein Ziel", async () => {
    const { connector } = fakeConnector({ spaces: [] })

    await expect(connector.writeRegistryContribution("home-space", "accepted")).rejects.toThrow()
  })
})

describe("observeProfileShares — Spec 12 Regel 14", () => {
  it("faltet je Ziel-Space genau einen Status aus allen Geraete-Beitraegen", async () => {
    const { connector } = fakeConnector({
      registry: {
        ...flatRegistry(DID, {
          garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 1 } }) },
          werkstatt: { "device-B": contribution({ status: "pending", admission: { keyGeneration: 1 } }) },
        }),
        // Ein Eintrag eines ANDEREN Items gehoert nicht zu den Profil-Freigaben.
        ...flatRegistry("item-42", { garten: { "device-B": contribution({ status: "revoked" }) } }),
      },
    })

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current).toEqual({ garten: "accepted", werkstatt: "pending" })
  })

  it("uebergeht den reservierten Schluessel der Bestandsmarke", async () => {
    const { connector } = fakeConnector({
      registry: {
        ...flatRegistry(DID, { garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 1 } }) } }),
        [JSON.stringify(["_profileMigration"])]: { bestandAt: "2026-09-15T07:00:00.000Z" },
      } as MirrorRegistryRoot,
    })

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current).toEqual({ garten: "accepted" })
  })

  it("ein unabgedeckter Widerruf eines fremden Geraets gewinnt (09 Widerrufs-Kausalitaet)", async () => {
    const { connector } = fakeConnector({
      registry: flatRegistry(DID, {
        garten: {
          [DEVICE]: contribution({ status: "accepted", statusSeq: 9, admission: { keyGeneration: 1 } }),
          "device-B": contribution({ status: "revoked", statusSeq: 2, admission: { keyGeneration: 1 } }),
        },
      }),
    })

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current.garten).toBe("revoked")
  })

  it("reagiert auf einen nachtraeglichen Beitrag eines fremden Geraets", async () => {
    const { connector, named } = fakeConnector()
    const seen: Array<Record<string, string>> = []
    connector.observeProfileShares().subscribe((value: Record<string, string>) => seen.push(value))

    Object.assign(
      named.roots.mirrorRegistry,
      flatRegistry(DID, { garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 1 } }) } }),
    )
    connector.onHomeDocChanged()

    expect(seen.at(-1)).toEqual({ garten: "accepted" })
  })

  it("liefert eine Kopie, kein Objekt aus dem Doc", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })
    await connector.writeRegistryContribution("garten", "accepted")

    const shares = connector.observeProfileShares().current
    shares.garten = "revoked"
    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current.garten).toBe("accepted")
    expect(Object.keys(named.roots.mirrorRegistry)).toHaveLength(1)
  })
})
