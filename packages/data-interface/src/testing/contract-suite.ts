/**
 * Parametrised DataInterface contract suite (rls#214).
 *
 * ONE set of contract cases, run by every connector's test file with its own
 * harness — so a new filter, persisted field, or capability is proven against
 * Local, Mock, WoT AND GraphQL automatically instead of silently dropping at
 * one boundary (the #201 failure mode: hasSchema/@context vanished at the
 * GraphQL transport and nothing went red).
 *
 * The suite is capability-gated: connectors without a capability skip its
 * cases via the same public type guards apps use. Scope-specific behaviour
 * (owner-space create, cross-space ids) stays in the per-connector contract
 * tests — this suite covers the scope-independent core contract.
 *
 * Imported from `@real-life-stack/data-interface/testing` by TEST files only;
 * vitest is a peer of the consuming test runner, never a runtime dependency.
 */
import { describe, expect, it } from "vitest"
import type { DataInterface, Item, RelationRecord } from "../index.js"
import {
  deriveRelationRecordId,
  hasClaimVerification,
  hasGroupScope,
  hasItemScope,
  hasGroups,
  hasItemGroups,
  hasRelationRecords,
  hasRelationRecordWriter,
  hasItemClaimVerification,
  isWritable,
} from "../index.js"

export interface ContractContext {
  connector: DataInterface
  /** The authenticated user the harness signed in. */
  currentUserId: string
  dispose?: () => Promise<void> | void
}

export interface ContractHarness {
  makeConnector(): Promise<ContractContext>
  /**
   * Yield a group id the suite may `updateGroup` against (fresh or seeded).
   * Omit when the harness cannot reach group updates (e.g. the WoT light
   * harness fakes only the doc handle — group meta goes through the
   * replication runtime); the group-update contract cases are skipped then.
   */
  updatableGroup?(context: ContractContext): Promise<string>
  /**
   * Plant an item authored by SOMEONE ELSE directly in the store, bypassing
   * the ingress — that is exactly how such an item appears in reality: it
   * arrives by sync from another device. Needed because the regular ingress
   * now binds `createdBy` to the session, which is the rule under test.
   *
   * A harness that cannot do this must say so; the cases below then fail
   * loudly rather than passing silently.
   */
  seedForeignItem?(context: ContractContext, item: { id: string; type: string; createdBy: string; data?: Record<string, unknown>; relations?: Item["relations"] }): Promise<void>
  /** Reason this harness cannot seed a foreign author — documents the gap. */
  cannotSeedForeignItem?: string
  /** A second space an item could be moved INTO, or null if unavailable. */
  movableTarget?(context: ContractContext): Promise<string | null>
  /**
   * Set to `false` for a harness that runs its connector in FIXTURE mode
   * (`allowFixtureAuthors`), where a caller-supplied `createdBy` is the whole
   * point — it lets tests simulate several authors. Default `true`: the
   * regular ingress binds the author to the session (spec 08).
   */
  bindsAuthorToSession?: boolean
  /**
   * Zwei Spaces für `GroupScopeCapable` (02 → Lesen/Anlegen in einem
   * bestimmten Space): `open` ist geöffnet (der Harness öffnet ihn), `other`
   * nicht. Pflicht für einen Connector mit `hasGroupScope()`; ohne ihn
   * schlagen die Fälle laut fehl, statt still zu bestehen.
   */
  groupScope?(context: ContractContext): Promise<{ open: string; other: string }>
  /**
   * `false`, wenn der Harness keine Live-Beobachtung trägt (WoT-Light-Harness
   * ohne Replikations-Laufzeit); der Observe-Fall mit `group` steht dann im
   * connector-eigenen Test.
   */
  observesGroupScopeLive?: boolean
}

