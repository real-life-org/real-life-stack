import { useState } from "react"
import type { TraceEntry } from "./trace-timeline"

export type { TraceEntry }

export interface DebugSnapshot {
  impl: string
  persistence: {
    lastLoad: { source: string; timeMs: number; sizeBytes: number; details: Record<string, unknown>; at: string } | null
    saves: {
      compactStore: { lastAt: string | null; lastTimeMs: number; lastSizeBytes: number; totalSaves: number; errors: number }
      vault: { lastAt: string | null; lastTimeMs: number; lastSizeBytes: number; totalSaves: number; errors: number }
    }
    migration: { fromChunks: number; toSizeBytes: number; at: string } | null
    errors: Array<{ operation: string; error: string; at: string }>
  }
  spaces: Array<{
    spaceId: string
    name: string | null
    loadSource: string | null
    loadTimeMs: number | null
    docSizeBytes: number
    compactStoreSaves: number
    vaultSaves: number
    lastSaveMs: number | null
    members: number
  }>
  sync: { relay: { connected: boolean; url: string | null; peers: number; lastMessage: string | null } }
  automerge: {
    saveBlockedUiMs: { last: number; avg: number; max: number }
    docSizeBytes: number
    docStats: { contacts: number; attestations: number; spaces: number }
  }
  legacy: Record<string, unknown>
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 1000) return "gerade eben"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}min`
  return `${Math.floor(ms / 3_600_000)}h`
}

interface StoreInspectorProps {
  snapshot: DebugSnapshot | null
  traces: TraceEntry[]
}

export function StoreInspector({ snapshot, traces }: StoreInspectorProps) {
  const [section, setSection] = useState<"outbox" | "compact" | "personal" | "spaces">("outbox")

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Section selector */}
      <div className="flex gap-1 text-xs">
        {(["outbox", "compact", "personal", "spaces"] as const).map((s) => (
          <button
            key={s}
            className={`px-2 py-0.5 rounded ${section === s ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"}`}
            onClick={() => setSection(s)}
          >
            {s === "outbox" ? "Outbox" : s === "compact" ? "CompactStore" : s === "personal" ? "PersonalDoc" : "Spaces"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {section === "outbox" && <OutboxSection traces={traces} />}
        {section === "compact" && <CompactStoreSection traces={traces} />}
        {section === "personal" && <PersonalDocSection snapshot={snapshot} />}
        {section === "spaces" && <SpacesSection snapshot={snapshot} />}
      </div>
    </div>
  )
}

