// Generates the canonical SignedClaim test vectors (spec 08 → "Autorbindung").
// Deterministic: fixed seeds, fixed payloads — rerunning must reproduce
// vectors/rls-claim-1.json byte for byte. Node >= 20 (native Ed25519).
//   node docs/spec/schemas/claims/generate-vectors.mjs
import { createHash, createPrivateKey, createPublicKey, sign as edSign } from "node:crypto"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// --- JCS (RFC 8785) for I-JSON values: recursive key sort; JS number
// serialisation via JSON.stringify matches JCS for IEEE-754 doubles. ---
function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(",")}}`
}

const b64u = (buf) => Buffer.from(buf).toString("base64url")

// --- Ed25519 from fixed 32-byte seeds (PKCS8 wrapping) ---
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex")
function keyFromSeed(seedByte) {
  const seed = Buffer.alloc(32, seedByte)
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" })
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" })
  const publicKey = spki.subarray(spki.length - 32)
  return { privateKey, publicKey }
}

// --- did:key for Ed25519: multicodec 0xed 0x01 + pubkey, base58btc, 'z' prefix ---
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
function base58btc(bytes) {
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex"))
  let out = ""
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n }
  for (const byte of bytes) { if (byte === 0) out = "1" + out; else break }
  return out
}
const didKey = (publicKey) => "did:key:z" + base58btc(Buffer.concat([Buffer.from([0xed, 0x01]), publicKey]))

function signClaim(payload, key, headerOverrides = {}, signWith = key) {
  const header = { alg: "EdDSA", kid: `${payload.createdBy}#sig-0`, typ: "rls-claim+jws", ...headerOverrides }
  const signingInput = `${b64u(jcs(header))}.${b64u(jcs(payload))}`
  const signature = edSign(null, Buffer.from(signingInput, "ascii"), signWith.privateKey)
  return { header, jws: `${signingInput}.${b64u(signature)}` }
}

const alice = keyFromSeed(0x11)
const mallory = keyFromSeed(0x22)
const ALICE = didKey(alice.publicKey)
const MALLORY = didKey(mallory.publicKey)

const statementTo = "item:statement-zweiter-brunnen"
const from = `global:${ALICE}`
// Spec 08 rule 4: the canonical record id IS derived — vectors double as
// conformance checks of the id rule.
const deriveRecordId = (createdBy, predicate, fromT, toT) =>
  "rel-" + createHash("sha256").update(jcs([createdBy, predicate, fromT, toT]), "utf8").digest("hex")
const recordId = deriveRecordId(ALICE, "votesOn", from, statementTo)

const basePayload = {
  v: "rls-claim/1",
  profile: "relation-authorial",
  id: recordId,
  predicate: "votesOn",
  from,
  to: statementTo,
  fields: { value: "green" },
  confirmationRef: null,
  createdBy: ALICE,
  createdAt: "2026-08-04T12:00:00.000Z",
}

const updatedPayload = { ...basePayload, fields: { value: "red" } }

const vectors = []

const create = signClaim(basePayload, alice)
vectors.push({
  name: "create-valid",
  expect: "valid",
  description: "Fresh authorial vote claim; verifier resolves the key from kid (did:key), payload matches the stored record.",
  record: { id: recordId, predicate: "votesOn", from, to: statementTo, fields: { value: "green" }, confirmationRef: null, createdBy: ALICE, createdAt: basePayload.createdAt },
  payload: basePayload,
  jws: create.jws,
})

const update = signClaim(updatedPayload, alice)
vectors.push({
  name: "update-resigned-valid",
  expect: "valid",
  description: "Stance change green→red re-signed by the author; same record key, new payload.",
  record: { id: recordId, predicate: "votesOn", from, to: statementTo, fields: { value: "red" }, confirmationRef: null, createdBy: ALICE, createdAt: basePayload.createdAt },
  payload: updatedPayload,
  jws: update.jws,
})

vectors.push({
  name: "snapshot-reverify-valid",
  expect: "valid",
  description: "Identical to create-valid but verified from stored data.claim after a snapshot bootstrap (no log available) — must verify from the record alone.",
  record: vectors[0].record,
  payload: basePayload,
  jws: create.jws,
})

