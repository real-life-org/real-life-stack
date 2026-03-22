import { useState, useMemo } from "react"
import { Copy, Check, Trash2 } from "lucide-react"

// Inline types to avoid cross-repo dependency on @real-life/wot-core
export interface TraceEntry {
  id: number
  timestamp: string
  store: string
  operation: string
  label: string
  durationMs: number
  sizeBytes?: number
  success: boolean
  error?: string
  meta?: Record<string, unknown>
}

const STORE_COLORS: Record<string, string> = {
  "compact-store": "bg-blue-500",
  relay: "bg-green-500",
  vault: "bg-purple-500",
  profiles: "bg-amber-500",
  outbox: "bg-orange-500",
  "personal-doc": "bg-cyan-500",
  crdt: "bg-teal-500",
  crypto: "bg-pink-500",
}

const STORE_LABELS: Record<string, string> = {
  "compact-store": "CS",
  relay: "Relay",
  vault: "Vault",
  profiles: "Prof",
  outbox: "Outbox",
  "personal-doc": "PDoc",
  crdt: "CRDT",
  crypto: "Crypto",
}

type Direction = "out" | "in" | "error" | "neutral"

function getDirection(operation: string): Direction {
  switch (operation) {
    case "send":
    case "write":
    case "flush":
      return "out"
    case "receive":
    case "read":
      return "in"
    case "error":
      return "error"
    default:
      return "neutral"
  }
}

const DIRECTION_STYLE: Record<Direction, { icon: string; className: string }> = {
  out:     { icon: "\u2197", className: "text-blue-500 font-bold" },   // ↗
  in:      { icon: "\u2199", className: "text-green-500 font-bold" },  // ↙
  error:   { icon: "\u274C", className: "text-red-500" },              // ❌
  neutral: { icon: "\u2022", className: "text-muted-foreground" },     // •
}

/** Strip redundant send/receive prefix and arrow symbols from label */
/** Split label into action part and optional DID/target part */
function splitLabel(label: string): { action: string; target: string } {
  let cleaned = label
  // Remove "send "/"receive " prefix — direction is shown via badge arrow
  cleaned = cleaned.replace(/^(send|receive)\s+/i, "")

  // Split on → or ← to separate action from DID target
  const arrowMatch = cleaned.match(/^(.+?)\s*[→←]\s*(.+)$/)
  if (arrowMatch) {
    return { action: arrowMatch[1].trim(), target: arrowMatch[2].trim() }
  }

  // Split on DID pattern inline (e.g. "publishProfile did:key:...")
  const didMatch = cleaned.match(/^(.+?)\s+(did:\S+.*)$/)
  if (didMatch) {
    return { action: didMatch[1].trim(), target: didMatch[2].trim() }
  }

  return { action: cleaned.trim(), target: "" }
}

function durationColor(ms: number, success: boolean): string {
  if (!success) return "bg-red-500"
  if (ms > 100) return "bg-amber-500"
  return "bg-green-500"
}

function formatTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 1000) return "jetzt"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  return `${Math.floor(ms / 86_400_000)}d`
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ""
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface TraceTimelineProps {
  entries: TraceEntry[]
  onClear?: () => void
}

function formatTraceForCopy(entries: TraceEntry[]): string {
  return entries.map((e) => {
    const dir = getDirection(e.operation)
    const arrow = dir === "out" ? "↗" : dir === "in" ? "↙" : "•"
    const status = e.success ? "OK" : "ERR"
    const parts = [
      `[${e.timestamp}]`,
      e.store.padEnd(8),
      arrow,
      status.padEnd(3),
      e.label,
      `${e.durationMs}ms`,
    ]
    if (e.sizeBytes) parts.push(formatSize(e.sizeBytes))
    if (e.error) parts.push(`ERROR: ${e.error}`)
    return parts.join("  ")
  }).join("\n")
}

