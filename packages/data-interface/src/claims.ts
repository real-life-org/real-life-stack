import type { Item, Relation, RelationRecord } from "./index.js"

/**
 * SignedClaims — author binding for relation records (spec 08 → "Autorbindung",
 * rls#209/#227). A claim is a compact Ed25519 JWS whose payload binds the
 * record's full semantic state to its author's DID. It travels IN the record
 * (`data.claim` → projected to `record.claim`), so it survives snapshots,
 * imports and bridges — unlike the sync-log signatures, which cover whole
 * update blobs and are unavailable after a snapshot bootstrap.
 *
 * The canonical test vectors under docs/spec/schemas/claims/vectors/ are
 * binding; the claims test suite runs them verbatim.
 */

export const RLS_CLAIM_V1 = "rls-claim/1"
export const CLAIM_JWS_TYP = "rls-claim+jws"
export const RELATION_AUTHORIAL_PROFILE = "relation-authorial"
export const ITEM_AUTHORIAL_PROFILE = "item-authorial"

/**
 * The CLOSED v0.1 catalog of authorial predicates (spec 08): perspective
 * edges that ARE their author's statement. Never sourced from space data —
 * no client may reinterpret a record's profile.
 */
export const AUTHORIAL_PREDICATES: ReadonlySet<string> = new Set([
  "votesOn",
  "knows",
  "connectedWith",
  "takesPlaceAt",
])

export function isAuthorialPredicate(predicate: string): boolean {
  return AUTHORIAL_PREDICATES.has(predicate)
}

/** Operation-shaped signer — never exposes key material. */
export interface ClaimSigner {
  /** MUST be `<did>#sig-0` of the authenticated identity. */
  kid: string
  signEd25519(bytes: Uint8Array): Promise<Uint8Array>
}

export type ClaimVerdict = "valid" | "invalid" | "trusted"

/** JCS (RFC 8785) for I-JSON values: recursive key sort; JSON.stringify's
    IEEE-754 number serialisation matches JCS for JS numbers. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

function assertWellFormedString(value: string): void {
  // RFC 8785 requires aborting on lone surrogates: TextEncoder would replace
  // them with U+FFFD, so two implementations could sign DIFFERENT bytes for
  // the "same" string.
  if (LONE_SURROGATE.test(value)) throw new Error("JCS: lone UTF-16 surrogate is not well-formed")
}

export function jcsCanonicalize(value: unknown): string {
  if (value === null) return "null"
  const kind = typeof value
  if (kind === "string") {
    assertWellFormedString(value as string)
    return JSON.stringify(value)
  }
  if (kind === "number") {
    // I-JSON (RFC 7493): only finite numbers exist. JSON.stringify would
    // silently coerce NaN/Infinity to null — a claim over a DIFFERENT value
    // than the record holds. Refuse instead of signing a lie.
    if (!Number.isFinite(value)) throw new Error("JCS: non-finite number is not I-JSON")
    return JSON.stringify(value)
  }
  if (kind === "boolean") return JSON.stringify(value)
  if (kind === "undefined" || kind === "function" || kind === "symbol" || kind === "bigint") {
    throw new Error(`JCS: ${kind} is not I-JSON`)
  }
  if (Array.isArray(value)) return `[${value.map(jcsCanonicalize).join(",")}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const members: string[] = []
  for (const key of keys) {
    assertWellFormedString(key)
    const member = record[key]
    // Ambiguity guard: JSON.stringify would DROP undefined members, so two
    // different objects would canonicalise identically. Refuse.
    if (member === undefined) throw new Error("JCS: undefined object member is not I-JSON")
    members.push(`${JSON.stringify(key)}:${jcsCanonicalize(member)}`)
  }
  return `{${members.join(",")}}`
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function base58btcDecode(value: string): Uint8Array | null {
  let n = 0n
  for (const char of value) {
    const digit = B58_ALPHABET.indexOf(char)
    if (digit < 0) return null
    n = n * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn))
    n >>= 8n
  }
  for (const char of value) {
    if (char === "1") bytes.unshift(0)
    else break
  }
  return new Uint8Array(bytes)
}

/** did:key (Ed25519) → raw 32-byte public key, or null when malformed. */
function ed25519PublicKeyFromDidKey(did: string): Uint8Array | null {
  if (!did.startsWith("did:key:z")) return null
  const decoded = base58btcDecode(did.slice("did:key:z".length))
  if (!decoded || decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) return null
  return decoded.subarray(2)
}

const didFromKid = (kid: string): string => kid.split("#")[0] ?? kid

/** The exact wire payload `rls-claim/1` / `relation-authorial`: all ten
    members ALWAYS present (spec 08 — verifiers compare structurally). */
export function relationAuthorialPayload(record: RelationRecord): Record<string, unknown> {
  return {
    v: RLS_CLAIM_V1,
    profile: RELATION_AUTHORIAL_PROFILE,
    id: record.id,
    predicate: record.predicate,
    from: record.from,
    to: record.to,
    fields: record.fields ?? {},
    confirmationRef: record.confirmationRef ?? null,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  }
}