vectors.push({
  name: "field-mismatch-invalid",
  expect: "invalid",
  description: "Claim signs value green but the stored record says red (raw-CRDT tamper after signing) — payload/record mismatch MUST fail.",
  record: { ...vectors[0].record, fields: { value: "red" } },
  payload: basePayload,
  jws: create.jws,
})

const forged = signClaim(basePayload, alice, {}, mallory)
vectors.push({
  name: "foreign-signer-invalid",
  expect: "invalid",
  description: "kid names the author but the signature was produced by another key (mallory) — signature verification MUST fail.",
  record: vectors[0].record,
  payload: basePayload,
  jws: forged.jws,
})

const wrongTyp = signClaim(basePayload, alice, { typ: "vc+jwt" })
vectors.push({
  name: "wrong-typ-invalid",
  expect: "invalid",
  description: "Domain separation: any typ other than rls-claim+jws MUST be rejected even with a valid signature.",
  record: vectors[0].record,
  payload: basePayload,
  jws: wrongTyp.jws,
})

const confirmationUpdate = { ...basePayload, confirmationRef: "conf-testvector-1" }
const confirmationSigned = signClaim(confirmationUpdate, alice)
vectors.push({
  name: "update-confirmation-ref-valid",
  expect: "valid",
  description: "confirmationRef null → id set; a mutation of this contract field MUST re-sign (payload carries the new value).",
  record: { ...vectors[0].record, confirmationRef: "conf-testvector-1" },
  payload: confirmationUpdate,
  jws: confirmationSigned.jws,
})

const wrongIdPayload = { ...basePayload, id: "rel-testvector-0001" }
const wrongIdSigned = signClaim(wrongIdPayload, alice)
vectors.push({
  name: "id-mismatch-invalid",
  expect: "invalid",
  description: "Record id does not match the canonical derivation of (createdBy, predicate, from, to) per spec 08 rule 4 — invalid even with an intact signature.",
  record: { ...vectors[0].record, id: "rel-testvector-0001" },
  payload: wrongIdPayload,
  jws: wrongIdSigned.jws,
})

const provenanceOnAuthorial = {
  v: "rls-claim/1",
  profile: "item-provenance",
  id: recordId,
  type: "relation",
  createdBy: ALICE,
  createdAt: basePayload.createdAt,
}
const provenanceSigned = signClaim(provenanceOnAuthorial, alice)
vectors.push({
  name: "wrong-profile-invalid",
  expect: "invalid",
  description: "Exclusivity: a catalog authorial record must carry relation-authorial; an item-provenance claim on it is invalid even with a valid signature.",
  record: vectors[0].record,
  payload: provenanceOnAuthorial,
  jws: provenanceSigned.jws,
})

const unknownVersion = { ...basePayload, v: "rls-claim/9" }
const unknownVersionSigned = signClaim(unknownVersion, alice)
vectors.push({
  name: "unknown-version-invalid",
  expect: "invalid",
  description: "Unknown payload version MUST fail closed.",
  record: vectors[0].record,
  payload: unknownVersion,
  jws: unknownVersionSigned.jws,
})

const out = {
  description: "Canonical SignedClaim vectors (rls-claim/1, relation-authorial). Binding for every implementation — see docs/spec/08-relation-records.md → Autorbindung.",
  keys: {
    alice: { did: ALICE, seed: "0x11 * 32 (test-only, deliberately public)" },
    mallory: { did: MALLORY, seed: "0x22 * 32 (test-only, deliberately public)" },
  },
  jcsNote: "Payload/header canonicalisation is RFC 8785 over I-JSON values; the signing input is base64url(JCS(header)) + '.' + base64url(JCS(payload)) as ASCII.",
  vectors,
}

const here = dirname(fileURLToPath(import.meta.url))
mkdirSync(join(here, "vectors"), { recursive: true })
writeFileSync(join(here, "vectors", "rls-claim-1.json"), JSON.stringify(out, null, 2) + "\n")
console.log(`wrote ${vectors.length} vectors — alice=${ALICE}`)

// ---------------------------------------------------------------------------
// item-authorial vectors (spec 08 → "Aussagen einer Person: item-authorial")
// → vectors/item-authorial-1.json, and Resonance counting vectors
// (modules/resonance.md → Vote rule 5) → vectors/resonance-1.json.
// Separate files: rls-claim-1.json is consumed by the relation verifier
// suite, which knows nothing about item claims.
// ---------------------------------------------------------------------------

