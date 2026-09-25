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
// Resonance vectors (modules/resonance.md → Wortlaut und Einfrieren, Vote
// rule 5; spec 08 → statement-authorial). Written to vectors/resonance-1.json.
// Kept in a separate file: rls-claim-1.json is consumed by the relation
// verifier suite, which knows nothing about item claims.
// ---------------------------------------------------------------------------

const bob = keyFromSeed(0x33)
const BOB = didKey(bob.publicKey)

// Wording = { title, description, variantOf } with null for absent members.
const wordingOf = (data) => ({
  title: data.title,
  description: data.description ?? null,
  variantOf: data.variantOf ?? null,
})
const contentHashOf = (wording) => "sha256:" + createHash("sha256").update(jcs(wording), "utf8").digest("hex")

// --- 1. Content hash vectors (pure: wording → JCS → hash) ---
const hashCases = [
  {
    name: "with-description",
    description: "Title and description, no variant.",
    wording: { title: "Wenn ich einlade, gebe ich vorher Agenda und Format vor.", description: "In der Einladung, bevor jemand seinen Abend dafür hergibt.", variantOf: null },
  },
  {
    name: "variant-without-description",
    description: "Absent description is null; variantOf is part of the wording.",
    wording: { title: "Wenn ich einlade, nenne ich vorher Agenda und Format.", description: null, variantOf: "item:statement-grundsatz-einladen" },
  },
  {
    name: "nfc",
    description: "Precomposed ü (U+00FC). Compare with nfd: no Unicode normalisation happens, so the hashes differ (editor rule 4).",
    wording: { title: "Einführung", description: null, variantOf: null },
  },
  {
    name: "nfd",
    description: "Decomposed u + U+0308. Same visible text as nfc, different bytes, different hash.",
    wording: { title: "Einführung", description: null, variantOf: null },
  },
]
const contentHashVectors = hashCases.map((c) => ({ ...c, jcs: jcs(c.wording), contentHash: contentHashOf(c.wording) }))

// --- 2. statement-authorial claim vectors ---
const STATEMENT_ID = "statement-grundsatz-einladen"
const VARIANT_ID = "statement-grundsatz-einladen-v2"
const statementCreatedAt = "2026-09-25T12:00:00.000Z"

const statementItem = {
  id: STATEMENT_ID,
  type: "statement",
  createdBy: ALICE,
  createdAt: statementCreatedAt,
  data: { title: hashCases[0].wording.title, description: hashCases[0].wording.description },
  tags: ["modul:grundsaetze"],
}
const statementPayloadOf = (item, overrides = {}) => ({
  v: "rls-claim/1",
  profile: "statement-authorial",
  id: item.id,
  type: item.type,
  createdBy: item.createdBy,
  createdAt: item.createdAt,
  content: wordingOf(item.data),
  ...overrides,
})

const statementVectors = []
const statementPayload = statementPayloadOf(statementItem)
const statementSigned = signClaim(statementPayload, alice)
statementVectors.push({
  name: "create-valid",
  expect: "valid",
  description: "Fresh statement signed by its author; content equals the stored wording.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: statementSigned.jws,
})

const variantItem = {
  id: VARIANT_ID,
  type: "statement",
  createdBy: BOB,
  createdAt: "2026-09-25T13:00:00.000Z",
  data: { title: hashCases[1].wording.title, variantOf: `item:${STATEMENT_ID}` },
  tags: ["modul:grundsaetze"],
}
const variantPayload = statementPayloadOf(variantItem)
const variantSigned = signClaim(variantPayload, bob)
statementVectors.push({
  name: "variant-valid",
  expect: "valid",
  description: "A variant by another person. Absent description is null in content; variantOf is signed.",
  item: variantItem,
  contentHash: contentHashOf(variantPayload.content),
  payload: variantPayload,
  jws: variantSigned.jws,
})

