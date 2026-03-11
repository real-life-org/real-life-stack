"use client"

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type CSSProperties,
} from "react"
import { cn } from "../../lib/utils"
import { X, Maximize2, PanelRight, GripHorizontal } from "lucide-react"

export type PanelMode = "modal" | "sidebar" | "drawer"

export interface DrawerSnapConfig {
  /** Lower snap point as fraction of viewport height (default 0.2) — below this minus zone → close */
  lower?: number
  /** Upper snap point as fraction of viewport height (default 0.8) — above this → maximize to 100% */
  upper?: number
  /** Size of the snap zone in viewport fraction (default 0.05) */
  zone?: number
}

export interface AdaptivePanelProps {
  children: ReactNode
  open: boolean
  onClose: () => void
  allowedModes?: PanelMode[]
  side?: "left" | "right"
  sidebarWidth?: string
  sidebarMinWidth?: string
  sidebarMaxWidth?: string
  /** Tailwind classes for modal size, e.g. "max-w-2xl max-h-[80vh]" */
  modalClassName?: string
  /** Initial drawer height as fraction of viewport (default 0.55) */
  drawerInitialHeight?: number
  /** Snap configuration for the drawer */
  drawerSnap?: DrawerSnapConfig
  onModeChange?: (mode: PanelMode) => void
  onSidebarResize?: (width: number) => void
  className?: string
}

const VELOCITY_THRESHOLD = 0.5
const DRAWER_BREAKPOINT = 1024

function parsePx(value: string): number {
  if (value.endsWith("px")) return parseFloat(value)
  if (value.endsWith("vw")) return (parseFloat(value) / 100) * window.innerWidth
  if (value.endsWith("rem")) return parseFloat(value) * 16
  return parseFloat(value)
}