const bob = keyFromSeed(0x33)
const BOB = didKey(bob.publicKey)

// Closed catalog (spec 08): type → content fields (from data) and content
// relations (predicates of embedded relations whose targets belong to the
// statement, e.g. what a comment is on). Nothing else belongs to the content.
const AUTHORIAL_ITEM_TYPES = {
  statement: { data: ["title", "description", "variantOf"], relations: [] },
  comment: { data: ["content", "replyTo", "replyToComment"], relations: ["commentOn"] },
  reaction: { data: ["emoji"], relations: ["reactsTo"] },
}
// Content = { data: declared fields (null when absent), relations: for each
// declared predicate the sorted list of targets (meta excluded) }.
const contentOf = (type, item) => ({
  data: Object.fromEntries(AUTHORIAL_ITEM_TYPES[type].data.map((field) => [field, item.data?.[field] ?? null])),
  relations: Object.fromEntries(
    AUTHORIAL_ITEM_TYPES[type].relations.map((predicate) => [
      predicate,
      (item.relations ?? []).filter((relation) => relation.predicate === predicate).map((relation) => relation.target).sort(),
    ]),
  ),
})
const contentHashOf = (content) => "sha256:" + createHash("sha256").update(jcs(content), "utf8").digest("hex")

// --- 1. Content hash vectors (pure: type + data → content → JCS → hash) ---
const hashCases = [
  {
    name: "statement-with-description",
    description: "Statement: title and description, no variant.",
    type: "statement",
    data: { title: "Wenn ich einlade, gebe ich vorher Agenda und Format vor.", description: "In der Einladung, bevor jemand seinen Abend dafür hergibt." },
  },
  {
    name: "statement-variant-without-description",
    description: "Absent description is null; variantOf is part of the statement's content.",
    type: "statement",
    data: { title: "Wenn ich einlade, nenne ich vorher Agenda und Format.", variantOf: "item:statement-grundsatz-einladen" },
  },
  {
    name: "comment-with-aggregates",
    description: "Comment: its commentOn target is part of the content; connector-maintained fields (reactions, myReaction), tags and relations with other predicates (relatedTo) are not.",
    type: "comment",
    data: { content: "Gute Idee, ich bin dabei.", replyTo: "comment-1", reactions: { "👍": 2 }, myReaction: "👍" },
    relations: [{ predicate: "commentOn", target: "item:post-a" }, { predicate: "relatedTo", target: "item:elsewhere" }],
  },
  {
    name: "reaction",
    description: "Reaction: the emoji is the whole content.",
    type: "reaction",
    data: { emoji: "❤️" },
    relations: [{ predicate: "reactsTo", target: "item:post-a" }],
  },
  {
    name: "nfc",
    description: "Precomposed ü (U+00FC). Compare with nfd: no Unicode normalisation happens, so the hashes differ.",
    type: "statement",
    data: { title: "Einführung" },
  },
  {
    name: "nfd",
    description: "Decomposed u + U+0308. Same visible text as nfc, different bytes, different hash.",
    type: "statement",
    data: { title: "Einführung" },
  },
]
const contentHashVectors = hashCases.map((c) => {
  const content = contentOf(c.type, c)
  return { ...c, content, jcs: jcs(content), contentHash: contentHashOf(content) }
})

// --- 2. item-authorial claim vectors ---
const itemPayloadOf = (item, overrides = {}) => ({
  v: "rls-claim/1",
  profile: "item-authorial",
  id: item.id,
  type: item.type,
  createdBy: item.createdBy,
  createdAt: item.createdAt,
  content: contentOf(AUTHORIAL_ITEM_TYPES[item.type] ? item.type : "statement", item),
  ...overrides,
})

const STATEMENT_ID = "statement-grundsatz-einladen"
const VARIANT_ID = "statement-grundsatz-einladen-v2"