statementVectors.push({
  name: "tags-changed-valid",
  expect: "valid",
  description: "Tags are not part of the wording: changing them after signing leaves the claim valid.",
  item: { ...statementItem, tags: ["modul:open-space"] },
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: statementSigned.jws,
})

statementVectors.push({
  name: "snapshot-reverify-valid",
  expect: "valid",
  description: "Identical to create-valid, verified from the stored data.claim after a snapshot bootstrap without local history — must verify from the item alone.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: statementSigned.jws,
})

const editedItem = { ...statementItem, data: { ...statementItem.data, title: "Wenn ich einlade, gebe ich vorher Agenda und Format an." } }
const editedPayload = statementPayloadOf(editedItem)
const editedSigned = signClaim(editedPayload, alice)
statementVectors.push({
  name: "edit-resigned-valid",
  expect: "valid",
  description: "The author changed the wording (before any foreign vote) and re-signed. Valid claim, new content hash.",
  item: editedItem,
  contentHash: contentHashOf(editedPayload.content),
  payload: editedPayload,
  jws: editedSigned.jws,
})

statementVectors.push({
  name: "content-mismatch-invalid",
  expect: "invalid",
  description: "Stored title differs from the signed content (raw-CRDT edit without re-signing) — MUST fail.",
  item: editedItem,
  contentHash: contentHashOf(wordingOf(editedItem.data)),
  payload: statementPayload,
  jws: statementSigned.jws,
})

statementVectors.push({
  name: "claim-missing-invalid",
  expect: "invalid",
  description: "Signed mode: a statement without claim is invalid. Absence of a claim proves no provenance (no legacy mode).",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: null,
  jws: null,
})

const foreignAuthorItem = { ...statementItem, id: "statement-untergeschoben", data: { title: "Wer einlädt, entscheidet allein." } }
statementVectors.push({
  name: "foreign-author-without-claim-invalid",
  expect: "invalid",
  description: "An attacker writes a claimless statement naming alice as author. Invalid, so neither it nor any vote on it counts.",
  item: foreignAuthorItem,
  contentHash: contentHashOf(wordingOf(foreignAuthorItem.data)),
  payload: null,
  jws: null,
})

const forgedStatement = signClaim(statementPayload, alice, {}, mallory)
statementVectors.push({
  name: "foreign-signer-invalid",
  expect: "invalid",
  description: "kid names the author but the signature was produced by mallory's key — signature verification MUST fail.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: forgedStatement.jws,
})

const selfSigned = signClaim(statementPayload, mallory, { kid: `${MALLORY}#sig-0` })
statementVectors.push({
  name: "kid-not-author-invalid",
  expect: "invalid",
  description: "Mallory signs correctly with her own key and kid, but createdBy is alice: didOrKidToDid(kid) !== createdBy — MUST fail.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: selfSigned.jws,
})

const postItem = { ...statementItem, type: "post" }
const postPayload = statementPayloadOf(postItem)
const postSigned = signClaim(postPayload, alice)
statementVectors.push({
  name: "wrong-type-invalid",
  expect: "invalid",
  description: "statement-authorial is only valid on items with type statement.",
  item: postItem,
  contentHash: contentHashOf(postPayload.content),
  payload: postPayload,
  jws: postSigned.jws,
})

const wrongTypStatement = signClaim(statementPayload, alice, { typ: "vc+jwt" })
statementVectors.push({
  name: "wrong-typ-invalid",
  expect: "invalid",
  description: "Domain separation: any typ other than rls-claim+jws MUST be rejected even with a valid signature.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: statementPayload,
  jws: wrongTypStatement.jws,
})

const unknownVersionStatement = { ...statementPayload, v: "rls-claim/9" }
statementVectors.push({
  name: "unknown-version-invalid",
  expect: "invalid",
  description: "Unknown payload version MUST fail closed.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: unknownVersionStatement,
  jws: signClaim(unknownVersionStatement, alice).jws,
})

