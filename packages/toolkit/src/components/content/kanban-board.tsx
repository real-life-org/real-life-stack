import { useState, useCallback, type DragEvent } from "react"
import type { Item, User, Relation } from "@real-life-stack/data-interface"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
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
  onMoveItem?: (itemId: string, newStatus: string) => void
  onItemClick?: (item: Item) => void
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
  onDragStart: (e: DragEvent, itemId: string) => void
  onClick?: (item: Item) => void
}

function KanbanCard({ item, users, onDragStart, onClick }: KanbanCardProps) {
  const assigneeIds = getAssigneeIds(item)
  const assignees = (users ?? []).filter((u) => assigneeIds.includes(u.id))
  const tags = (item.data.tags as string[]) ?? []

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={() => onClick?.(item)}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing",
        "hover:border-primary/30 hover:shadow-md transition-all",
        "select-none"
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

export function KanbanBoard({
  items,
  columns = defaultColumns,
  users,
  onMoveItem,
  onItemClick,
}: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const handleDragStart = useCallback((e: DragEvent, itemId: string) => {
    e.dataTransfer.setData("text/plain", itemId)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const handleDragOver = useCallback((e: DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverColumn(columnId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent, columnId: string) => {
      e.preventDefault()
      setDragOverColumn(null)
      const itemId = e.dataTransfer.getData("text/plain")
      if (itemId && onMoveItem) {
        onMoveItem(itemId, columnId)
      }
    },
    [onMoveItem]
  )

  const itemsByColumn = new Map<string, Item[]>()
  for (const col of columns) {
    itemsByColumn.set(col.id, [])
  }
  for (const item of items) {
    const status = (item.data.status as string) ?? columns[0]?.id
    const list = itemsByColumn.get(status)
    if (list) list.push(item)
  }
  for (const list of itemsByColumn.values()) {
    list.sort((a, b) => ((a.data.position as number) ?? 0) - ((b.data.position as number) ?? 0))
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
      {columns.map((column) => {
        const columnItems = itemsByColumn.get(column.id) ?? []
        return (
          <Card
            key={column.id}
            className={cn(
              "transition-colors",
              dragOverColumn === column.id && "border-primary/50 bg-primary/5"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{column.label}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {columnItems.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 min-h-[100px]">
              {columnItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  users={users}
                  onDragStart={handleDragStart}
                  onClick={onItemClick}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