const statementItem = {
  id: STATEMENT_ID,
  type: "statement",
  createdBy: ALICE,
  createdAt: "2026-09-25T12:00:00.000Z",
  data: hashCases[0].data,
  tags: ["modul:grundsaetze"],
}
const variantItem = {
  id: VARIANT_ID,
  type: "statement",
  createdBy: BOB,
  createdAt: "2026-09-25T13:00:00.000Z",
  data: hashCases[1].data,
  tags: ["modul:grundsaetze"],
}
const editedItem = { ...statementItem, data: { ...statementItem.data, title: "Wenn ich einlade, gebe ich vorher Agenda und Format an." } }
const foreignAuthorItem = { ...statementItem, id: "statement-untergeschoben", data: { title: "Wer einlädt, entscheidet allein." } }
const commentItem = {
  id: "comment-dabei",
  type: "comment",
  createdBy: BOB,
  createdAt: "2026-09-25T15:00:00.000Z",
  data: { content: "Gute Idee, ich bin dabei.", replyTo: "comment-1" },
  relations: [{ predicate: "commentOn", target: "item:post-a" }],
}
const reactionItem = {
  id: "reaction-herz",
  type: "reaction",
  createdBy: ALICE,
  createdAt: "2026-09-25T16:00:00.000Z",
  data: { emoji: "❤️" },
  relations: [{ predicate: "reactsTo", target: "item:post-a" }],
}

const statementPayload = itemPayloadOf(statementItem)
const statementSigned = signClaim(statementPayload, alice)
const variantPayload = itemPayloadOf(variantItem)
const variantSigned = signClaim(variantPayload, bob)
const editedPayload = itemPayloadOf(editedItem)
const editedSigned = signClaim(editedPayload, alice)
const commentPayload = itemPayloadOf(commentItem)
const commentSigned = signClaim(commentPayload, bob)
const reactionPayload = itemPayloadOf(reactionItem)
const reactionSigned = signClaim(reactionPayload, alice)

const claimVector = (name, expect, description, item, payload, jws) => ({
  name,
  expect,
  description,
  item,
  contentHash: AUTHORIAL_ITEM_TYPES[item.type] ? contentHashOf(contentOf(item.type, item)) : null,
  payload,
  jws,
})