const missingMemberPayload = { ...statementPayload, content: { title: statementPayload.content.title, description: statementPayload.content.description } }
statementVectors.push({
  name: "missing-member-invalid",
  expect: "invalid",
  description: "All content members are always present; a content object without variantOf (instead of variantOf: null) is not structurally equal — MUST fail.",
  item: statementItem,
  contentHash: contentHashOf(statementPayload.content),
  payload: missingMemberPayload,
  jws: signClaim(missingMemberPayload, alice).jws,
})

// --- 3. Counting vectors: does a vote count? ---
// A vote counts iff statement and vote both have a positive verdict for the
// connector's claim mode AND vote.fields.contentHash equals the content hash
// of the statement's currently stored wording (Vote rule 5).
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
const editedHash = contentHashOf(editedPayload.content)
const variantHash = contentHashOf(variantPayload.content)

const countingVectors = [
  {
    name: "signed-hash-match-counts",
    mode: "signed",
    expect: "counts",
    description: "Valid statement claim, valid vote claim, vote hash equals the stored wording's hash.",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: originalHash })),
  },
  {
    name: "signed-statement-edited-after-vote-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote was cast on the original wording; the statement now carries a validly re-signed, different wording. The vote is shown as a vote for another version and does not count.",
    statement: withClaim(editedItem, editedSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: originalHash })),
  },
  {
    name: "signed-vote-without-content-hash-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "A validly signed vote without fields.contentHash never counts.",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green" })),
  },
  {
    name: "signed-vote-for-other-wording-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote carries the hash of the variant's wording but points at the original statement.",
    statement: withClaim(statementItem, statementSigned.jws),
    vote: signedVote(voteRecord(STATEMENT_ID, { value: "green", contentHash: variantHash })),
  },
  {
    name: "signed-statement-without-claim-not-counted",
    mode: "signed",
    expect: "notCounted",
    description: "The vote itself is valid and hash-matching, but the statement has no claim: invalid statement, nothing counts.",
    statement: foreignAuthorItem,
    vote: signedVote(voteRecord(foreignAuthorItem.id, { value: "green", contentHash: contentHashOf(wordingOf(foreignAuthorItem.data)) })),
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
    description: "contentHash is mandatory in every claim mode.",
    statement: statementItem,
    vote: voteRecord(STATEMENT_ID, { value: "yellow" }),
  },
  {
    name: "authoritative-edited-not-counted",
    mode: "authoritative",
    expect: "notCounted",
    description: "Wording binding holds without signatures: the stored wording changed, the vote's hash is the old one.",
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
  description: "Canonical Resonance vectors: content hash of the wording, statement-authorial claims (rls-claim/1) and vote counting. Binding for every implementation — see docs/spec/modules/resonance.md and docs/spec/08-relation-records.md → statement-authorial.",
  keys: {
    alice: { did: ALICE, seed: "0x11 * 32 (test-only, deliberately public)" },
    mallory: { did: MALLORY, seed: "0x22 * 32 (test-only, deliberately public)" },
    bob: { did: BOB, seed: "0x33 * 32 (test-only, deliberately public)" },
  },
  contentHashNote: "contentHash = \"sha256:\" + lowercase hex of SHA-256 over UTF-8 of JCS(wording); wording = { title, description, variantOf } with null for absent members. No Unicode normalisation.",
  jcsNote: out.jcsNote,
  countingRule: "A vote counts iff (1) the statement has a positive verdict for the mode (signed: valid statement-authorial claim; authoritative: trusted; none: never), (2) the vote has a positive verdict (signed: valid relation-authorial claim; authoritative: trusted; none: never), and (3) vote.fields.contentHash equals the content hash of the statement's stored wording.",
  contentHash: contentHashVectors,
  statementClaims: statementVectors,
  counting: countingVectors,
}
writeFileSync(join(here, "vectors", "resonance-1.json"), JSON.stringify(resonanceOut, null, 2) + "\n")