function OutboxSection({ traces }: { traces: TraceEntry[] }) {
  const outboxTraces = traces.filter((t) => t.store === "outbox")
  const sendTraces = traces.filter((t) => t.store === "relay" && t.operation === "send")

  const typeCounts = new Map<string, number>()
  for (const t of sendTraces) {
    const type = (t.meta?.type as string) ?? "unknown"
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }

  const lastFlush = outboxTraces.filter((t) => t.operation === "flush").at(-1)

  return (
    <div className="space-y-3 text-xs">
      <div>
        <h4 className="font-medium mb-1">Nachrichten-Typen (gesendet)</h4>
        {typeCounts.size === 0 ? (
          <span className="text-muted-foreground">Keine Nachrichten gesendet</span>
        ) : (
          <div className="space-y-0.5">
            {[...typeCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="font-mono">{type}</span>
                  <span className="tabular-nums font-medium">{count}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {lastFlush && (
        <div>
          <h4 className="font-medium mb-1">Letzter Flush</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
            <span className="text-muted-foreground">Vorher</span>
            <span>{(lastFlush.meta?.pendingBefore as number) ?? "?"}</span>
            <span className="text-muted-foreground">Nachher</span>
            <span>{(lastFlush.meta?.pendingAfter as number) ?? "?"}</span>
            <span className="text-muted-foreground">Zugestellt</span>
            <span>{(lastFlush.meta?.delivered as number) ?? "?"}</span>
            <span className="text-muted-foreground">Dauer</span>
            <span>{lastFlush.durationMs}ms</span>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium mb-1">Outbox-Aktivit\u00e4t</h4>
        <div className="space-y-0.5">
          {outboxTraces.slice(-10).map((t) => (
            <div key={t.id} className="flex justify-between text-[11px]">
              <span>
                {t.operation} — {t.label}
              </span>
              <span className={t.success ? "text-muted-foreground" : "text-red-500"}>{t.durationMs}ms</span>
            </div>
          ))}
          {outboxTraces.length === 0 && <span className="text-muted-foreground">Keine Outbox-Aktivit\u00e4t</span>}
        </div>
      </div>
    </div>
  )
}

function CompactStoreSection({ traces }: { traces: TraceEntry[] }) {
  const csTraces = traces.filter((t) => t.store === "compact-store")
  const writes = csTraces.filter((t) => t.operation === "write")
  const reads = csTraces.filter((t) => t.operation === "read")

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Reads" value={reads.length} />
        <StatBox label="Writes" value={writes.length} />
        <StatBox
          label="Avg Write"
          value={writes.length > 0 ? `${Math.round(writes.reduce((a, w) => a + w.durationMs, 0) / writes.length)}ms` : "-"}
        />
      </div>

      <div>
        <h4 className="font-medium mb-1">Letzte Operationen</h4>
        <div className="space-y-0.5">
          {csTraces.slice(-15).map((t) => (
            <div key={t.id} className="flex justify-between text-[11px]">
              <span className="truncate flex-1 mr-2">
                {t.operation} — {t.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {t.durationMs}ms {t.sizeBytes !== undefined && `(${formatSize(t.sizeBytes)})`}
              </span>
            </div>
          ))}
          {csTraces.length === 0 && <span className="text-muted-foreground">Keine CompactStore-Aktivit\u00e4t</span>}
        </div>
      </div>
    </div>
  )
}

function PersonalDocSection({ snapshot }: { snapshot: DebugSnapshot | null }) {
  if (!snapshot) return <span className="text-xs text-muted-foreground">Kein Snapshot verf\u00fcgbar</span>

  const { automerge, persistence } = snapshot

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Kontakte" value={automerge.docStats.contacts} />
        <StatBox label="Attestations" value={automerge.docStats.attestations} />
        <StatBox label="Spaces" value={automerge.docStats.spaces} />
      </div>

      <div>
        <h4 className="font-medium mb-1">Doc-Gr\u00f6\u00dfe</h4>
        <span>{formatSize(automerge.docSizeBytes)}</span>
      </div>

      {persistence.lastLoad && (
        <div>
          <h4 className="font-medium mb-1">Letzter Load</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
            <span className="text-muted-foreground">Quelle</span>
            <span>{persistence.lastLoad.source}</span>
            <span className="text-muted-foreground">Dauer</span>
            <span>{persistence.lastLoad.timeMs}ms</span>
            <span className="text-muted-foreground">Gr\u00f6\u00dfe</span>
            <span>{formatSize(persistence.lastLoad.sizeBytes)}</span>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium mb-1">Saves</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          <span className="text-muted-foreground">CompactStore</span>
          <span>
            {persistence.saves.compactStore.totalSaves}x
            {persistence.saves.compactStore.lastAt && ` (${formatAge(persistence.saves.compactStore.lastAt)})`}
          </span>
          <span className="text-muted-foreground">Vault</span>
          <span>
            {persistence.saves.vault.totalSaves}x
            {persistence.saves.vault.lastAt && ` (${formatAge(persistence.saves.vault.lastAt)})`}
          </span>
        </div>
      </div>

      {automerge.saveBlockedUiMs.max > 0 && (
        <div>
          <h4 className="font-medium mb-1">UI-Blocking</h4>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Letzter" value={`${automerge.saveBlockedUiMs.last}ms`} />
            <StatBox label="Avg" value={`${automerge.saveBlockedUiMs.avg}ms`} />
            <StatBox
              label="Max"
              value={`${automerge.saveBlockedUiMs.max}ms`}
              warn={automerge.saveBlockedUiMs.max > 50}
              error={automerge.saveBlockedUiMs.max > 100}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SpacesSection({ snapshot }: { snapshot: DebugSnapshot | null }) {
  if (!snapshot || snapshot.spaces.length === 0) {
    return <span className="text-xs text-muted-foreground">Keine Spaces geladen</span>
  }

  return (
    <div className="space-y-1 text-xs">
      {snapshot.spaces.map((space) => (
        <div key={space.spaceId} className="border border-border rounded p-2">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium truncate">{space.name ?? space.spaceId.slice(0, 12)}</span>
            <span className="text-[10px] text-muted-foreground">{space.members} Mitgl.</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-muted-foreground">Gr\u00f6\u00dfe</span>
            <span>{formatSize(space.docSizeBytes)}</span>
            {space.loadSource && (
              <>
                <span className="text-muted-foreground">Quelle</span>
                <span>{space.loadSource} ({space.loadTimeMs}ms)</span>
              </>
            )}
            <span className="text-muted-foreground">Saves</span>
            <span>CS:{space.compactStoreSaves} Vault:{space.vaultSaves}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatBox({
  label,
  value,
  warn,
  error,
}: {
  label: string
  value: string | number
  warn?: boolean
  error?: boolean
}) {
  return (
    <div className="bg-muted rounded p-1.5 text-center">
      <div className={`text-sm font-medium tabular-nums ${error ? "text-red-500" : warn ? "text-amber-500" : ""}`}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  )
}