const itemClaimVectors = [
  claimVector("statement-create-valid", "valid", "Fresh statement signed by its author; content equals the stored content.", statementItem, statementPayload, statementSigned.jws),
  claimVector("statement-variant-valid", "valid", "A variant by another person. Absent description is null; variantOf is signed.", variantItem, variantPayload, variantSigned.jws),
  claimVector("statement-tags-changed-valid", "valid", "Tags are not part of the content: changing them after signing leaves the claim valid.", { ...statementItem, tags: ["modul:open-space"] }, statementPayload, statementSigned.jws),
  claimVector("statement-snapshot-reverify-valid", "valid", "Identical to statement-create-valid, verified from the stored data.claim after a snapshot bootstrap without local history — must verify from the item alone.", statementItem, statementPayload, statementSigned.jws),
  claimVector("statement-edit-resigned-valid", "valid", "The author changed the content (item not frozen) and re-signed. Valid claim, new content hash.", editedItem, editedPayload, editedSigned.jws),
  claimVector("comment-create-valid", "valid", "A comment signed by its author.", commentItem, commentPayload, commentSigned.jws),
  claimVector(
    "comment-aggregates-changed-valid",
    "valid",
    "Connector-maintained fields changed after others reacted and replied (reactions, myReaction, commentCount). They are not content, so the claim stays valid.",
    { ...commentItem, data: { ...commentItem.data, reactions: { "👍": 3 }, myReaction: "👍", commentCount: 2 } },
    commentPayload,
    commentSigned.jws,
  ),
  claimVector("reaction-create-valid", "valid", "A reaction signed by its author; emoji and reactsTo target are the content.", reactionItem, reactionPayload, reactionSigned.jws),
  claimVector(
    "comment-other-relation-added-valid",
    "valid",
    "A relation with a predicate outside the type's content relations (relatedTo) is not content; adding it leaves the claim valid.",
    { ...commentItem, relations: [...commentItem.relations, { predicate: "relatedTo", target: "item:elsewhere" }] },
    commentPayload,
    commentSigned.jws,
  ),

  claimVector("statement-content-mismatch-invalid", "invalid", "Stored title differs from the signed content (raw-CRDT edit without re-signing) — MUST fail.", editedItem, statementPayload, statementSigned.jws),
  claimVector(
    "comment-content-changed-by-other-invalid",
    "invalid",
    "Someone other than the author changed the comment text. Only the author can produce a valid claim for new content.",
    { ...commentItem, data: { ...commentItem.data, content: "Schlechte Idee." } },
    commentPayload,
    commentSigned.jws,
  ),
  claimVector("reaction-emoji-changed-invalid", "invalid", "The stored emoji differs from the signed one — MUST fail.", { ...reactionItem, data: { emoji: "👎" } }, reactionPayload, reactionSigned.jws),
  claimVector(
    "comment-target-changed-invalid",
    "invalid",
    "The signed comment was moved from post A to post B (commentOn target changed). The target is content — MUST fail.",
    { ...commentItem, relations: [{ predicate: "commentOn", target: "item:post-b" }] },
    commentPayload,
    commentSigned.jws,
  ),
  claimVector(
    "comment-target-missing-invalid",
    "invalid",
    "The commentOn relation was removed. An empty content relation differs from the signed one — MUST fail.",
    { ...commentItem, relations: [] },
    commentPayload,
    commentSigned.jws,
  ),
  claimVector(
    "comment-target-added-invalid",
    "invalid",
    "A second commentOn target was added (the comment now also appears under post B) — MUST fail.",
    { ...commentItem, relations: [...commentItem.relations, { predicate: "commentOn", target: "item:post-b" }] },
    commentPayload,
    commentSigned.jws,
  ),
  claimVector(
    "reaction-target-changed-invalid",
    "invalid",
    "The signed reaction was moved from post A to post B (reactsTo target changed) — MUST fail.",
    { ...reactionItem, relations: [{ predicate: "reactsTo", target: "item:post-b" }] },
    reactionPayload,
    reactionSigned.jws,
  ),
  claimVector("claim-missing-invalid", "invalid", "Signed mode: without claim the verdict is invalid — absence of a claim proves no provenance. Whether the item is still shown and counted is decided by proofRequired (see the standing group).", statementItem, null, null),
  claimVector("foreign-author-without-claim-invalid", "invalid", "An attacker writes a claimless statement naming alice as author. Invalid, so neither it nor any reference to it counts.", foreignAuthorItem, null, null),
  claimVector("foreign-signer-invalid", "invalid", "kid names the author but the signature was produced by mallory's key — signature verification MUST fail.", statementItem, statementPayload, signClaim(statementPayload, alice, {}, mallory).jws),
  claimVector(
    "kid-not-author-invalid",
    "invalid",
    "Mallory signs correctly with her own key and kid, but createdBy is alice: kid MUST be <createdBy>#sig-0.",
    statementItem,
    statementPayload,
    signClaim(statementPayload, mallory, { kid: `${MALLORY}#sig-0` }).jws,
  ),
  (() => {
    const postItem = { id: "post-1", type: "post", createdBy: ALICE, createdAt: "2026-09-25T17:00:00.000Z", data: { title: "Hallo", content: "Ein Post." } }
    const postPayload = { v: "rls-claim/1", profile: "item-authorial", id: postItem.id, type: "post", createdBy: ALICE, createdAt: postItem.createdAt, content: { title: "Hallo", content: "Ein Post." } }
    return claimVector("type-not-in-catalog-invalid", "invalid", "item-authorial is only valid on items of a catalog type; post is not in the catalog.", postItem, postPayload, signClaim(postPayload, alice).jws)
  })(),
  (() => {
    const mismatch = { ...commentPayload, type: "statement" }
    return claimVector("payload-type-mismatch-invalid", "invalid", "Identical to comment-create-valid except that the payload says type statement while the stored item is a comment. Only the type check decides — MUST fail.", commentItem, mismatch, signClaim(mismatch, bob).jws)
  })(),
  (() => {
    const provenance = { v: "rls-claim/1", profile: "item-provenance", id: statementItem.id, type: "statement", createdBy: ALICE, createdAt: statementItem.createdAt }
    return claimVector("provenance-on-catalog-type-invalid", "invalid", "Exclusivity: an item of a catalog type must carry item-authorial; an item-provenance claim on it is invalid even with a valid signature.", statementItem, provenance, signClaim(provenance, alice).jws)
  })(),
  claimVector("wrong-typ-invalid", "invalid", "Domain separation: any typ other than rls-claim+jws MUST be rejected even with a valid signature.", statementItem, statementPayload, signClaim(statementPayload, alice, { typ: "vc+jwt" }).jws),
  (() => {
    const unknown = { ...statementPayload, v: "rls-claim/9" }
    return claimVector("unknown-version-invalid", "invalid", "Unknown payload version MUST fail closed.", statementItem, unknown, signClaim(unknown, alice).jws)
  })(),
  (() => {
    const missing = { ...statementPayload, content: { data: { title: statementPayload.content.data.title, description: statementPayload.content.data.description }, relations: {} } }
    return claimVector("missing-member-invalid", "invalid", "content.data contains exactly the type's content fields, absent ones as null; a content object without variantOf (instead of null) is not structurally equal — MUST fail.", statementItem, missing, signClaim(missing, alice).jws)
  })(),
]