let uniqueCounter = 0
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${uniqueCounter++}`

const VOCAB_A = "https://real-life-stack.org/vocab/statement/v1"
const VOCAB_B = "https://real-life-stack.org/vocab/event/v1"

export function describeDataInterfaceContract(name: string, harness: ContractHarness): void {
  describe(`DataInterface contract — ${name}`, () => {
    async function withConnector<T>(run: (context: ContractContext) => Promise<T>): Promise<T> {
      const context = await harness.makeConnector()
      try {
        return await run(context)
      } finally {
        await context.dispose?.()
      }
    }

    describe("item filters (positive AND negative per parameter)", () => {
      it("filters by type", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-type")
          const created = await connector.createItem({ type, createdBy: currentUserId, data: { title: "a" } })
          const hit = await connector.getItems({ type })
          expect(hit.map(({ id }) => id)).toContain(created.id)
          for (const item of hit) expect(item.type).toBe(type)
          const miss = await connector.getItems({ type: unique("ct-none") })
          expect(miss).toEqual([])
        })
      })

      it("filters by hasField", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const marker = unique("ctField")
          const created = await connector.createItem({
            type: unique("ct-hf"),
            createdBy: currentUserId,
            data: { [marker]: "x" },
          })
          const hit = await connector.getItems({ hasField: [marker] })
          expect(hit.map(({ id }) => id)).toContain(created.id)
          for (const item of hit) expect(marker in item.data).toBe(true)
          const miss = await connector.getItems({ hasField: [unique("ctNone")] })
          expect(miss).toEqual([])
        })
      })

      it("filters by hasTag (AND semantics)", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const tagA = unique("ct-tag-a")
          const tagB = unique("ct-tag-b")
          const both = await connector.createItem({
            type: unique("ct-tags"),
            createdBy: currentUserId,
            data: { title: "both" },
            tags: [tagA, tagB],
          })
          const onlyA = await connector.createItem({
            type: unique("ct-tags"),
            createdBy: currentUserId,
            data: { title: "only-a" },
            tags: [tagA],
          })
          const hitA = await connector.getItems({ hasTag: [tagA] })
          expect(hitA.map(({ id }) => id)).toEqual(expect.arrayContaining([both.id, onlyA.id]))
          const hitBoth = await connector.getItems({ hasTag: [tagA, tagB] })
          expect(hitBoth.map(({ id }) => id)).toContain(both.id)
          expect(hitBoth.map(({ id }) => id)).not.toContain(onlyA.id)
        })
      })

      it("filters by hasSchema (every listed vocabulary must be active)", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-schema")
          const withVocab = await connector.createItem({
            type,
            createdBy: currentUserId,
            "@context": [VOCAB_A],
            data: { title: "with" },
          })
          const withoutVocab = await connector.createItem({
            type,
            createdBy: currentUserId,
            data: { title: "without" },
          })
          const hit = await connector.getItems({ hasSchema: [VOCAB_A] })
          expect(hit.map(({ id }) => id)).toContain(withVocab.id)
          expect(hit.map(({ id }) => id)).not.toContain(withoutVocab.id)
          for (const item of hit) expect(item["@context"] ?? []).toContain(VOCAB_A)
          const miss = await connector.getItems({ type, hasSchema: [VOCAB_A, VOCAB_B] })
          expect(miss.map(({ id }) => id)).not.toContain(withVocab.id)
        })
      })

      it("filters by createdBy", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-author")
          const mine = await connector.createItem({ type, createdBy: currentUserId, data: {} })
          const hit = await connector.getItems({ type, createdBy: currentUserId })
          expect(hit.map(({ id }) => id)).toContain(mine.id)
          const miss = await connector.getItems({ type, createdBy: unique("ct-nobody") })
          expect(miss).toEqual([])
        })
      })

      it("applies limit and offset as a window over the filtered result", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-page")
          const first = await connector.createItem({ type, createdBy: currentUserId, data: { title: "1" } })
          const second = await connector.createItem({ type, createdBy: currentUserId, data: { title: "2" } })
          const page1 = await connector.getItems({ type, limit: 1 })
          expect(page1).toHaveLength(1)
          const page2 = await connector.getItems({ type, limit: 1, offset: 1 })
          expect(page2).toHaveLength(1)
          expect(new Set([page1[0]!.id, page2[0]!.id])).toEqual(new Set([first.id, second.id]))
        })
      })
      it("filters by bbox — positional items inside the box, everything else out", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-bbox")
          const inside = await connector.createItem({
            type,
            createdBy: currentUserId,
            data: { title: "inside", position: { type: "Point", coordinates: [10, 50] } },
          })
          const outside = await connector.createItem({
            type,
            createdBy: currentUserId,
            data: { title: "outside", position: { type: "Point", coordinates: [30, 20] } },
          })
          const noPosition = await connector.createItem({ type, createdBy: currentUserId, data: { title: "none" } })
          const hit = await connector.getItems({ type, bbox: [9, 49, 11, 51] })
          expect(hit.map(({ id }) => id)).toEqual([inside.id])
          const miss = await connector.getItems({ type, bbox: [0, 0, 1, 1] })
          expect(miss).toEqual([])
          // Items without a parsable position are excluded while bbox is set.
          expect(hit.map(({ id }) => id)).not.toContain(noPosition.id)
          expect(miss.map(({ id }) => id)).not.toContain(outside.id)
        })
      })
    })

    describe("persistence roundtrip", () => {
      it("persists data, tags, @context and relations through create → getItem", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const tag = unique("ct-rt-tag")
          const created = await connector.createItem({
            type: unique("ct-rt"),
            createdBy: currentUserId,
            "@context": [VOCAB_A, VOCAB_B],
            data: { title: "roundtrip", nested: { deep: true } },
            tags: [tag],
            relations: [{ predicate: "relatesTo", target: "item:ct-target" }],
          })
          const read = await connector.getItem(created.id)
          expect(read).not.toBeNull()
          expect(read!.data).toEqual({ title: "roundtrip", nested: { deep: true } })
          expect(read!.tags).toEqual([tag])
          expect(read!["@context"]).toEqual([VOCAB_A, VOCAB_B])
          expect(read!.relations).toEqual([{ predicate: "relatesTo", target: "item:ct-target" }])
          expect(read!.createdBy).toBe(currentUserId)
          expect(typeof read!.createdAt).toBe("string")
        })
      })

      it("updateItem replaces data and deleteItem removes the item", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const created = await connector.createItem({
            type: unique("ct-ud"),
            createdBy: currentUserId,
            data: { title: "old", stale: "drop-me" },
          })
          const updated = await connector.updateItem(created.id, { data: { title: "new" } })
          expect(updated.data).toEqual({ title: "new" })
          expect((await connector.getItem(created.id))!.data).toEqual({ title: "new" })
          await connector.deleteItem(created.id)
          expect(await connector.getItem(created.id)).toBeNull()
        })
      })

      it("updateGroup PATCHES data — a partial writer cannot erase foreign keys (rls#234)", async () => {
        if (!harness.updatableGroup) return
        await withConnector(async (context) => {
          const { connector } = context
          if (!hasGroups(connector)) return
          const groupId = await harness.updatableGroup!(context)
          // Two independent writers, each sending ONLY its own fields — the
          // second knows nothing about the first (stale caller).
          await connector.updateGroup(groupId, { data: { image: "logo.png", primaryColor: "#123456" } })
          await connector.updateGroup(groupId, { data: { modules: ["feed", "graph"] } })
          const group = (await connector.getGroups()).find((candidate) => candidate.id === groupId)
          expect(group?.data?.image).toBe("logo.png")
          expect(group?.data?.primaryColor).toBe("#123456")
          expect(group?.data?.modules).toEqual(["feed", "graph"])
        })
      })

      it("updateGroup removes a key via null (JSON Merge Patch at depth 1)", async () => {
        if (!harness.updatableGroup) return
        await withConnector(async (context) => {
          const { connector } = context
          if (!hasGroups(connector)) return
          const groupId = await harness.updatableGroup!(context)
          await connector.updateGroup(groupId, { data: { primaryColor: "#123456" } })
          await connector.updateGroup(groupId, { data: { primaryColor: null } })
          const group = (await connector.getGroups()).find((candidate) => candidate.id === groupId)
          expect(group?.data ?? {}).not.toHaveProperty("primaryColor")
        })
      })

      it("stamps updatedAt/updatedBy on update — the connector, not the caller", async () => {
        // Braucht eine echte Sitzung: ein Service-Role-Zugang hat kein
        // auth.uid(), der Trigger schriebe NULL.
        if (harness.bindsAuthorToSession === false) return
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const created = await connector.createItem({
            type: unique("ct-stamp"),
            createdBy: currentUserId,
            data: { title: "vorher" },
          })
          // Never edited yet: no stamp, so surfaces can tell "untouched" from
          // "edited" instead of guessing from equal timestamps.
          expect(created.updatedAt).toBeUndefined()
          expect(created.updatedBy).toBeUndefined()

          const updated = await connector.updateItem(created.id, { data: { title: "nachher" } })
          expect(updated.updatedBy).toBe(currentUserId)
          expect(typeof updated.updatedAt).toBe("string")
          expect(Number.isFinite(Date.parse(updated.updatedAt!))).toBe(true)

          const read = await connector.getItem(created.id)
          expect(read!.updatedBy).toBe(currentUserId)
          expect(read!.updatedAt).toBe(updated.updatedAt)
        })
      })

      it("ignores a caller-supplied editor — author binding (spec 08)", async () => {
        if (harness.bindsAuthorToSession === false) return
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const created = await connector.createItem({
            type: unique("ct-forge"),
            createdBy: currentUserId,
            data: { title: "a" },
          })
          const forged = await connector.updateItem(created.id, {
            data: { title: "b" },
            // A client that may name the editor may also name someone else.
            updatedBy: "did:key:someone-else",
            updatedAt: "1999-01-01T00:00:00.000Z",
          } as never)
          expect(forged.updatedBy).toBe(currentUserId)
          expect(forged.updatedAt).not.toBe("1999-01-01T00:00:00.000Z")
        })
      })

      it("ignores an edit stamp supplied at CREATE — a fresh item was never edited", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const created = await connector.createItem({
            type: unique("ct-cstamp"),
            createdBy: currentUserId,
            data: { title: "neu" },
            // The TS type excludes these; a wire client is not bound by it.
            updatedBy: "did:key:someone-else",
            updatedAt: "1999-01-01T00:00:00.000Z",
          } as never)
          expect(created.updatedBy).toBeUndefined()
          expect(created.updatedAt).toBeUndefined()
          // Auch den PERSISTIERTEN Stand pruefen, und beide Felder: sonst
          // koennte ein Connector den fremden Zeitstempel speichern, ohne
          // dass der Test rot wird.
          const persisted = (await connector.getItem(created.id))!
          expect(persisted.updatedBy).toBeUndefined()
          expect(persisted.updatedAt).toBeUndefined()
        })
      })

      it("refuses to change the content of, or remove, ANOTHER author's statement/comment/reaction", async () => {
        // Kein stiller Skip: ein Harness ohne Seeding muss den Grund nennen.
        if (harness.cannotSeedForeignItem) return
        expect(harness.seedForeignItem, "Harness braucht seedForeignItem oder cannotSeedForeignItem").toBeDefined()
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!isWritable(connector)) return
          // Inhaltsfelder laut Katalog (Spec 08): nur deren Aenderung ist der
          // Autorin vorbehalten. Felder ausserhalb des Inhalts duerfen andere
          // schreiben, ein strengeres Backend darf das trotzdem sperren.
          const cases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
            ["statement", { title: "ihre Aussage" }, { title: "gekapert" }],
            ["comment", { content: "ihre Aussage" }, { content: "gekapert" }],
            ["reaction", { emoji: "❤️" }, { emoji: "👎" }],
          ]
          for (const [type, data, hijacked] of cases) {
            const foreign = unique(`ct-foreign-${type}`)
            await harness.seedForeignItem!(context, {
              id: foreign, type, createdBy: "did:key:someone-else", data,
            })
            // The UI hides the buttons — but the UI is not the boundary. A
            // wire client must be refused at the ingress too.
            await expect(connector.updateItem(foreign, { data: hijacked })).rejects.toThrow()
            await expect(connector.deleteItem(foreign)).rejects.toThrow()
            expect(await connector.getItem(foreign)).not.toBeNull()
          }
        })
      })

      it("owns data.claim of authorial items: a caller-supplied claim never survives (spec 08)", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector) || !hasItemClaimVerification(connector)) return
          const created = await connector.createItem({
            type: "comment",
            createdBy: currentUserId,
            data: { content: "meine Aussage", claim: "forged.claim.jws" },
            relations: [{ predicate: "commentOn", target: `item:${unique("ct-target")}` }],
          })
          const persisted = (await connector.getItem(created.id))!
          expect(persisted.data.claim).not.toBe("forged.claim.jws")
          expect(await connector.verifyItemClaim(persisted)).not.toBe("invalid")
        })
      })

      it("keeps the verdict positive when the author changes the content or anyone changes other fields", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector) || !hasItemClaimVerification(connector)) return
          const created = await connector.createItem({ type: "statement", createdBy: currentUserId, data: { title: "vorher" } })
          await connector.updateItem(created.id, { data: { title: "nachher" } })
          await connector.updateItem(created.id, { tags: [unique("ct-tag")] })
          const persisted = (await connector.getItem(created.id))!
          expect(persisted.data.title).toBe("nachher")
          expect(await connector.verifyItemClaim(persisted)).not.toBe("invalid")
        })
      })

      it("refuses a content change of a frozen item, even by its author (spec 08 → Einfrieren)", async () => {
        if (harness.cannotSeedForeignItem) return
        expect(harness.seedForeignItem, "Harness braucht seedForeignItem oder cannotSeedForeignItem").toBeDefined()
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!isWritable(connector) || !hasItemClaimVerification(connector)) return
          const statement = await connector.createItem({ type: "statement", createdBy: currentUserId, data: { title: "gesagt" } })
          const voter = "did:key:someone-else"
          await harness.seedForeignItem!(context, {
            id: unique("ct-vote"),
            type: "relation",
            createdBy: voter,
            data: { predicate: "votesOn", value: "green", contentHash: "sha256:0" },
            relations: [
              { predicate: "from", target: `global:${voter}` },
              { predicate: "to", target: `item:${statement.id}` },
            ],
          })
          await expect(connector.updateItem(statement.id, { data: { title: "anders" } })).rejects.toThrow(/frozen/)
          await connector.updateItem(statement.id, { tags: [unique("ct-tag")] })
          expect((await connector.getItem(statement.id))!.data.title).toBe("gesagt")
        })
      })

      it("bindet createdBy an die Sitzung — ein fremder Autor im Payload zaehlt nicht", async () => {
        if (harness.bindsAuthorToSession === false) return
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          // Das Autorenmodell entscheidet Rechte anhand von createdBy. Wer es
          // frei setzen darf, kann eine fremde Urheberschaft erfinden und sie
          // danach als Schutzanker verwenden.
          const created = await connector.createItem({
            type: unique("ct-author"),
            createdBy: "did:key:someone-else",
            data: { title: "x" },
          })
          expect(created.createdBy).toBe(currentUserId)
          expect((await connector.getItem(created.id))!.createdBy).toBe(currentUserId)
        })
      })

      it("laesst den Typ eines Items nicht nachtraeglich aendern", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const created = await connector.createItem({
            type: unique("ct-retype"),
            createdBy: currentUserId,
            data: { title: "inhalt" },
          })
          // Sonst liesse sich ein bearbeitbares Inhalts-Item in ein
          // geschuetztes Autoren-Item verwandeln — der Guard prueft den ALTEN
          // Typ und waere gruen, das Ergebnis waere eine fremd zugeschriebene
          // Aussage. Supabase behandelt `type` laengst als unveraenderlich.
          //
          // Geprueft wird die WIRKUNG, nicht der Weg: ablehnen (Connectoren)
          // und stillschweigend verwerfen (GraphQL, dessen Update-Input den
          // Typ gar nicht kennt) sind beide zulaessig — anwenden nicht.
          await connector.updateItem(created.id, { type: "comment" }).catch(() => undefined)
          expect((await connector.getItem(created.id))!.type).toBe(created.type)
        })
      })

      it("verschiebt ein fremdes Autoren-Item nicht in einen anderen Space", async () => {
        if (harness.cannotSeedForeignItem) return
        await withConnector(async (context) => {
          const { connector } = context
          if (!isWritable(connector) || !hasItemGroups(connector)) return
          // Kein stiller Skip: ein Connector MIT moveItemToGroup muss ein
          // Ziel liefern koennen, sonst prueft dieser Test nichts.
          expect(harness.movableTarget, "Harness mit ItemGroups braucht movableTarget").toBeDefined()
          const target = await harness.movableTarget!(context)
          expect(target, "movableTarget muss einen Ziel-Space liefern").toBeTruthy()
          const foreign = unique("ct-move-foreign")
          await harness.seedForeignItem!(context, {
            id: foreign, type: "comment", createdBy: "did:key:someone-else", data: { text: "ihre Aussage" },
          })
          const sourceBefore = connector.getItemGroupId(foreign)
          // Fuer den Quell-Space ist ein Move ein Delete — im WoT-Pfad
          // woertlich create-im-Ziel plus delete-in-der-Quelle. Er darf die
          // fremde Aussage nicht aus ihrem Kontext reissen.
          // Mock wirft SYNCHRON (moveItemToGroup ist dort void), die anderen
          // lehnen ein Promise ab — beides muss der Test fangen.
          await expect(
            Promise.resolve().then(() => connector.moveItemToGroup(foreign, target!)),
          ).rejects.toThrow()
          expect(connector.getItemGroupId(foreign)).toBe(sourceBefore)
        })
      })

      it("observe reflects a create for a matching filter — with COMPLETE item fields", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!isWritable(connector)) return
          const type = unique("ct-obs")
          const tag = unique("ct-obs-tag")
          const created = await connector.createItem({
            type,
            createdBy: currentUserId,
            "@context": [VOCAB_A],
            data: { title: "observed" },
            tags: [tag],
            relations: [{ predicate: "relatesTo", target: "item:ct-obs-target" }],
          })
          const observable = connector.observe({ type })
          // Contract: after the write settled, a fresh observation of the
          // matching filter contains the item (initial fetch or live update).
          await new Promise((resolve) => setTimeout(resolve, 0))
          const find = () => observable.current.find(({ id }) => id === created.id)
          if (!find()) {
            await new Promise<void>((resolve) => {
              const stop = observable.subscribe(() => { stop(); resolve() })
            })
          }
          const observed = find()
          expect(observed).toBeDefined()
          // The observe path must deliver the SAME field surface as getItem —
          // a lossy selection here would hide fields from every live view.
          expect(observed!.data).toEqual({ title: "observed" })
          expect(observed!.tags).toEqual([tag])
          expect(observed!["@context"]).toEqual([VOCAB_A])
          expect(observed!.relations).toEqual([{ predicate: "relatesTo", target: "item:ct-obs-target" }])
          expect(observed!.createdBy).toBe(currentUserId)
        })
      })
    })

    describe("group scope (GroupScopeCapable, capability-gated)", () => {
      async function spaces(context: ContractContext) {
        if (!harness.groupScope) throw new Error("Harness muss groupScope() liefern: der Connector meldet hasGroupScope()")
        return harness.groupScope(context)
      }
      const openId = (connector: DataInterface) => (hasGroups(connector) ? connector.getCurrentGroup()?.id ?? null : null)

      it("legt mit group unmittelbar im genannten Space an und liest ihn, ohne ihn zu öffnen", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasGroupScope(connector)) return
          const { open, other } = await spaces(context)
          expect(openId(connector)).toBe(open)
          const type = unique("ct-scope")
          const created = await connector.createItem({ type, createdBy: currentUserId, data: { title: "dort" } }, { group: other })
          // Der geöffnete Space bleibt (02, Anlegen Regel 4; Lesen Regel 4).
          expect(openId(connector)).toBe(open)
          const dort = await connector.getItems({ type, group: other })
          expect(dort.map(({ id }) => id)).toEqual([created.id])
          expect(dort[0]!.data).toEqual({ title: "dort" })
          // Im geöffneten Space liegt es nicht, weder ausdrücklich noch implizit.
          expect(await connector.getItems({ type, group: open })).toEqual([])
          expect(await connector.getItems({ type })).toEqual([])
          expect(openId(connector)).toBe(open)
          if (hasItemGroups(connector)) expect(connector.getItemGroupId(created.id)).toBe(other)
        })
      })

      it("liest mit group nur den genannten Space, auch aus der Übersicht", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasGroupScope(connector)) return
          const { open, other } = await spaces(context)
          const type = unique("ct-scope-read")
          const hier = await connector.createItem({ type, createdBy: currentUserId, data: { title: "hier" } })
          const dort = await connector.createItem({ type, createdBy: currentUserId, data: { title: "dort" } }, { group: other })
          expect((await connector.getItems({ type, group: open })).map(({ id }) => id)).toEqual([hier.id])
          expect((await connector.getItems({ type, group: other })).map(({ id }) => id)).toEqual([dort.id])
          if (hasGroups(connector)) {
            connector.setCurrentGroup(null)
            await new Promise((resolve) => setTimeout(resolve, 0))
            expect((await connector.getItems({ type, group: other })).map(({ id }) => id)).toEqual([dort.id])
            expect((await connector.getItems({ type, group: open })).map(({ id }) => id)).toEqual([hier.id])
          }
        })
      })

      it("ein unbekannter Space ergibt eine leere Menge und lehnt das Anlegen ab", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasGroupScope(connector)) return
          const { open, other } = await spaces(context)
          const type = unique("ct-scope-unknown")
          await connector.createItem({ type, createdBy: currentUserId, data: {} })
          expect(await connector.getItems({ group: unique("kein-space") })).toEqual([])
          await expect(
            connector.createItem({ type, createdBy: currentUserId, data: {} }, { group: unique("kein-space") }),
          ).rejects.toThrow()
          // Nirgends angelegt: weder im geöffneten noch im anderen Space.
          expect(await connector.getItems({ type, group: open })).toHaveLength(1)
          expect(await connector.getItems({ type, group: other })).toEqual([])
        })
      })

      it("getItem und updateItem mit group erreichen ein Item im anderen Space, ohne ihn zu öffnen", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasItemScope(connector) || !hasGroupScope(connector)) return
          const { open, other } = await spaces(context)
          const type = unique("ct-scope-update")
          const dort = await connector.createItem({ type, createdBy: currentUserId, data: { title: "alt" } }, { group: other })
          expect((await connector.getItem(dort.id, { group: other }))?.data).toEqual({ title: "alt" })
          expect(await connector.getItem(dort.id, { group: open })).toBeNull()
          const updated = await connector.updateItem(dort.id, { data: { title: "neu" } }, { group: other })
          expect(updated.data).toEqual({ title: "neu" })
          // Der geöffnete Space bleibt, das Item bleibt in seinem Space (02, Regeln 4 und 5).
          expect(openId(connector)).toBe(open)
          expect((await connector.getItems({ type, group: other })).map(({ id, data }) => [id, data])).toEqual([[dort.id, { title: "neu" }]])
          expect(await connector.getItems({ type, group: open })).toEqual([])
          if (hasItemGroups(connector)) expect(connector.getItemGroupId(dort.id)).toBe(other)
        })
      })

      it("updateItem mit group geht auch aus der Übersicht", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasItemScope(connector) || !hasGroupScope(connector) || !hasGroups(connector)) return
          const { other } = await spaces(context)
          const type = unique("ct-scope-update-overview")
          const dort = await connector.createItem({ type, createdBy: currentUserId, data: { title: "alt" } }, { group: other })
          connector.setCurrentGroup(null)
          await new Promise((resolve) => setTimeout(resolve, 0))
          await connector.updateItem(dort.id, { data: { title: "neu" } }, { group: other })
          expect((await connector.getItem(dort.id, { group: other }))?.data).toEqual({ title: "neu" })
          expect(openId(connector)).toBeNull()
        })
      })

      it("mit group wird ein Item in einem anderen Space weder gelesen noch geändert", async () => {
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasItemScope(connector)) return
          const { open, other } = await spaces(context)
          const type = unique("ct-scope-update-wrong")
          const hier = await connector.createItem({ type, createdBy: currentUserId, data: { title: "hier" } })
          expect(await connector.getItem(hier.id, { group: other })).toBeNull()
          await expect(connector.updateItem(hier.id, { data: { title: "falsch" } }, { group: other })).rejects.toThrow()
          expect((await connector.getItem(hier.id, { group: open }))?.data).toEqual({ title: "hier" })
          const kein = unique("kein-space")
          expect(await connector.getItem(hier.id, { group: kein })).toBeNull()
          await expect(connector.updateItem(hier.id, { data: { title: "falsch" } }, { group: kein })).rejects.toThrow()
          expect((await connector.getItem(hier.id))?.data).toEqual({ title: "hier" })
        })
      })

      it("observe mit group meldet ein Anlegen in diesem Space, solange er nicht geöffnet ist", async () => {
        if (harness.observesGroupScopeLive === false) return
        await withConnector(async (context) => {
          const { connector, currentUserId } = context
          if (!hasGroupScope(connector)) return
          const { open, other } = await spaces(context)
          const type = unique("ct-scope-obs")
          const observable = connector.observe({ type, group: other })
          await new Promise((resolve) => setTimeout(resolve, 0))
          expect(observable.current).toEqual([])
          const created = await connector.createItem({ type, createdBy: currentUserId, data: { title: "live" } }, { group: other })
          const find = () => observable.current.find(({ id }) => id === created.id)
          if (!find()) {
            await new Promise<void>((resolve) => {
              const stop = observable.subscribe(() => { if (find()) { stop(); resolve() } })
            })
          }
          expect(find()?.data).toEqual({ title: "live" })
          expect(openId(connector)).toBe(open)
          // Ein Anlegen im geöffneten Space erscheint dort nicht.
          await connector.createItem({ type, createdBy: currentUserId, data: {} })
          await new Promise((resolve) => setTimeout(resolve, 0))
          expect(observable.current.map(({ id }) => id)).toEqual([created.id])
        })
      })
    })

    describe("relation-record contract (capability-gated)", () => {
      it("stamps createdBy from the authenticated identity and derives the canonical id", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!hasRelationRecordWriter(connector)) return
          const statementId = unique("ct-stmt")
          const record = await connector.createRelationRecord({
            predicate: "votesOn",
            from: `global:${currentUserId}`,
            to: `item:${statementId}`,
            fields: { value: "green" },
          })
          expect(record.createdBy).toBe(currentUserId)
          expect(record.id).toBe(
            await deriveRelationRecordId(currentUserId, "votesOn", `global:${currentUserId}`, `item:${statementId}`),
          )
          expect(record.fields).toEqual({ value: "green" })
        })
      })

      it("is idempotent for the own tuple and readable through the record projection", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!hasRelationRecordWriter(connector) || !hasRelationRecords(connector)) return
          const statementId = unique("ct-stmt")
          const input = { predicate: "votesOn", from: `global:${currentUserId}`, to: `item:${statementId}` }
          const first = await connector.createRelationRecord(input)
          const again = await connector.createRelationRecord(input)
          expect(again.id).toBe(first.id)
          const records = await connector.getRelationRecords({ predicate: "votesOn", to: `item:${statementId}` })
          expect(records.map(({ id }: RelationRecord) => id)).toEqual([first.id])
        })
      })

      it("fails on a pre-seeded canonical id with a foreign identity", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!hasRelationRecordWriter(connector) || !isWritable(connector)) return
          const statementId = unique("ct-stmt")
          const id = await deriveRelationRecordId(currentUserId, "votesOn", `global:${currentUserId}`, `item:${statementId}`)
          await connector.createItem({
            id,
            type: "relation",
            createdBy: unique("ct-mallory"),
            data: { predicate: "votesOn", value: "red" },
            relations: [
              { predicate: "from", target: `global:${unique("ct-mallory")}` },
              { predicate: "to", target: `item:${statementId}` },
            ],
          })
          await expect(
            connector.createRelationRecord({ predicate: "votesOn", from: `global:${currentUserId}`, to: `item:${statementId}` }),
          ).rejects.toThrow(/collision/i)
        })
      })

      it("claim verdict: a facade-written authorial record is vouched for (valid or trusted)", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!hasRelationRecordWriter(connector) || !hasClaimVerification(connector)) return
          const statementId = unique("ct-verdict")
          const record = await connector.createRelationRecord({
            predicate: "votesOn",
            from: `global:${currentUserId}`,
            to: `item:${statementId}`,
            fields: { value: "green" },
          })
          const verdict = await connector.verifyRecordClaim(record)
          expect(["valid", "trusted"]).toContain(verdict)
        })
      })

      it("refuses to update or delete another author's record", async () => {
        await withConnector(async ({ connector, currentUserId }) => {
          if (!hasRelationRecordWriter(connector) || !isWritable(connector)) return
          const statementId = unique("ct-stmt")
          const foreignAuthor = unique("ct-bob")
          const foreignId = await deriveRelationRecordId(foreignAuthor, "votesOn", `global:${foreignAuthor}`, `item:${statementId}`)
          // Direkt gesetzt, nicht ueber createItem: der Ingress bindet den
          // Autor inzwischen an die Sitzung — ein fremder Datensatz entsteht
          // nur durch Sync von einem anderen Geraet.
          if (harness.cannotSeedForeignItem) return
          await harness.seedForeignItem!({ connector, currentUserId }, {
            id: foreignId,
            type: "relation",
            createdBy: foreignAuthor,
            data: { predicate: "votesOn", value: "red" },
            relations: [
              { predicate: "from", target: `global:${foreignAuthor}` },
              { predicate: "to", target: `item:${statementId}` },
            ],
          })
          await expect(connector.updateRelationRecord(foreignId, { fields: { value: "green" } })).rejects.toThrow(/authorized/i)
          await expect(connector.deleteRelationRecord(foreignId)).rejects.toThrow(/authorized/i)
          expect(await connector.getItem(foreignId)).not.toBeNull()
        })
      })
    })
  })
}