export function TraceTimeline({ entries, onClear }: TraceTimelineProps) {
  const [storeFilter, setStoreFilter] = useState<string>("all")
  const [opFilter, setOpFilter] = useState<string>("all")
  const [expanded, setExpanded] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const filtered = useMemo(() => {
    let result = entries
    if (storeFilter !== "all") result = result.filter((e) => e.store === storeFilter)
    if (opFilter !== "all") result = result.filter((e) => e.operation === opFilter)
    return result.slice(-100).reverse()
  }, [entries, storeFilter, opFilter])

  const maxDuration = useMemo(() => Math.max(1, ...filtered.map((e) => e.durationMs)), [filtered])

  const stores = useMemo(() => [...new Set(entries.map((e) => e.store))].sort(), [entries])
  const ops = useMemo(() => [...new Set(entries.map((e) => e.operation))].sort(), [entries])

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap text-xs">
        <select
          className="bg-muted rounded px-1.5 py-0.5 text-xs border-0"
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
        >
          <option value="all">Alle Stores</option>
          {stores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-muted rounded px-1.5 py-0.5 text-xs border-0"
          value={opFilter}
          onChange={(e) => setOpFilter(e.target.value)}
        >
          <option value="all">Alle Ops</option>
          {ops.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground ml-auto flex items-center gap-1.5">
          <button
            className="hover:text-foreground transition-colors"
            title="Trace kopieren"
            onClick={() => {
              navigator.clipboard?.writeText(formatTraceForCopy(filtered))
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          {onClear && (
            <button
              className="hover:text-foreground transition-colors"
              title="Trace zurücksetzen"
              onClick={onClear}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {filtered.length === 0 && (
          <div className="text-muted-foreground text-xs text-center py-8">Keine Traces vorhanden</div>
        )}
        {filtered.map((entry) => {
          const dir = getDirection(entry.operation)
          return (
            <div key={entry.id}>
              <button
                className="w-full text-left flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/50 transition-colors text-xs"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                {/* Store badge */}
                <span
                  className={`shrink-0 w-10 text-center text-[10px] font-medium text-white rounded px-1 py-0.5 ${STORE_COLORS[entry.store] ?? "bg-gray-500"}`}
                >
                  {STORE_LABELS[entry.store] ?? entry.store}
                </span>

                {/* Direction icon */}
                <span className={`shrink-0 w-4 text-center text-sm leading-none ${DIRECTION_STYLE[dir].className}`}>{DIRECTION_STYLE[dir].icon}</span>

                {/* Label — action + responsive DID */}
                {(() => {
                  const { action, target } = splitLabel(entry.label)
                  return (
                    <span className={`truncate flex-1 min-w-0 ${entry.success ? "" : "text-red-500"}`}>
                      {action}
                      {target && (
                        <span className="hidden @lg:inline text-muted-foreground"> → {target}</span>
                      )}
                    </span>
                  )
                })()}

                {/* Duration bar */}
                <span className="shrink-0 w-16 flex items-center gap-1">
                  <span
                    className={`h-1.5 rounded-full ${durationColor(entry.durationMs, entry.success)}`}
                    style={{ width: `${Math.max(2, (entry.durationMs / maxDuration) * 100)}%` }}
                  />
                  <span className="text-[9px] tabular-nums text-muted-foreground">{entry.durationMs}ms</span>
                </span>

                {/* Time */}
                <span className="shrink-0 text-[9px] text-muted-foreground tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
              </button>
              {expanded === entry.id && (
                <ExpandedEntry entry={entry} onClose={() => setExpanded(null)} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Keys that are already visible in the trace row — no need to repeat in details. */
const HIDDEN_META_KEYS = new Set(["type", "status"])

function formatValue(_key: string, value: unknown): string {
  return String(value)
}

function ExpandedEntry({ entry, onClose }: { entry?: TraceEntry; onClose: () => void }) {
  if (!entry) return null

  const meta = entry.meta
    ? Object.entries(entry.meta).filter(
        ([k, v]) => v !== undefined && v !== null && !HIDDEN_META_KEYS.has(k)
      )
    : []

  const time = new Date(entry.timestamp)
  const timeStr = time.toLocaleTimeString("de-DE", { hour12: false }) + "." + String(time.getMilliseconds()).padStart(3, "0")

  return (
    <div className="bg-muted/30 rounded-md mx-1 mb-1 p-2 text-[11px] space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{entry.durationMs}ms</span>
          {entry.sizeBytes !== undefined && (
            <span className="text-muted-foreground">{formatSize(entry.sizeBytes)}</span>
          )}
          <span className="text-muted-foreground">{timeStr}</span>
          <span className="text-muted-foreground">({formatTime(entry.timestamp)})</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground px-1">
          &times;
        </button>
      </div>

      {/* Error */}
      {entry.error && (
        <div className="text-red-500 bg-red-500/10 rounded px-2 py-1 font-mono text-[10px] break-all">
          {entry.error}
        </div>
      )}

      {/* Meta details */}
      {meta.length > 0 && (
        <div className="space-y-0.5">
          {meta.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground shrink-0 w-20 text-right">{key}</span>
              <span
                className="font-mono text-[10px] break-all cursor-pointer"
                title={String(value)}
                onClick={() => navigator.clipboard?.writeText(String(value))}
              >
                {formatValue(key, value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