// --- Standing: belegt / unsigniert / ungültig (spec 08 → Beleg erforderlich) ---
// Kept outside `catalog` so the catalog shape the existing tests compare
// against stays unchanged.
const PROOF_REQUIRED = { statement: true, comment: false, reaction: false }
const unsignedComment = { ...commentItem, id: "comment-unsigned" }
const unsignedReaction = { ...reactionItem, id: "reaction-unsigned" }
const standing = (name, standingValue, counts, description, item, jws) => ({ name, standing: standingValue, counts, description, item, jws })
const standingVectors = [
  standing("statement-signed-belegt", "belegt", true, "Valid claim: belegt, shown and counted.", statementItem, statementSigned.jws),
  standing("statement-unsigned-ungueltig", "ungueltig", false, "Statements require proof: without claim they are invalid and never count.", statementItem, null),
  standing("statement-altered-ungueltig", "ungueltig", false, "Claim present but not matching the stored content: invalid (\"verändert\").", editedItem, statementSigned.jws),
  standing("comment-signed-belegt", "belegt", true, "Signed comment: belegt.", commentItem, commentSigned.jws),
  standing("comment-unsigned-unsigniert", "unsigniert", true, "Comments do not require proof yet: without claim the comment is shown, counts and is subtly marked unsigned.", unsignedComment, null),
  standing("comment-altered-ungueltig", "ungueltig", false, "A present but invalid claim is never unsigned: the comment text was changed by someone else — invalid (\"verändert\").", { ...commentItem, data: { ...commentItem.data, content: "Schlechte Idee." } }, commentSigned.jws),
  standing("reaction-signed-belegt", "belegt", true, "Signed reaction: belegt.", reactionItem, reactionSigned.jws),
  standing("reaction-unsigned-unsigniert", "unsigniert", true, "Reactions do not require proof yet: without claim the reaction counts and is subtly marked unsigned.", unsignedReaction, null),
  standing("reaction-altered-ungueltig", "ungueltig", false, "The emoji differs from the signed one: invalid.", { ...reactionItem, data: { emoji: "👎" } }, reactionSigned.jws),
]

const itemAuthorialOut = {
  description: "Canonical item-authorial vectors (rls-claim/1): content hash per catalog type and item claims. Binding for every implementation — see docs/spec/08-relation-records.md → Aussagen einer Person: item-authorial.",
  keys: {
    alice: { did: ALICE, seed: "0x11 * 32 (test-only, deliberately public)" },
    mallory: { did: MALLORY, seed: "0x22 * 32 (test-only, deliberately public)" },
    bob: { did: BOB, seed: "0x33 * 32 (test-only, deliberately public)" },
  },
  catalog: AUTHORIAL_ITEM_TYPES,
  contentHashNote: "content = { data: the type's content fields from data (null when absent), relations: for each of the type's content predicates the targets of the item's embedded relations with that predicate, sorted by UTF-16 code units, meta excluded }; contentHash = \"sha256:\" + lowercase hex of SHA-256 over UTF-8 of JCS(content). No Unicode normalisation.",
  jcsNote: out.jcsNote,
  contentHash: contentHashVectors,
  itemClaims: itemClaimVectors,
  proofRequired: PROOF_REQUIRED,
  standingRule: "Signed mode. belegt: claim verifies (valid). unsigniert: data.claim absent AND the type does not require proof — shown, counts, subtly marked. ungueltig: otherwise — never counts; a present but non-matching claim may be shown as \"verändert\". (In authoritative mode the verdict is trusted, hence belegt.)",
  standing: standingVectors,
}
writeFileSync(join(here, "vectors", "item-authorial-1.json"), JSON.stringify(itemAuthorialOut, null, 2) + "\n")