function useIsCompact() {
  const [isCompact, setIsCompact] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DRAWER_BREAKPOINT - 1}px)`)
    const onChange = () => setIsCompact(window.innerWidth < DRAWER_BREAKPOINT)
    mql.addEventListener("change", onChange)
    setIsCompact(window.innerWidth < DRAWER_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isCompact
}

function resolveMode(
  allowedModes: PanelMode[],
  isCompact: boolean
): PanelMode {
  const preferred = isCompact ? "drawer" : "sidebar"
  if (allowedModes.includes(preferred)) return preferred
  const fallback = "modal"
  if (allowedModes.includes(fallback)) return fallback
  return allowedModes[0]
}

// --- Mode Switch Button ---
function ModeSwitchButton({
  currentMode,
  allowedModes,
  isCompact,
  onSwitch,
}: {
  currentMode: PanelMode
  allowedModes: PanelMode[]
  isCompact: boolean
  onSwitch: (mode: PanelMode) => void
}) {
  let targetMode: PanelMode | null = null
  let Icon = Maximize2

  if (currentMode === "sidebar" && allowedModes.includes("modal")) {
    targetMode = "modal"
    Icon = Maximize2
  } else if (currentMode === "modal" && !isCompact && allowedModes.includes("sidebar")) {
    targetMode = "sidebar"
    Icon = PanelRight
  } else if (currentMode === "modal" && isCompact && allowedModes.includes("drawer")) {
    targetMode = "drawer"
    Icon = GripHorizontal
  } else if (currentMode === "drawer" && allowedModes.includes("modal")) {
    targetMode = "modal"
    Icon = Maximize2
  }

  if (!targetMode) return null

  return (
    <button
      type="button"
      onClick={() => onSwitch(targetMode!)}
      className="p-1.5 rounded-sm opacity-60 hover:opacity-100 transition-opacity"
      aria-label={`Zu ${targetMode} wechseln`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

export function AdaptivePanel({
  children,
  open,
  onClose,
  allowedModes = ["modal", "sidebar", "drawer"],
  side = "right",
  sidebarWidth: sidebarWidthProp = "400px",
  sidebarMinWidth = "280px",
  sidebarMaxWidth = "60vw",
  modalClassName,
  drawerInitialHeight = 0.55,
  drawerSnap: drawerSnapProp,
  onModeChange,
  onSidebarResize,
  className,
}: AdaptivePanelProps) {
  const isCompact = useIsCompact()
  const [mode, setMode] = useState<PanelMode>(() =>
    resolveMode(allowedModes, isCompact)
  )
  const [visible, setVisible] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)

  // Snap config with defaults
  const snapLower = drawerSnapProp?.lower ?? 0.2
  const snapUpper = drawerSnapProp?.upper ?? 0.8
  const snapZone = drawerSnapProp?.zone ?? 0.05

  // Sidebar resize state
  const [currentSidebarWidth, setCurrentSidebarWidth] = useState(() => parsePx(sidebarWidthProp))
  const [isResizing, setIsResizing] = useState(false)
  const resizeDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Drawer state — drawerY is percent from top (100 = hidden, 0 = full screen)
  const [drawerY, setDrawerY] = useState(100)
  const drawerYRef = useRef(100) // always-current mirror of drawerY for callbacks
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{
    startY: number
    startDrawerY: number
    lastY: number
    lastTime: number
    velocity: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Remember last drawer/sidebar sizes for restore after modal round-trip
  const lastDrawerYRef = useRef(100 - drawerInitialHeight * 100)
  const lastSidebarWidthRef = useRef(parsePx(sidebarWidthProp))

  // Keep drawerYRef in sync
  useEffect(() => {
    drawerYRef.current = drawerY
  }, [drawerY])

  // Resolve mode on viewport change
  useEffect(() => {
    const newMode = resolveMode(allowedModes, isCompact)
    if (newMode !== mode) {
      setMode(newMode)
      onModeChange?.(newMode)
    }
  }, [isCompact, allowedModes])

  // Set CSS variables for content displacement
  useEffect(() => {
    const root = document.documentElement
    if (mode === "sidebar" && open && !animatingOut) {
      const width = `${currentSidebarWidth}px`
      if (side === "right") {
        root.style.setProperty("--adaptive-panel-margin-right", width)
        root.style.setProperty("--adaptive-panel-margin-left", "0px")
      } else {
        root.style.setProperty("--adaptive-panel-margin-left", width)
        root.style.setProperty("--adaptive-panel-margin-right", "0px")
      }
    } else {
      root.style.setProperty("--adaptive-panel-margin-right", "0px")
      root.style.setProperty("--adaptive-panel-margin-left", "0px")
    }
    return () => {
      root.style.setProperty("--adaptive-panel-margin-right", "0px")
      root.style.setProperty("--adaptive-panel-margin-left", "0px")
    }
  }, [mode, open, animatingOut, currentSidebarWidth, side])

  // Manual mode switch — restore remembered sizes
  const handleModeSwitch = useCallback(
    (targetMode: PanelMode) => {
      if (!allowedModes.includes(targetMode)) return

      // Save current sizes before switching away
      if (mode === "drawer") {
        lastDrawerYRef.current = drawerYRef.current
      } else if (mode === "sidebar") {
        lastSidebarWidthRef.current = currentSidebarWidth
      }

      setMode(targetMode)
      onModeChange?.(targetMode)

      // Restore sizes when switching back
      if (targetMode === "drawer") {
        const restoreY = lastDrawerYRef.current
        setDrawerY(100)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDrawerY(restoreY)
          })
        })
      } else if (targetMode === "sidebar") {
        setCurrentSidebarWidth(lastSidebarWidthRef.current)
      }
    },
    [allowedModes, onModeChange, mode, currentSidebarWidth]
  )

  // Track previous open state to distinguish fresh open vs mode switch
  const prevOpenRef = useRef(false)

  // Open/close animation
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    if (open) {
      setVisible(true)
      setAnimatingOut(false)
      // Only animate drawer to initial height on fresh open (not on mode switch)
      if (mode === "drawer" && !wasOpen) {
        setDrawerY(100)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDrawerY(100 - drawerInitialHeight * 100)
          })
        })
      }
    } else if (visible) {
      setAnimatingOut(true)
      if (mode === "drawer") {
        setDrawerY(100)
      }
      const timer = setTimeout(() => {
        setVisible(false)
        setAnimatingOut(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, mode])

  // --- Drawer snap logic ---
  // Determines what happens on pointer up based on current position and velocity
  const resolveDrawerRelease = useCallback(
    (currentY: number, velocity: number): "close" | "snap-lower" | "maximize" | "stay" => {
      const visibleFraction = (100 - currentY) / 100

      // Fast downward swipe near bottom → close
      if (velocity > VELOCITY_THRESHOLD && visibleFraction < snapLower + snapZone * 2) {
        return "close"
      }
      // Fast upward swipe near top → maximize
      if (velocity < -VELOCITY_THRESHOLD && visibleFraction > snapUpper - snapZone * 2) {
        return "maximize"
      }

      // Below lower snap zone → close
      if (visibleFraction < snapLower - snapZone) {
        return "close"
      }
      // Inside lower snap zone → snap to lower
      if (visibleFraction < snapLower + snapZone) {
        return "snap-lower"
      }
      // Above upper snap threshold → maximize to 100%
      if (visibleFraction > snapUpper) {
        return "maximize"
      }
      // Between snap zones → stay where it is
      return "stay"
    },
    [snapLower, snapUpper, snapZone]
  )

  // --- Drawer Pointer Events ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== "drawer") return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setIsDragging(true)
      dragRef.current = {
        startY: e.clientY,
        startDrawerY: drawerY,
        lastY: e.clientY,
        lastTime: Date.now(),
        velocity: 0,
      }
    },
    [mode, drawerY]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || mode !== "drawer") return

      const now = Date.now()
      const dt = now - dragRef.current.lastTime
      if (dt > 0) {
        dragRef.current.velocity = (e.clientY - dragRef.current.lastY) / dt
      }
      dragRef.current.lastY = e.clientY
      dragRef.current.lastTime = now

      const viewportH = window.innerHeight
      const deltaPixels = e.clientY - dragRef.current.startY
      const deltaPercent = (deltaPixels / viewportH) * 100
      let newY = dragRef.current.startDrawerY + deltaPercent

      // Upper bound: rubber-band past full screen (0%)
      if (newY < 0) {
        newY = newY * 0.3
      }
      // Lower bound: rubber-band past hidden
      if (newY > 100) {
        const overflow = newY - 100
        newY = 100 + overflow * 0.3
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setDrawerY(newY)
      })
    },
    [mode]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || mode !== "drawer") return
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      setIsDragging(false)

      const velocity = dragRef.current.velocity
      const action = resolveDrawerRelease(drawerY, velocity)
      dragRef.current = null

      switch (action) {
        case "close":
          onClose()
          break
        case "snap-lower":
          setDrawerY(100 - snapLower * 100)
          lastDrawerYRef.current = 100 - snapLower * 100
          break
        case "maximize":
          setDrawerY(0)
          lastDrawerYRef.current = 0
          break
        case "stay":
          // Keep current position, remember it
          lastDrawerYRef.current = drawerY
          break
      }
    },
    [mode, drawerY, resolveDrawerRelease, onClose, snapLower]
  )

  // --- Sidebar Resize Pointer Events ---
  // Disable content padding transition during resize
  useEffect(() => {
    if (isResizing) {
      document.documentElement.classList.add("adaptive-panel-resizing")
    } else {
      document.documentElement.classList.remove("adaptive-panel-resizing")
    }
    return () => document.documentElement.classList.remove("adaptive-panel-resizing")
  }, [isResizing])

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setIsResizing(true)
      resizeDragRef.current = {
        startX: e.clientX,
        startWidth: currentSidebarWidth,
      }
    },
    [currentSidebarWidth]
  )

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeDragRef.current) return

      const minW = parsePx(sidebarMinWidth)
      const maxW = parsePx(sidebarMaxWidth)
      const delta = side === "right"
        ? resizeDragRef.current.startX - e.clientX
        : e.clientX - resizeDragRef.current.startX
      const newWidth = Math.max(minW, Math.min(maxW, resizeDragRef.current.startWidth + delta))

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setCurrentSidebarWidth(newWidth)
        const root = document.documentElement
        const width = `${newWidth}px`
        if (side === "right") {
          root.style.setProperty("--adaptive-panel-margin-right", width)
        } else {
          root.style.setProperty("--adaptive-panel-margin-left", width)
        }
      })
    },
    [side, sidebarMinWidth, sidebarMaxWidth]
  )

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeDragRef.current) return
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      setIsResizing(false)
      lastSidebarWidthRef.current = currentSidebarWidth
      onSidebarResize?.(currentSidebarWidth)
      resizeDragRef.current = null
    },
    [currentSidebarWidth, onSidebarResize]
  )

  const handleResizeDoubleClick = useCallback(() => {
    const defaultWidth = parsePx(sidebarWidthProp)
    setCurrentSidebarWidth(defaultWidth)
    lastSidebarWidthRef.current = defaultWidth
    onSidebarResize?.(defaultWidth)
  }, [sidebarWidthProp, onSidebarResize])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  // Lock body scroll when modal or drawer is open
  useEffect(() => {
    if (open && (mode === "modal" || mode === "drawer")) {
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open, mode])

  if (!visible && !open) return null

  const isOpen = open && !animatingOut

  // --- Header Buttons (shared across modes) ---
  const headerButtons = (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5">
      <ModeSwitchButton
        currentMode={mode}
        allowedModes={allowedModes}
        isCompact={isCompact}
        onSwitch={handleModeSwitch}
      />
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-sm opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Schliessen</span>
      </button>
    </div>
  )

  // --- MODAL ---
  if (mode === "modal") {
    return (
      <div className="fixed inset-0 z-[60]">
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />
        {/* Content */}
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div
            ref={panelRef}
            className={cn(
              "relative bg-background rounded-lg border shadow-lg pointer-events-auto",
              "w-full max-w-lg max-h-[90vh] overflow-hidden",
              "transition-all duration-200",
              isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95",
              modalClassName,
              className
            )}
          >
            {headerButtons}
            <div className="overflow-y-auto max-h-[inherit]">{children}</div>
          </div>
        </div>
      </div>
    )
  }

  // --- SIDEBAR ---
  if (mode === "sidebar") {
    const isLeft = side === "left"

    return (
      <div
        ref={panelRef}
        className={cn(
          "fixed top-14 bottom-0 bg-background shadow-xl flex overflow-hidden",
          "z-40",
          isLeft ? "left-0" : "right-0",
          className
        )}
        style={{
          width: isOpen ? `${currentSidebarWidth}px` : "0px",
          transition: isResizing ? "none" : "width 300ms ease-out",
        } as CSSProperties}
      >
        {/* Resize handle */}
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onDoubleClick={handleResizeDoubleClick}
          className={cn(
            "absolute top-0 bottom-0 w-3 cursor-col-resize z-10 group flex items-center justify-center",
            isLeft ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
          )}
          style={{ touchAction: "none" }}
        >
          <div
            className={cn(
              "w-[2px] h-8 rounded-full transition-all duration-150",
              isResizing
                ? "bg-primary w-1 h-12"
                : "bg-border group-hover:bg-primary/50 group-hover:w-1 group-hover:h-12"
            )}
          />
        </div>
        {/* Panel content — fixed width to prevent text reflow during width animation */}
        <div
          className={cn(
            "flex-1 flex flex-col overflow-hidden",
            isLeft ? "border-r" : "border-l"
          )}
          style={{ minWidth: `${currentSidebarWidth}px` }}
        >
          <div className="relative flex-1 overflow-y-auto">
            {headerButtons}
            {children}
          </div>
        </div>
      </div>
    )
  }

  // --- DRAWER ---
  const drawerTransition = isDragging
    ? "none"
    : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms cubic-bezier(0.32, 0.72, 0, 1)"

  // Fade out when dragged below the lower snap zone
  const visibleFraction = (100 - drawerY) / 100
  const fadeStart = snapLower - snapZone
  const drawerOpacity = visibleFraction < fadeStart
    ? Math.max(0, visibleFraction / fadeStart)
    : 1

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 transition-opacity duration-200 pointer-events-auto",
          isOpen && drawerY < 90 ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-x-0 bottom-0 bg-background rounded-t-xl shadow-xl pointer-events-auto",
          "flex flex-col",
          className
        )}
        style={{
          height: "100vh",
          transform: `translateY(${drawerY}%)`,
          opacity: drawerOpacity,
          transition: drawerTransition,
        } as CSSProperties}
      >
        {/* Drag handle + mode switch */}
        <div className="flex-shrink-0 relative">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex justify-center items-center py-3 cursor-grab active:cursor-grabbing select-none"
            style={{ touchAction: "none" }}
          >
            <div
              className={cn(
                "w-10 h-1 rounded-full transition-all duration-150",
                isDragging
                  ? "bg-primary w-14 h-1.5"
                  : "bg-muted-foreground/30"
              )}
            />
          </div>
          {/* Mode switch button in top-right of drawer */}
          <div className="absolute top-2 right-3 flex items-center gap-0.5">
            <ModeSwitchButton
              currentMode={mode}
              allowedModes={allowedModes}
              isCompact={isCompact}
              onSwitch={handleModeSwitch}
            />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}
