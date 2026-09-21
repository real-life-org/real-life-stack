"use client"

import { useState, useMemo, useCallback, type DragEvent } from "react"
import { ChevronDown, ChevronRight, Layers, LayoutList, Settings } from "lucide-react"
import { hasItemGroups, type Item } from "@real-life-stack/data-interface"

import { useConnector } from "../hooks/connector-context"
import { useItemFocus } from "../hooks/use-item-focus"
import { useUpdateItem } from "../hooks/use-mutations"
import { FilterMultiSelect, FilterSection, FilterToggle } from "../components/filter/filter-building-blocks"
import { useModuleHost } from "../components/host/module-host"
import { KanbanBoard } from "../components/kanban/kanban-board"
import { computeColumnReorder } from "../components/kanban/reorder"
import { ModuleToolbar } from "../components/layout/module-toolbar"
import { useModulePanel } from "../components/module-panel/module-panel"
import { ModuleSettingsPlaceholder } from "../components/module-panel/module-settings-placeholder"
import { ItemPreviewSkeleton } from "../components/preview/item-preview-skeleton"
import { ItemScopeBadge } from "../components/preview/item-scope-badge"
import { Button } from "../components/primitives/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../components/primitives/dropdown-menu"
import { Skeleton } from "../components/primitives/skeleton"
import { filterByAssignee } from "../lib/item-filter"
import type { ModuleViewProps } from "../lib/module-register"

/**
 * The mutation half of Kanban's drag handler.  Keeping it at module scope
 * makes the user-visible drag path directly contract-testable.
 */
export async function handleKanbanDrag(
  tasks: Item[],
  itemId: string,
  newStatus: string,
  position: number,
  updateItem: (id: string, updates: { data: Record<string, unknown> }) => unknown,
): Promise<void> {
  const item = tasks.find((task) => task.id === itemId)
  if (!item) return
  // Sequential and awaited: callers (and tests) observe completion/failure
  // instead of racing fire-and-forget writes.
  for (const update of computeColumnReorder(tasks, item, newStatus, position)) {
    await updateItem(update.id, { data: update.data })
  }
}

/**
 * Das Kanban-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host;
 * B5, 21.09.2026 — bis dahin `KanbanView` in der Referenz-App, das letzte
 * der sieben). Die Aufgaben laedt der Host aus `presents: ["status"]` (Spec
 * 01, Der Ladevertrag: das Feld entscheidet, nie der Typ), gefiltert nach
 * Suche, Tags und Typen. Dem Modul gehoeren Spalten, Verschieben, die
 * Gruppierung im Aggregat und seine eigenen Filter (Zuweisung, „Nur meine").
 * Mitglieder, Gruppen, Farben, Aggregat-Fall und aktives Item kommen vom
 * Host; Detail, Erstellen (Vorschlag „Aufgabe") und Plusknopf stellt er.
 */