// --- 3. Resonance counting vectors: does a vote count? ---
const voteFrom = `global:${BOB}`
function voteRecord(statementId, fields) {
  const to = `item:${statementId}`
  return {
    id: deriveRecordId(BOB, "votesOn", voteFrom, to),
    predicate: "votesOn",
    from: voteFrom,
    to,
    fields,
    confirmationRef: null,
    createdBy: BOB,
    createdAt: "2026-09-25T14:00:00.000Z",
  }
}
function signedVote(record) {
  const payload = { v: "rls-claim/1", profile: "relation-authorial", ...record }
  return { ...record, claim: signClaim(payload, bob).jws }
}
const withClaim = (item, jws) => ({ ...item, data: { ...item.data, claim: jws } })

const originalHash = contentHashOf(statementPayload.content)
const variantHash = contentHashOf(variantPayload.content)

const countingVectors = [
  {
    name: "signed-hash-match-counts",
    mode: "signed",
    expect: "counts",
    description: "Valid item-authorial claim on the statement, valid vote claim, vote hash equals the stored content's hash.",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: originalHash })),
  },
  {
    name: "signed-statement-edited-after-vote-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote was cast on the original content; the statement now carries a validly re-signed, different content. The vote is a vote for another version and does not count.",
    statement: withClaim(editedItem, editedSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: originalHash })),
  },
  {
    name: "signed-vote-without-content-hash-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "A validly signed vote without fields.contentHash never counts (votesOn MUST be content-bound).",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green" })),
  },
  {
    name: "signed-vote-for-other-content-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote carries the hash of the variant's content but points at the original statement.",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: variantHash })),
  },
  {
    name: "signed-statement-without-claim-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote itself is valid and hash-matching, but the statement has no claim: invalid statement, nothing counts.",
    statement: foreignAuthorItem,
    vote: signedVote(voteRecord(foreignAuthorItem.id, { value: "green", contentHash: contentHashOf(contentOf("statement", foreignAuthorItem)) })),
  },
  {
    name: "authoritative-hash-match-counts",
    mode: "authoritative",
    expect: "counts",
    description: "Authoritative store: no claims, verdict trusted for statement and vote; the hash matches.",
    statement: statementItem,
    vote: voteRecord(STATEMENT_ID, { value: "yellow", contentHash: originalHash }),
  },
  {
    name: "authoritative-without-content-hash-not-counted",
    mode: "authoritative",
    expect: "notCounted",
    description: "contentHash is mandatory for votesOn in every claim mode.",
    statement: statementItem,
    vote: voteRecord(STATEMENT_ID, { value: "yellow" }),
  },
  {
    name: "authoritative-edited-not-counted",
    mode: "authoritative",
    expect: "notCounted",
    description: "Content binding holds without signatures: the stored content changed, the vote's hash is the old one.",
    statement: editedItem,
    vote: voteRecord(STATEMENT_ID, { value: "yellow", contentHash: originalHash }),
  },
  {
    name: "no-claim-mode-not-counted",
    mode: "none",
    expect: "notCounted",
    description: "A connector without claim mode yields no positive verdict (spec 08, L1): nothing counts even if the hash matches.",
    statement: statementItem,
    vote: voteRecord(STATEMENT_ID, { value: "green", contentHash: originalHash }),
  },
]

const resonanceOut = {
  description: "Canonical Resonance counting vectors: does a vote count? Binding for every implementation — see docs/spec/modules/resonance.md (Vote rule 5) and docs/spec/08-relation-records.md → Inhaltsgebundene Bezugnahme. Item claims and content hashes: item-authorial-1.json.",
  keys: itemAuthorialOut.keys,
  countingRule: "A vote counts iff (1) the statement has a positive verdict for the mode (signed: valid item-authorial claim; authoritative: trusted; none: never), (2) the vote has a positive verdict (signed: valid relation-authorial claim; authoritative: trusted; none: never), and (3) vote.fields.contentHash equals the content hash of the statement's stored content.",
  counting: countingVectors,
}
writeFileSync(join(here, "vectors", "resonance-1.json"), JSON.stringify(resonanceOut, null, 2) + "\n")
