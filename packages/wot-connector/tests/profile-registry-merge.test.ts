import { describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import { deriveRegistryView, groupRegistryByEntry, mirrorRegistryEntryKey, mirrorRegistryKey } from "../src/mirror/index.js"
import type { MirrorRegistryContribution, RlsSpaceDoc } from "../src/types.js"
import { createYjsSpaceHandle, type YjsTestSpaceHandle } from "./helpers/yjs-space-handle.js"

/**
 * Befund R2-1 aus der Codex-Runde 2, mit zwei ECHTEN Yjs-Dokumenten.
 *
 * Spec 09 §Ablage und Registry verlangt, dass die Beiträge der Geräte
 * konfliktfrei mergen: jedes Gerät schreibt nur unter sich selbst, und die eine
 * Lesesicht entsteht aus ALLEN Beiträgen. Eine physische Ablage, bei der zwei
 * Geräte erst eine gemeinsame Eltern-Map anlegen müssen, erfüllt das nicht — im
 * Merge ist so eine Map ein Register, eine der beiden gewinnt, die andere geht
 * samt Beitrag verloren. Der verlorene Beitrag war in Codex' Reproduktion ein
 * Widerruf, der Freigabestatus kippte also zurück auf `accepted`.
 *
 * Deshalb ist der Registry-Schlüssel physisch flach: `[itemId, targetSpaceId,
 * deviceId]`. Jedes Gerät legt genau seinen eigenen Schlüssel an, nie eine
 * gemeinsame Eltern-Map.
 */

const DID = "did:key:z6MkAnton"

function spaceList(admission: number | undefined = 1) {
  return [{
    id: "garten",
    type: "shared",
    appTag: "rls",
    members: [DID],
    createdAt: "",
    ...(admission === undefined ? {} : { admission: { keyGeneration: admission } }),
  }]
}

function connectorOn(handle: YjsTestSpaceHandle<RlsSpaceDoc>, deviceId: string) {
  const connector = Object.create(WotConnector.prototype) as any
  connector.identity = { getDid: () => DID }
  connector.privateSpaceId = handle.id
  connector.homeHandle = handle
  connector.runtimeGeneration = 1
  connector.replication = {
    openSpace: vi.fn(async () => handle),
    watchSpaces: () => ({ getValue: () => spaceList() }),
  }
  connector.docLogStore = { resolveConnectDeviceId: async () => deviceId }
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  return connector
}

function byDeviceOf(handle: YjsTestSpaceHandle<RlsSpaceDoc>, targetSpaceId: string) {
  const registry = handle.getDoc().mirrorRegistry ?? {}
  return groupRegistryByEntry(registry).get(mirrorRegistryEntryKey(DID, targetSpaceId))
    ?? ({} as Record<string, MirrorRegistryContribution>)
}

describe("Registry-Beiträge zweier Geräte mergen konfliktfrei (Befund R2-1)", () => {
  it("hält beide nebenläufig angelegten Beiträge und lässt den Widerruf gewinnen", async () => {
    const deviceA = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    const deviceB = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    // Gemeinsamer Ausgangszustand: ein Home ohne jeden Registry-Eintrag zu
    // diesem Ziel. Beide Geräte schreiben ihren ERSTEN Beitrag nebenläufig.
    //
    // Die oberste `mirrorRegistry`-Map steht im gemeinsamen Ausgangszustand.
    // Ihre nebenläufige ERSTANLAGE ist der Rest des Befunds, der in der Ablage
    // nicht auflösbar ist (jede geschachtelte Map dieses Doc-Typs teilt ihn,
    // `items` eingeschlossen) — er ist im PR benannt und gehört in den Adapter.
    // Alles darunter ist mit der flachen Schlüsselform konfliktfrei.
    deviceA.transact((doc) => {
      doc._type = "rls"
      doc.items = {}
      doc.mirrorRegistry = {}
    })
    deviceA.syncInto(deviceB)

    await connectorOn(deviceA, "device-A").writeRegistryContribution("garten", "revoked")
    await connectorOn(deviceB, "device-B").writeRegistryContribution("garten", "accepted")

    deviceA.syncInto(deviceB)
    deviceB.syncInto(deviceA)

    for (const handle of [deviceA, deviceB]) {
      const byDevice = byDeviceOf(handle, "garten")
      expect(Object.keys(byDevice).sort()).toEqual(["device-A", "device-B"])
      // Widerrufs-Kausalität: die Freigabe von B hat den Widerruf von A nie
      // gesehen, also löst sie ihn nicht ab (Spec 09 §Ablage und Registry).
      expect(deriveRegistryView(byDevice)?.status).toBe("revoked")
    }
  })

  it("legt je Gerät genau einen flachen Schlüssel an, nie eine gemeinsame Eltern-Map", async () => {
    const deviceA = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    const deviceB = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    deviceA.transact((doc) => {
      doc._type = "rls"
      doc.items = {}
      doc.mirrorRegistry = {}
    })
    deviceA.syncInto(deviceB)

    await connectorOn(deviceA, "device-A").writeRegistryContribution("garten", "accepted")
    await connectorOn(deviceB, "device-B").writeRegistryContribution("garten", "pending")
    deviceA.syncInto(deviceB)
    deviceB.syncInto(deviceA)

    expect(Object.keys(deviceA.getDoc().mirrorRegistry ?? {}).sort()).toEqual([
      mirrorRegistryKey(DID, "garten", "device-A"),
      mirrorRegistryKey(DID, "garten", "device-B"),
    ].sort())
  })

  it("überschreibt bei einem weiteren Statuswechsel nur den eigenen Schlüssel", async () => {
    const deviceA = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    const deviceB = createYjsSpaceHandle<RlsSpaceDoc>("home-space")
    deviceA.transact((doc) => {
      doc._type = "rls"
      doc.items = {}
      doc.mirrorRegistry = {}
    })
    deviceA.syncInto(deviceB)

    await connectorOn(deviceB, "device-B").writeRegistryContribution("garten", "accepted")
    deviceB.syncInto(deviceA)
    await connectorOn(deviceA, "device-A").writeRegistryContribution("garten", "revoked")
    deviceA.syncInto(deviceB)

    const byDevice = byDeviceOf(deviceB, "garten")
    expect(byDevice["device-B"].status).toBe("accepted")
    expect(byDevice["device-A"].status).toBe("revoked")
    // A hat die Freigabe von B gesehen: sein `statusSeq` liegt darüber, und die
    // Faltung kennt keine Abdeckung des Widerrufs.
    expect(byDevice["device-A"].statusSeq).toBeGreaterThan(byDevice["device-B"].statusSeq)
    expect(deriveRegistryView(byDevice)?.status).toBe("revoked")
  })
})
