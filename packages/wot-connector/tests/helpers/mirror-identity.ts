/**
 * Echte Ed25519-Identitäten für die Mirror-Tests: Spec 09 Invariante 3 und 5
 * hängen an der Signatur, deshalb wird hier nichts gestubbt — signiert und
 * geprüft wird mit WebCrypto gegen auflösbare did:key-DIDs.
 */
export interface MirrorTestIdentity {
  did: string
  kid: string
  publicKey: Uint8Array
  signEd25519(bytes: Uint8Array): Promise<Uint8Array>
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function base58btc(bytes: Uint8Array): string {
  let n = 0n
  for (const byte of bytes) n = (n << 8n) | BigInt(byte)
  let encoded = ""
  while (n > 0n) {
    encoded = B58[Number(n % 58n)] + encoded
    n /= 58n
  }
  return encoded
}

export async function makeMirrorIdentity(): Promise<MirrorTestIdentity> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
  const did = `did:key:z${base58btc(new Uint8Array([0xed, 0x01, ...raw]))}`
  return {
    did,
    kid: `${did}#sig-0`,
    publicKey: raw,
    signEd25519: async (input: Uint8Array) =>
      new Uint8Array(await crypto.subtle.sign("Ed25519", keyPair.privateKey, input as BufferSource)),
  }
}