/**
 * Sign an authorial record. The signer identity MUST be the record author
 * (`kid` = `<createdBy>#sig-0`) — signing in someone else's name is refused
 * at create time, mirroring the inbox-JWS convention.
 */
export async function signRelationClaim(record: RelationRecord, signer: ClaimSigner): Promise<string> {
  if (signer.kid !== `${record.createdBy}#sig-0`) {
    throw new Error(`Claim signer ${signer.kid} does not match record createdBy ${record.createdBy} (kid MUST be <createdBy>#sig-0)`)
  }
  if (!isAuthorialPredicate(record.predicate)) {
    throw new Error(`Predicate "${record.predicate}" is outside the authorial claim catalog (spec 08)`)
  }
  return signPayload(relationAuthorialPayload(record), signer)
}

async function deriveCanonicalRecordId(record: RelationRecord): Promise<string> {
  const bytes = encoder.encode(jcsCanonicalize([record.createdBy, record.predicate, record.from, record.to]))
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes)
  return "rel-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

interface ParsedClaim {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signingInput: string
  signature: Uint8Array
}

/** Parse a compact claim JWS and check the header contract (alg, typ, kid
    present) and the payload version. Returns null when anything is off. */
function parseClaim(claim: unknown): ParsedClaim | null {
  if (typeof claim !== "string") return null
  const parts = claim.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string]
  const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerB64))) as Record<string, unknown>
  if (header.alg !== "EdDSA" || header.typ !== CLAIM_JWS_TYP || typeof header.kid !== "string") return null
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as Record<string, unknown>
  if (payload.v !== RLS_CLAIM_V1) return null
  return { header, payload, signingInput: `${headerB64}.${payloadB64}`, signature: fromBase64Url(signatureB64) }
}

/** Exact kid convention `<createdBy>#sig-0`, then the Ed25519 signature under
    the key resolved from the kid (did:key — fully local). */
async function verifyClaimSignature(parsed: ParsedClaim): Promise<boolean> {
  if (parsed.header.kid !== `${parsed.payload.createdBy}#sig-0`) return false
  const publicKeyBytes = ed25519PublicKeyFromDidKey(didFromKid(parsed.header.kid as string))
  if (!publicKeyBytes) return false
  const key = await globalThis.crypto.subtle.importKey("raw", publicKeyBytes as BufferSource, "Ed25519", false, ["verify"])
  return globalThis.crypto.subtle.verify(
    "Ed25519",
    key,
    parsed.signature as BufferSource,
    encoder.encode(parsed.signingInput) as BufferSource,
  )
}

async function signPayload(payload: Record<string, unknown>, signer: ClaimSigner): Promise<string> {
  const header = { alg: "EdDSA", kid: signer.kid, typ: CLAIM_JWS_TYP }
  const signingInput = `${toBase64Url(encoder.encode(jcsCanonicalize(header)))}.${toBase64Url(encoder.encode(jcsCanonicalize(payload)))}`
  const signature = await signer.signEd25519(encoder.encode(signingInput))
  return `${signingInput}.${toBase64Url(signature)}`
}

/**
 * Verify a record's claim per spec 08 (the `signed` half of the verdict
 * space; `trusted` is answered by authoritative connectors, never here).
 * Checks, in order: claim present and well-formed, typ header, payload
 * version and profile, kid↔createdBy binding, structural payload↔record
 * equality (all ten members), the canonical id rule, and the Ed25519
 * signature under the key resolved from the kid (did:key — fully local).
 */
export async function verifyRelationClaim(record: RelationRecord): Promise<"valid" | "invalid"> {
  try {
    const parsed = parseClaim(record.claim)
    if (!parsed) return "invalid"
    // relation-authorial exists ONLY for catalog predicates (spec 08) — a
    // formally correct claim on e.g. "blocks" is invalid.
    if (!isAuthorialPredicate(record.predicate)) return "invalid"
    if (parsed.payload.profile !== RELATION_AUTHORIAL_PROFILE) return "invalid"
    // Structural payload ↔ record equality over the exact wire shape.
    if (jcsCanonicalize(parsed.payload) !== jcsCanonicalize(relationAuthorialPayload(record))) return "invalid"
    // Canonical id rule (spec 08 rule 4): a record under a wrong key is
    // invalid even with an intact signature.
    if (record.id !== (await deriveCanonicalRecordId(record))) return "invalid"
    return (await verifyClaimSignature(parsed)) ? "valid" : "invalid"
  } catch {
    return "invalid"
  }
}

// ==================== item-authorial (spec 08 → Aussagen einer Person) ====================

/** A catalog entry: which data fields and which embedded-relation
    predicates form the content of a type. */
export interface AuthorialItemType {
  readonly data: readonly string[]
  readonly relations: readonly string[]
}

