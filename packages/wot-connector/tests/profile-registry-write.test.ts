import { describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import { mirrorRegistryKey } from "../src/mirror/index.js"
import type { MirrorRegistryContribution, RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 09 §Ablage und Registry und Spec 12 Regel 9: der EINE Schreibpfad in die
 * Mirror-Registry des persoenlichen Space. Jedes Geraet schreibt nur unter
 * seinem eigenen `deviceId`-Schluessel, Eintraege werden NIE geloescht, und die
 * Aufnahme-Kennung wird nur beim Statuswechsel gesetzt, nie still nachgefuehrt.
 */

const DID = "did:key:z6MkAnton"
const DEVICE = "device-A"

function contribution(partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution {
  return { statusSeq: 1, status: "accepted", seq: 0, tiebreak: "", updatedAt: "2026-09-01T00:00:00.000Z", ...partial }
}

function fakeConnector(options: {
  doc?: RlsSpaceDoc
  spaces?: Array<{ id: string; admission?: { keyGeneration: number } }>
  deviceId?: string
} = {}) {
  const doc: RlsSpaceDoc = options.doc ?? { _type: "rls", items: {} }
  const handle = {
    id: "home-space",
    getDoc: () => doc,
    transact: (fn: (d: RlsSpaceDoc) => void) => { fn(doc) },
    onRemoteUpdate: () => () => {},
    close: () => {},
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
  return { connector, doc, handle }
}

function registry(doc: RlsSpaceDoc, targetSpaceId: string) {
  return doc.mirrorRegistry?.[mirrorRegistryKey(DID, targetSpaceId)]?.byDevice ?? {}
}

describe("writeRegistryContribution — Spec 09 §Ablage und Registry", () => {
  it("schreibt ausschliesslich unter dem eigenen deviceId und laesst fremde Beitraege stehen", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: { byDevice: { "device-B": contribution({ status: "pending", statusSeq: 3 }) } },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.writeRegistryContribution("garten", "accepted")

    const byDevice = registry(doc, "garten")
    expect(Object.keys(byDevice).sort()).toEqual(["device-A", "device-B"])
    expect(byDevice["device-B"].status).toBe("pending")
  })

  it("eine Freigabe traegt die aktuelle Aufnahme-Kennung des Ziel-Space", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 7 } }] })

    await connector.writeRegistryContribution("garten", "accepted")

    expect(registry(doc, "garten")[DEVICE].admission).toEqual({ keyGeneration: 7 })
  })

  it("eine Freigabe ohne gueltige Aufnahme-Kennung wird abgelehnt", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "alt" }] })

    await expect(connector.writeRegistryContribution("alt", "accepted")).rejects.toThrow(/Aufnahme-Kennung/)
    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "alt")]?.byDevice?.[DEVICE]).toBeUndefined()
  })

  it("auch pending setzt eine gueltige Kennung voraus", async () => {
    const { connector } = fakeConnector({ spaces: [{ id: "alt" }] })

    await expect(connector.writeRegistryContribution("alt", "pending")).rejects.toThrow(/Aufnahme-Kennung/)
  })

  it("ein Widerruf traegt nie eine niedrigere Kennung als die Freigabe, die er widerruft", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 9 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 4 } }] })

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(doc, "garten")[DEVICE].admission).toEqual({ keyGeneration: 9 })
  })

  it("ein Widerruf ohne Kennung im Ziel-Space traegt die Kennung der Lesesicht (09 Inv. 11)", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 3 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [] })

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(doc, "garten")[DEVICE].admission).toEqual({ keyGeneration: 3 })
  })

  it("eine Freigabe deckt jeden beobachteten nicht-accepted Beitrag per supersedes ab", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: {
            "device-B": contribution({ status: "revoked", statusSeq: 5, admission: { keyGeneration: 2 } }),
            "device-C": contribution({ status: "pending", statusSeq: 2, admission: { keyGeneration: 2 } }),
          },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.writeRegistryContribution("garten", "accepted")

    const own = registry(doc, "garten")[DEVICE]
    expect(own.supersedes).toEqual({ "device-B": 5, "device-C": 2 })
    expect(own.statusSeq).toBe(6)
  })

  it("ein Widerruf traegt kein supersedes (nur eine Freigabe loest ab)", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })
    await connector.writeRegistryContribution("garten", "pending")

    await connector.writeRegistryContribution("garten", "revoked")

    expect(registry(doc, "garten")[DEVICE].supersedes).toBeUndefined()
  })

  it("laesst seq und publishedHash unberuehrt — Publikation ist S4", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: {
            [DEVICE]: contribution({ status: "accepted", seq: 12, tiebreak: "abc", publishedHash: "hash-1", admission: { keyGeneration: 1 } }),
          },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })

    await connector.writeRegistryContribution("garten", "revoked")

    const own = registry(doc, "garten")[DEVICE]
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
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 1 } }) },
        },
        [mirrorRegistryKey(DID, "werkstatt")]: {
          byDevice: { "device-B": contribution({ status: "pending", admission: { keyGeneration: 1 } }) },
        },
        // Ein Eintrag eines ANDEREN Items gehoert nicht zu den Profil-Freigaben.
        [mirrorRegistryKey("item-42", "garten")]: {
          byDevice: { "device-B": contribution({ status: "revoked" }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc })

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current).toEqual({ garten: "accepted", werkstatt: "pending" })
  })

  it("ein unabgedeckter Widerruf eines fremden Geraets gewinnt (09 Widerrufs-Kausalitaet)", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {},
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: {
            [DEVICE]: contribution({ status: "accepted", statusSeq: 9, admission: { keyGeneration: 1 } }),
            "device-B": contribution({ status: "revoked", statusSeq: 2, admission: { keyGeneration: 1 } }),
          },
        },
      },
    }
    const { connector } = fakeConnector({ doc })

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current.garten).toBe("revoked")
  })

  it("reagiert auf einen nachtraeglichen Beitrag eines fremden Geraets", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector } = fakeConnector({ doc })
    const seen: Array<Record<string, string>> = []
    connector.observeProfileShares().subscribe((value: Record<string, string>) => seen.push(value))

    doc.mirrorRegistry = {
      [mirrorRegistryKey(DID, "garten")]: {
        byDevice: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 1 } }) },
      },
    }
    connector.onHomeDocChanged()

    expect(seen.at(-1)).toEqual({ garten: "accepted" })
  })

  it("liefert eine Kopie, kein Objekt aus dem Doc", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })
    await connector.writeRegistryContribution("garten", "accepted")

    const shares = connector.observeProfileShares().current
    shares.garten = "revoked"
    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current.garten).toBe("accepted")
    expect(doc.mirrorRegistry).toBeDefined()
  })
})
