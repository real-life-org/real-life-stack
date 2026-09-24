import { describe, it, expect, vi } from "vitest"
import { WotConnector } from "../src/wot-connector.js"

/**
 * Feldbefund: ein normales Mitglied konnte eine Gruppe nicht verlassen. Jeder
 * Klick auf "Verlassen" meldete "staged but NOT yet enforced ... not all home
 * brokers confirmed the space-rotate", und zwar dauerhaft.
 *
 * Ursache lag hier: deleteGroup rief erst removeMember(self) und danach
 * leaveSpace. removeMember(self) ist der Admin-Pfad — unter log-sync stagt er
 * durable ein Removal und bittet den Home-Broker um einen space-rotate, den ein
 * Nicht-Admin nicht signieren kann. Der Broker lehnt ab, der Staging-Record
 * bleibt liegen, und leaveSpace nimmt danach genau diesen Record wieder auf und
 * wiederholt den unmoeglichen Rotate.
 *
 * leaveSpace IST der dedizierte Austritts-Flow: es schreibt das eigene
 * removed-Ereignis, verteilt die member-updates an die Verbleibenden und raeumt
 * lokal auf. Der Aufruf davor war reine Doppelarbeit mit Nebenwirkung.
 */

interface ReplicationSpy {
  removeMember: ReturnType<typeof vi.fn>
  leaveSpace: ReturnType<typeof vi.fn>
}

function connectorWithReplication(replication: ReplicationSpy): WotConnector {
  const value = Object.create(WotConnector.prototype) as unknown as {
    replication: unknown
    identity: { getDid: () => string }
    currentGroupId: string | null
    deleteGroup: (id: string) => Promise<void>
  }
  value.replication = replication
  value.identity = { getDid: () => "did:key:zSelf" }
  value.currentGroupId = null
  return value as unknown as WotConnector
}

describe("deleteGroup (Gruppe verlassen)", () => {
  it("nimmt ausschliesslich den Austritts-Pfad und entfernt sich nicht zusaetzlich selbst", async () => {
    const replication: ReplicationSpy = {
      removeMember: vi.fn(async () => {}),
      leaveSpace: vi.fn(async () => {}),
    }
    const connector = connectorWithReplication(replication)

    await connector.deleteGroup("1af17bc1-93c8-4cab-9853-dd5e32170ae0")

    expect(replication.leaveSpace).toHaveBeenCalledWith("1af17bc1-93c8-4cab-9853-dd5e32170ae0")
    expect(replication.removeMember).not.toHaveBeenCalled()
  })

  it("laesst einen Fehler aus dem Austritt durch, statt ihn zu verschlucken", async () => {
    // Der Dialog zeigt die Meldung an und der Space bleibt bestehen — ein still
    // geschluckter Fehler wuerde einen gescheiterten Austritt als Erfolg melden.
    const replication: ReplicationSpy = {
      removeMember: vi.fn(async () => {}),
      leaveSpace: vi.fn(async () => { throw new Error("broker offline") }),
    }
    const connector = connectorWithReplication(replication)

    await expect(connector.deleteGroup("g1")).rejects.toThrow("broker offline")
  })
})
