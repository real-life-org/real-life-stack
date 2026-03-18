import { useEffect, useState, useCallback, useMemo } from "react"
import type { SignedClaim, VerificationDirection } from "@real-life-stack/data-interface"
import { hasSignedClaims } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

export function useClaims() {
  const connector = useConnector()
  const supported = hasSignedClaims(connector)
  const observable = supported ? connector.observeClaims() : null
  const [claims, setClaims] = useState<SignedClaim[]>(observable?.current ?? [])

  useEffect(() => {
    if (!observable) return
    return observable.subscribe(setClaims)
  }, [observable])

  const verifications = useMemo(
    () => claims.filter((c) => c.tags?.includes("verification")),
    [claims]
  )

  const attestations = useMemo(
    () => claims.filter((c) => !c.tags?.includes("verification")),
    [claims]
  )

  const createClaim = useCallback(
    (toId: string, claim: string, tags?: string[]) => {
      if (!supported) throw new Error("Connector does not support signed claims")
      return connector.createClaim(toId, claim, tags)
    },
    [connector, supported]
  )

  const setAccepted = useCallback(
    (id: string, accepted: boolean) => {
      if (!supported) throw new Error("Connector does not support signed claims")
      return connector.setAccepted(id, accepted)
    },
    [connector, supported]
  )

  const getVerificationStatus = useCallback(
    (contactId: string): VerificationDirection => {
      if (!supported) return "none"
      return connector.getVerificationStatus(contactId)
    },
    [connector, supported]
  )

  return {
    supported,
    claims,
    verifications,
    attestations,
    createClaim,
    setAccepted,
    getVerificationStatus,
  }
}

const NOOP_VERIFICATION = {
  supported: false as const,
  challenge: null,
  peerInfo: null,
  isProcessing: false,
  error: null,
  createChallenge: async () => null,
  scanChallenge: async (_code: string) => null,
  confirmVerification: async (_code: string) => {},
  reset: () => {},
}

export function useVerification() {
  const connector = useConnector()
  const supported = hasSignedClaims(connector)
  const [challenge, setChallenge] = useState<{ code: string; nonce: string } | null>(null)
  const [peerInfo, setPeerInfo] = useState<{ peerId: string; peerName?: string; peerAvatar?: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createChallenge = useCallback(async () => {
    if (!supported) return null
    setError(null)
    setIsProcessing(true)
    try {
      const result = await connector.createChallenge()
      setChallenge(result)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge creation failed")
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [connector, supported])

  const scanChallenge = useCallback(async (code: string) => {
    if (!supported) return null
    setError(null)
    setIsProcessing(true)
    try {
      const info = await connector.prepareResponse(code)
      setPeerInfo(info)
      return info
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid challenge code")
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [connector, supported])

  const confirmVerification = useCallback(async (code: string) => {
    if (!supported) return
    setError(null)
    setIsProcessing(true)
    try {
      await connector.confirmAndRespond(code)
      setChallenge(null)
      setPeerInfo(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed")
    } finally {
      setIsProcessing(false)
    }
  }, [connector, supported])

  const reset = useCallback(() => {
    setChallenge(null)
    setPeerInfo(null)
    setError(null)
    setIsProcessing(false)
  }, [])

  if (!supported) return NOOP_VERIFICATION

  return {
    supported: true as const,
    challenge,
    peerInfo,
    isProcessing,
    error,
    createChallenge,
    scanChallenge,
    confirmVerification,
    reset,
  }
}
