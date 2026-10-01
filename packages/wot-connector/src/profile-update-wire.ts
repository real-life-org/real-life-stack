import { deliverInboxMessage } from "@real-life/wot-core/application"
import type { MessagingAdapter } from "@real-life/wot-core/ports"
import { INBOX_MESSAGE_TYPE, createProfileUpdateBody } from "@real-life/wot-core/protocol"
import type { ProtocolCryptoAdapter } from "@real-life/wot-core/protocol"
import type { IdentitySession } from "@real-life/wot-core/types"

/**
 * Profiländerung an einen Kontakt (wot#386): verschlüsselte `inbox/1.0` mit
 * Body `{ kind:'profile-update', profile }` — derselbe Inner-JWS+ECIES-Weg wie
 * Attestationen. Ersetzt den Old-World-`profile-update`, den das Relay per
 * Whitelist verwarf; das Profil reist selbst mit (kein Profil-Dienst nötig).
 */
export async function sendProfileUpdateInbox(options: {
  identity: IdentitySession
  contactDid: string
  profile: { name: string; bio?: string; avatar?: string; updatedAt: string }
  recipientEncryptionPublicKey: Uint8Array
  messaging: MessagingAdapter
  crypto: ProtocolCryptoAdapter
  /** Runtime-Autoritäts-Guard: vor Sign und Send geprüft (wie attestation-wire). */
  ensureCurrent?: () => boolean
}): Promise<void> {
  const ensureCurrent = options.ensureCurrent ?? (() => true)
  if (!ensureCurrent()) throw new Error("wire aborted: runtime superseded")
  const envelope = await deliverInboxMessage({
    type: INBOX_MESSAGE_TYPE,
    body: createProfileUpdateBody(options.profile),
    from: options.identity.getDid(),
    to: options.contactDid,
    recipientEncryptionPublicKey: options.recipientEncryptionPublicKey,
    sign: (input) => {
      if (!ensureCurrent()) throw new Error("wire aborted: runtime superseded")
      return options.identity.signEd25519(input)
    },
    crypto: options.crypto,
  })
  if (!ensureCurrent()) throw new Error("wire aborted: runtime superseded")
  await options.messaging.send(envelope)
}
