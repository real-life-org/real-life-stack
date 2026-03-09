import { useState, useCallback, useMemo, type DragEvent } from "react"
import type { Item, User, Relation } from "@real-life-stack/data-interface"
import { Card, CardContent, CardHeader, CardTitle } from "../primitives/card"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { cn } from "../../lib/utils"

export interface KanbanColumn {
  id: string
  label: string
}

export const defaultColumns: KanbanColumn[] = [
  { id: "todo", label: "To Do" },
  { id: "doing", label: "In Arbeit" },
  { id: "done", label: "Erledigt" },
]

export interface KanbanBoardProps {
  items: Item[]
  columns?: KanbanColumn[]
  users?: User[]
  onMoveItem?: (itemId: string, newStatus: string, position: number) => void
  onItemClick?: (item: Item) => void
}

interface DropTarget {
  columnId: string
  index: number
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getAssigneeIds(item: Item): string[] {
  return (item.relations ?? [])
    .filter((r: Relation) => r.predicate === "assignedTo")
    .map((r: Relation) => r.target.replace(/^global:/, ""))
}

function getTagColor(tag: string): string {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  ]
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

interface KanbanCardProps {
  item: Item
  users?: User[]
  isDragged: boolean
  onDragStart: (e: DragEvent, itemId: string) => void
  onDragEnd?: () => void
  onClick?: (item: Item) => void
}

function KanbanCard({ item, users, isDragged, onDragStart, onDragEnd, onClick }: KanbanCardProps) {
  const assigneeIds = getAssigneeIds(item)
  const assignees = (users ?? []).filter((u) => assigneeIds.includes(u.id))
  const tags = (item.data.tags as string[]) ?? []

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(item)}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing",
        "hover:border-primary/30 hover:shadow-md transition-all",
        "select-none",
        isDragged && "opacity-50"
      )}
    >
      <p className="font-medium text-sm text-foreground leading-snug">
        {String(item.data.title ?? "")}
      </p>

      {item.data.description != null && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {String(item.data.description)}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", getTagColor(tag))}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {assignees.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <div className="flex -space-x-1.5">
            {assignees.map((user) => (
              <Avatar key={user.id} className="h-5 w-5 border border-background">
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                <AvatarFallback className="text-[8px] bg-muted">
                  {getInitials(user.displayName ?? user.id)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {assignees.length === 1 && (
            <span className="text-[10px] text-muted-foreground">
              {assignees[0].displayName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function DropIndicator({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "h-0.5 rounded-full transition-all mx-1",
        visible ? "bg-primary scale-x-100 my-1" : "scale-x-0 my-0 h-0"
      )}
    />
  )
}

export function KanbanBoard({
  items,
  columns = defaultColumns,
  users,
  onMoveItem,
  onItemClick,
}: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [floatingHoverColumn, setFloatingHoverColumn] = useState<string | null>(null)
  const handleDragStart = useCallback((e: DragEvent, itemId: string) => {
    e.dataTransfer.setData("text/plain", itemId)
    e.dataTransfer.effectAllowed = "move"
    setDraggedItemId(itemId)
  }, [])

  const handleCardDragOver = useCallback(
    (e: DragEvent, columnId: string, cardIndex: number) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = "move"
      setDragOverColumn(columnId)

      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const index = e.clientY < midY ? cardIndex : cardIndex + 1

      setDropTarget((prev) => {
        if (prev && prev.columnId === columnId && prev.index === index) return prev
        return { columnId, index }
      })
    },
    []
  )

  const handleColumnDragOver = useCallback(
    (e: DragEvent, columnId: string, itemCount: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverColumn(columnId)

      // Only set drop target to end if we're not over a card
      if (e.target === e.currentTarget) {
        setDropTarget({ columnId, index: itemCount })
      }
    },
    []
  )

  const handleDragLeave = useCallback((e: DragEvent) => {
    // Only clear if we're leaving the column entirely (not entering a child)
    const relatedTarget = e.relatedTarget as Node | null
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return
    setDragOverColumn(null)
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent, columnId: string, fallbackIndex: number) => {
      e.preventDefault()
      setDragOverColumn(null)
      const position = dropTarget?.columnId === columnId ? dropTarget.index : fallbackIndex
      setDropTarget(null)
      setDraggedItemId(null)
      const itemId = e.dataTransfer.getData("text/plain")
      if (itemId && onMoveItem) {
        onMoveItem(itemId, columnId, position)
      }
    },
    [onMoveItem, dropTarget]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null)
    setDragOverColumn(null)
    setDropTarget(null)
    setFloatingHoverColumn(null)
  }, [])

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const col of columns) {
      map.set(col.id, [])
    }
    for (const item of items) {
      const status = (item.data.status as string) ?? columns[0]?.id
      const list = map.get(status)
      if (list) list.push(item)
    }
    for (const list of map.values()) {
      list.sort((a, b) => ((a.data.position as number) ?? 0) - ((b.data.position as number) ?? 0))
    }
    return map
  }, [items, columns])

  const handleFloatingDrop = useCallback(
    (e: DragEvent, columnId: string) => {
      e.preventDefault()
      const itemId = e.dataTransfer.getData("text/plain")
      const columnItems = itemsByColumn.get(columnId) ?? []
      setDraggedItemId(null)
      setDragOverColumn(null)
      setDropTarget(null)
      setFloatingHoverColumn(null)
      if (itemId && onMoveItem) {
        onMoveItem(itemId, columnId, columnItems.length)
      }
    },
    [onMoveItem, itemsByColumn]
  )

  // Derive the source column of the dragged item (no extra state needed)
  const draggedItemColumnId = useMemo(() => {
    if (!draggedItemId) return null
    for (const [colId, colItems] of itemsByColumn) {
      if (colItems.some((item) => item.id === draggedItemId)) return colId
    }
    return null
  }, [draggedItemId, itemsByColumn])

  return (
    <>
      <div
        className="grid gap-4 grid-cols-1 md:[grid-template-columns:var(--kanban-cols)]"
        style={{ '--kanban-cols': `repeat(${columns.length}, minmax(0, 1fr))` } as React.CSSProperties}
      >
        {columns.map((column) => {
          const columnItems = itemsByColumn.get(column.id) ?? []
          return (
            <Card
              key={column.id}
              className={cn(
                "transition-colors",
                dragOverColumn === column.id && "border-primary/50 bg-primary/5"
              )}
              onDragOver={(e) => handleColumnDragOver(e, column.id, columnItems.length)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id, columnItems.length)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{column.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {columnItems.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 min-h-[100px]">
                <DropIndicator
                  visible={dropTarget?.columnId === column.id && dropTarget.index === 0}
                />
                {columnItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onDragOver={(e) => handleCardDragOver(e, column.id, idx)}
                    className="py-1"
                  >
                    <KanbanCard
                      item={item}
                      users={users}
                      isDragged={draggedItemId === item.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={onItemClick}
                    />
                    <DropIndicator
                      visible={
                        dropTarget?.columnId === column.id && dropTarget.index === idx + 1
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Floating Drop Bar — visible during drag for quick column changes.
          NOTE: HTML Drag & Drop API does not work on mobile touch devices.
          For Capacitor/mobile, @dnd-kit or manual touch handling will be needed. */}
      {draggedItemId !== null && (
        <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 fade-in md:hidden">
          <div className="flex flex-wrap gap-2 p-2 rounded-xl border bg-background/95 backdrop-blur shadow-lg">
            {columns.filter((col) => col.id !== draggedItemColumnId).map((column) => (
              <div
                key={column.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                }}
                onDragEnter={() => setFloatingHoverColumn(column.id)}
                onDragLeave={() => setFloatingHoverColumn((prev) => prev === column.id ? null : prev)}
                onDrop={(e) => handleFloatingDrop(e, column.id)}
                className={cn(
                  "flex-1 min-w-[80px] rounded-lg border-2 border-dashed px-3 py-2 text-center text-sm font-medium transition-colors",
                  floatingHoverColumn === column.id
                    ? "border-solid border-primary bg-primary/15 text-primary scale-105"
                    : "border-primary/30 text-foreground"
                )}
              >
                {column.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
