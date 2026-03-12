import { useEffect, useState, useCallback, useMemo } from "react"
import type { SignedClaim, VerificationDirection } from "@real-life-stack/data-interface"
import { hasSignedClaims } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

function useClaimConnector() {
  const connector = useConnector()
  if (!hasSignedClaims(connector)) {
    throw new Error("Connector does not support signed claims")
  }
  return connector
}

export function useClaims() {
  const connector = useClaimConnector()
  const observable = connector.observeClaims()
  const [claims, setClaims] = useState<SignedClaim[]>(observable.current)

  useEffect(() => observable.subscribe(setClaims), [observable])

  const verifications = useMemo(
    () => claims.filter((c) => c.tags?.includes("verification")),
    [claims]
  )

  const attestations = useMemo(
    () => claims.filter((c) => !c.tags?.includes("verification")),
    [claims]
  )

  const createClaim = useCallback(
    (toId: string, claim: string, tags?: string[]) => connector.createClaim(toId, claim, tags),
    [connector]
  )

  const setAccepted = useCallback(
    (id: string, accepted: boolean) => connector.setAccepted(id, accepted),
    [connector]
  )

  const getVerificationStatus = useCallback(
    (contactId: string): VerificationDirection => connector.getVerificationStatus(contactId),
    [connector]
  )

  return {
    claims,
    verifications,
    attestations,
    createClaim,
    setAccepted,
    getVerificationStatus,
  }
}

export function useVerification() {
  const connector = useClaimConnector()
  const [challenge, setChallenge] = useState<{ code: string; nonce: string } | null>(null)
  const [peerInfo, setPeerInfo] = useState<{ peerId: string; peerName?: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createChallenge = useCallback(async () => {
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
  }, [connector])

  const scanChallenge = useCallback(async (code: string) => {
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
  }, [connector])

  const confirmVerification = useCallback(async (code: string) => {
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
  }, [connector])

  const reset = useCallback(() => {
    setChallenge(null)
    setPeerInfo(null)
    setError(null)
    setIsProcessing(false)
  }, [])

  return {
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