export function KanbanModule({ items: tasks = [], itemsLoading: tasksLoading = false }: ModuleViewProps) {
  const connector = useConnector()
  const { members, groups, isOverview: isAggregate, currentUser, resolveItemGroupColor, activeItemId } = useModuleHost()
  // Scope tag on the card (Privat OR group), only in the meta group („Mein
  // Netzwerk") — in a concrete space the scope is clear, so no tag.
  const renderTaskAdornment = useCallback(
    (item: Item) => (isAggregate ? <ItemScopeBadge item={item} /> : null),
    [isAggregate],
  )
  const { mutate: updateItem } = useUpdateItem()
  // Tags, Typen und Suchtext hat der Host angewendet; „Nur meine" und die
  // Zuweisung bedeuten nur hier etwas und bleiben darum lokal (Spec
  // shared-components → Filter-State, Regel 2).
  const [myItemsOnly, setMyItemsOnly] = useState(false)
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const modulePanel = useModulePanel()
  // A card click points the focus at the task; the host opens its detail.
  const { focusItem } = useItemFocus()
  const [groupedView, setGroupedView] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  // Darauf die Extras des Kanban: Zuweisung ueber Relationen, „Nur meine".
  // Die Regel selbst liegt in `filterByAssignee`, samt der Fail-closed-
  // Entscheidung: „Nur meine" ohne bekannte Kennung zeigt nichts.
  const filteredTasks = useMemo(
    () => filterByAssignee(tasks, { assignedTo, myItemsOnly }, currentUser?.id),
    [tasks, assignedTo, myItemsOnly, currentUser?.id],
  )

  const handleMoveItem = (itemId: string, newStatus: string, position: number) =>
    handleKanbanDrag(tasks, itemId, newStatus, position, updateItem)

  // A card click points the URL focus at the task; the host opens its detail.
  const handleItemClick = useCallback((item: Item) => {
    focusItem(item.id)
  }, [focusItem])

  // All groups are concrete — no aggregate/overview group in the list anymore
  const concreteGroups = groups

  // Group tasks by their group for the grouped view
  const tasksByGroup = useMemo(() => {
    if (!isAggregate || !groupedView || !hasItemGroups(connector)) return null
    const map = new Map<string, Item[]>()
    for (const g of concreteGroups) {
      map.set(g.id, [])
    }
    // Collect items without a group under a special key
    map.set("__ungrouped__", [])
    for (const task of filteredTasks) {
      const gid = connector.getItemGroupId(task.id)
      if (gid && map.has(gid)) {
        map.get(gid)!.push(task)
      } else {
        map.get("__ungrouped__")!.push(task)
      }
    }
    return map
  }, [isAggregate, groupedView, connector, concreteGroups, filteredTasks])

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const viewModeToggle = isAggregate ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          {groupedView ? <LayoutList className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={!groupedView}
          onCheckedChange={() => setGroupedView(false)}
        >
          Zusammengeführt
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={groupedView}
          onCheckedChange={() => setGroupedView(true)}
        >
          Nach Gruppe
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : undefined

  const moveToGroup = useCallback((itemId: string, targetGroupId: string) => {
    if (!hasItemGroups(connector)) return
    const currentGroupId = connector.getItemGroupId(itemId)
    if (currentGroupId !== targetGroupId) {
      connector.moveItemToGroup(itemId, targetGroupId)
    }
  }, [connector])

  const handleGroupDrop = useCallback((e: DragEvent<HTMLDivElement>, targetGroupId: string) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData("text/plain")
    if (!itemId) return
    moveToGroup(itemId, targetGroupId)
  }, [moveToGroup])

  // Stable map of group-specific external drop handlers (avoids new closures per render)
  const externalDropHandlers = useMemo(() => {
    if (!tasksByGroup) return new Map<string, (itemId: string, newStatus: string, position: number) => void>()
    const map = new Map<string, (itemId: string, newStatus: string, position: number) => void>()
    for (const g of concreteGroups) {
      map.set(g.id, (itemId: string, newStatus: string, position: number) => {
        const item = tasks.find((t) => t.id === itemId)
        if (!item) return

        // Move to target group first
        moveToGroup(itemId, g.id)

        // Recalculate positions scoped to the TARGET GROUP's items in the
        // target column. The dragged item comes from another group, so it
        // is not part of that pool — computeColumnReorder takes it
        // explicitly.
        const groupItems = tasksByGroup.get(g.id) ?? []
        for (const update of computeColumnReorder(groupItems, item, newStatus, position)) {
          updateItem(update.id, { data: update.data })
        }
      })
    }
    return map
  }, [concreteGroups, moveToGroup, tasks, tasksByGroup, updateItem])

  const memberOptions = useMemo(
    () => members.map((m) => ({ id: m.id, label: m.displayName ?? m.id })),
    [members],
  )

  return (
    <div className="space-y-4">
      <ModuleToolbar
        drawerExtra={
          <>
            <FilterSection label="Schnellfilter">
              <FilterToggle
                label="Nur meine Aufgaben"
                value={myItemsOnly}
                onChange={setMyItemsOnly}
              />
            </FilterSection>
            {memberOptions.length > 0 && (
              <FilterSection label="Zuweisung">
                <FilterMultiSelect
                  options={memberOptions}
                  value={assignedTo}
                  onChange={setAssignedTo}
                />
              </FilterSection>
            )}
          </>
        }
        // `undefined`, wenn nichts aktiv ist — nicht ein Fragment, das gerade
        // nichts rendert: Daran haengt, ob der Kopf eine Zeile bekommt.
        chipsExtra={
          myItemsOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 pl-2 pr-1 py-0.5 text-xs font-medium">
              Nur meine
              <button
                type="button"
                onClick={() => setMyItemsOnly(false)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                aria-label="Filter entfernen"
              >
                ×
              </button>
            </span>
          ) : undefined
        }
        trailingActions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                modulePanel.open({
                  kind: "settings",
                  content: (
                    <ModuleSettingsPlaceholder
                      moduleLabel="Kanban"
                      plannedItems={["Spalten bearbeiten", "Standard-Gruppierung", "Sichtbarkeit der Spalten"]}
                    />
                  ),
                })
              }
              title="Moduleinstellungen"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {viewModeToggle}
          </>
        }
      />

      {tasksLoading ? (
        // Loading: a board-shaped skeleton (columns with placeholder cards).
        // The empty board (loaded, no tasks) intentionally stays as-is — the
        // columns themselves communicate "nothing here yet, drop/create".
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden>
          {[3, 2, 2].map((cards, c) => (
            <div key={c} className="space-y-3">
              <Skeleton className="h-5 w-24" />
              {Array.from({ length: cards }).map((_, i) => (
                <ItemPreviewSkeleton key={i} />
              ))}
            </div>
          ))}
        </div>
      ) : isAggregate && groupedView && tasksByGroup ? (
        <div className="space-y-6">
          {concreteGroups.map((group) => {
            const groupTasks = tasksByGroup.get(group.id) ?? []
            if (groupTasks.length === 0 && dragOverGroupId !== group.id) return null
            const isCollapsed = collapsedGroups.has(group.id)
            const isDragOver = dragOverGroupId === group.id
            return (
              <div key={group.id}>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setDragOverGroupId(group.id)
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null
                    if (related && e.currentTarget.contains(related)) return
                    setDragOverGroupId((prev) => prev === group.id ? null : prev)
                  }}
                  onDrop={(e) => {
                    setDragOverGroupId(null)
                    handleGroupDrop(e, group.id)
                  }}
                  className={`flex items-center gap-2 mb-3 px-2 py-1 -mx-2 rounded-lg transition-colors${isDragOver ? " bg-primary/10 ring-2 ring-primary/30" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                    {group.name}
                    <span className="text-xs font-normal text-muted-foreground">({groupTasks.length})</span>
                  </button>
                </div>
                {!isCollapsed && (
                  <KanbanBoard
                    items={groupTasks}
                    users={members}
                    onMoveItem={handleMoveItem}
                    onItemClick={handleItemClick}
                    activeItemId={activeItemId}
                    resolveItemGroupColor={resolveItemGroupColor}
                    renderCardAdornment={renderTaskAdornment}
                    onExternalDrop={externalDropHandlers.get(group.id)}
                  />
                )}
              </div>
            )
          })}
          {(tasksByGroup.get("__ungrouped__") ?? []).length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroupCollapse("__ungrouped__")}
                className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {collapsedGroups.has("__ungrouped__")
                  ? <ChevronRight className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />
                }
                Ohne Gruppe
                <span className="text-xs font-normal">({tasksByGroup.get("__ungrouped__")!.length})</span>
              </button>
              {!collapsedGroups.has("__ungrouped__") && (
                <KanbanBoard
                  items={tasksByGroup.get("__ungrouped__")!}
                  users={members}
                  onMoveItem={handleMoveItem}
                  onItemClick={handleItemClick}
                  activeItemId={activeItemId}
                  resolveItemGroupColor={resolveItemGroupColor}
                  renderCardAdornment={renderTaskAdornment}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <KanbanBoard
          items={filteredTasks}
          users={members}
          onMoveItem={handleMoveItem}
          onItemClick={handleItemClick}
          activeItemId={activeItemId}
          resolveItemGroupColor={resolveItemGroupColor}
          renderCardAdornment={renderTaskAdornment}
        />
      )}
    </div>
  )
}