/**
 * The CLOSED v0.1 catalog of item types that are the statement of one
 * person (spec 08). Never sourced from space data — no client may reclassify
 * a type between authorial and collaborative. `post` is deliberately absent
 * (collaborative, rls#263).
 */
export const AUTHORIAL_ITEM_TYPES: ReadonlyMap<string, AuthorialItemType> = new Map<string, AuthorialItemType>([
  ["statement", Object.freeze({ data: Object.freeze(["title", "description", "variantOf"]), relations: Object.freeze([]) })],
  ["comment", Object.freeze({ data: Object.freeze(["content", "replyTo", "replyToComment"]), relations: Object.freeze(["commentOn"]) })],
  ["reaction", Object.freeze({ data: Object.freeze(["emoji"]), relations: Object.freeze(["reactsTo"]) })],
])

export function isAuthorialItemType(type: string): boolean {
  return AUTHORIAL_ITEM_TYPES.has(type)
}

/**
 * Authored items: their content is someone's statement, so only the author
 * may change it — the catalog types above plus relation records (whose
 * authorial predicates carry `relation-authorial`). The single source for
 * the authored-item guard; do not keep a parallel list.
 */
export function isAuthoredItemType(type: string): boolean {
  return type === "relation" || isAuthorialItemType(type)
}

/** The content of an authorial item: its content fields (null when absent)
    and, per content predicate, the sorted targets of its embedded relations. */
export interface ItemContent {
  data: Record<string, unknown>
  relations: Record<string, string[]>
}

type ContentSource = { type: string; data?: Record<string, unknown>; relations?: readonly Relation[] }

/**
 * Content per spec 08. Everything else — connector-maintained counts
 * (`reactions`, `myReaction`, `commentCount`), relations with other
 * predicates, `meta`, `tags`, the contract field `data.claim` — is not part
 * of it. Targets sort by UTF-16 code units, like JCS object keys. Returns
 * null for types outside the catalog.
 */
export function itemContent(item: ContentSource): ItemContent | null {
  const entry = AUTHORIAL_ITEM_TYPES.get(item.type)
  if (!entry) return null
  const data: Record<string, unknown> = {}
  for (const field of entry.data) data[field] = item.data?.[field] ?? null
  const relations: Record<string, string[]> = {}
  for (const predicate of entry.relations) {
    relations[predicate] = (item.relations ?? [])
      .filter((relation) => relation.predicate === predicate)
      .map((relation) => relation.target)
      .sort()
  }
  return { data, relations }
}

/** `"sha256:" + lowercase hex(SHA-256(UTF-8(JCS(value))))` — no Unicode normalisation. */
export async function contentHash(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(jcsCanonicalize(value)))
  return "sha256:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** Content hash of an authorial item, or null for types outside the catalog. */
export async function itemContentHash(item: ContentSource): Promise<string | null> {
  const content = itemContent(item)
  return content === null ? null : contentHash(content)
}

type ClaimableItem = Pick<Item, "id" | "type" | "createdBy" | "createdAt" | "data"> & { relations?: readonly Relation[] }

/** The exact wire payload `rls-claim/1` / `item-authorial`: all seven
    members ALWAYS present. Null for types outside the catalog. */
export function itemAuthorialPayload(item: ClaimableItem): Record<string, unknown> | null {
  const content = itemContent(item)
  if (content === null) return null
  return {
    v: RLS_CLAIM_V1,
    profile: ITEM_AUTHORIAL_PROFILE,
    id: item.id,
    type: item.type,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    content,
  }
}

/**
 * Sign an authorial item's content. The signer MUST be the author
 * (`kid` = `<createdBy>#sig-0`) and the type MUST be in the catalog.
 */
export async function signItemClaim(item: ClaimableItem, signer: ClaimSigner): Promise<string> {
  if (signer.kid !== `${item.createdBy}#sig-0`) {
    throw new Error(`Claim signer ${signer.kid} does not match item createdBy ${item.createdBy} (kid MUST be <createdBy>#sig-0)`)
  }
  const payload = itemAuthorialPayload(item)
  if (payload === null) throw new Error(`Type "${item.type}" is outside the authorial item catalog (spec 08)`)
  return signPayload(payload, signer)
}

/**
 * Verify an authorial item's claim (`data.claim`) per spec 08: type in the
 * catalog, claim well-formed, profile, kid↔createdBy, structural
 * payload↔item equality (identity, type and content), and the signature.
 */
export async function verifyItemClaim(item: ClaimableItem): Promise<"valid" | "invalid"> {
  try {
    const expected = itemAuthorialPayload(item)
    if (expected === null) return "invalid"
    const parsed = parseClaim(item.data?.claim)
    if (!parsed || parsed.payload.profile !== ITEM_AUTHORIAL_PROFILE) return "invalid"
    if (jcsCanonicalize(parsed.payload) !== jcsCanonicalize(expected)) return "invalid"
    return (await verifyClaimSignature(parsed)) ? "valid" : "invalid"
  } catch {
    return "invalid"
  }
}
