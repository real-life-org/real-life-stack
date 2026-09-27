"use client"

import { useRef, useState } from "react"
import { Download, MoreHorizontal, Upload } from "lucide-react"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { deriveContext, hasItemGroups, isWritable } from "@real-life-stack/data-interface"
import { useConnector } from "@/hooks/connector-context"
import { useItems } from "@/hooks/use-items"
import { buildExport, importItemData, planImport, type ImportPlan } from "@/lib/resonance-transfer"
import type { ResonancePopulation } from "@/lib/resonance-sort"
import { Button } from "../primitives/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu"

const STATEMENTS = { type: "statement" } as const

export interface ResonanceTransferMenuProps {
  /** The concrete space, or undefined in the overview — there the import
      asks for the target space first. */
  space: string | undefined
  /** Spaces an import may target from the overview (id + display name). */
  targetSpaces?: readonly { id: string; name: string }[]
  /** The signed-in person — the author of imported statements. */
  userId: string | undefined
  /** What the export covers: the statements as shown, with the counting data. */
  shownStatements: readonly Item[]
  verifiedRecords: readonly RelationRecord[]
  contentHashes: ReadonlyMap<string, string>
  population: ResonancePopulation
  tags: readonly string[]
}

type ImportState =
  | { phase: "review"; plan: ImportPlan; fileName: string }
  | { phase: "writing"; plan: ImportPlan }
  | { phase: "done"; created: number; skipped: number }
  | { phase: "failed"; message: string }

function download(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Import and export of the Resonance module (resonance.md → Import, Export),
 * in the ⋮ menu of its toolbar. Import validates the whole file before the
 * first write and skips statements the person already has; export follows the
 * chosen person set and filters and warns first that others' stances leave
 * the space.
 */
export function ResonanceTransferMenu({
  space,
  targetSpaces = [],
  userId,
  shownStatements,
  verifiedRecords,
  contentHashes,
  population,
  tags,
}: ResonanceTransferMenuProps) {
  const connector = useConnector()
  // All statements of the space — not only the shown ones: idempotency and
  // variantOf targets are about the space, not the current filter.
  const { data: spaceStatements } = useItems(STATEMENTS)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  // Target of the import: the current space, or — in the overview — the one
  // the person picks first (like the composer's group choice).
  const [pickedTarget, setPickedTarget] = useState<string | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const target = space ?? pickedTarget
  const canPick = space === undefined && hasItemGroups(connector) && targetSpaces.length > 0
  const canImport = userId !== undefined && isWritable(connector) && (space !== undefined || canPick)

  // Idempotency and variantOf targets are about the TARGET space.
  const statementsOf = (spaceId: string | null) =>
    spaceId !== null && hasItemGroups(connector)
      ? spaceStatements.filter((item) => connector.getItemGroupId(item.id) === spaceId)
      : spaceStatements

  const readFile = async (file: File) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setImportState({ phase: "failed", message: `„${file.name}“ ist keine gültige JSON-Datei.` })
      return
    }
    const plan = await planImport(parsed, { userId: userId!, statements: statementsOf(target) })
    setImportState({ phase: "review", plan, fileName: file.name })
  }

  const runImport = async (plan: ImportPlan) => {
    if (!isWritable(connector)) return
    setImportState({ phase: "writing", plan })
    try {
      for (const entry of plan.create) {
        const data = importItemData(entry)
        const created = await connector.createItem({
          type: "statement",
          createdBy: userId!,
          "@context": deriveContext("statement", data),
          data,
          ...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags } : {}),
        })
        // The space is a connector association, not item data (as in the
        // composer): place the statement where the import was aimed.
        if (target !== null && hasItemGroups(connector) && connector.getItemGroupId(created.id) !== target) {
          await connector.moveItemToGroup(created.id, target)
        }
      }
      setImportState({ phase: "done", created: plan.create.length, skipped: plan.skipped.length })
    } catch (error) {
      setImportState({ phase: "failed", message: error instanceof Error ? error.message : "Import fehlgeschlagen." })
    }
  }

  const runExport = async () => {
    const exportedAt = new Date().toISOString()
    const result = await buildExport({
      space: space ?? null,
      exportedAt,
      statements: shownStatements,
      verifiedRecords,
      contentHashes,
      population,
      tags,
    })
    download(`resonanz-${space ?? "uebersicht"}-${exportedAt.slice(0, 10)}.json`, `${JSON.stringify(result, null, 2)}\n`)
    setExportOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Weitere Aktionen">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="gap-2"
            disabled={!canImport}
            onSelect={() => (space !== undefined ? fileInput.current?.click() : setPickOpen(true))}
          >
            <Upload className="h-4 w-4" />
            Aussagen importieren …
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onSelect={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Auswertung exportieren …
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Importdatei wählen"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void readFile(file)
        }}
      />

      <Dialog open={importState !== null} onOpenChange={(open) => { if (!open && importState?.phase !== "writing") setImportState(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aussagen importieren</DialogTitle>
            {importState?.phase === "review" && importState.plan.errors.length > 0 && (
              <DialogDescription>
                „{importState.fileName}“ enthält Fehler. Es wird nichts importiert.
              </DialogDescription>
            )}
            {importState?.phase === "review" && importState.plan.errors.length === 0 && (
              <DialogDescription>
                {importState.plan.create.length === 1 ? "1 Aussage wird" : `${importState.plan.create.length} Aussagen werden`} angelegt
                {importState.plan.skipped.length > 0 && `, ${importState.plan.skipped.length} übersprungen, weil du sie schon eingebracht hast`}.
              </DialogDescription>
            )}
            {importState?.phase === "done" && (
              <DialogDescription>
                {importState.created === 1 ? "1 Aussage angelegt" : `${importState.created} Aussagen angelegt`}, {importState.skipped} übersprungen.
              </DialogDescription>
            )}
            {importState?.phase === "failed" && <DialogDescription>{importState.message}</DialogDescription>}
          </DialogHeader>

          {importState?.phase === "review" && importState.plan.errors.length > 0 && (
            <ul role="alert" className="max-h-60 space-y-1 overflow-y-auto text-sm text-destructive">
              {importState.plan.errors.map((error) => (
                <li key={`${error.index}-${error.message}`}>
                  {error.index >= 0 ? `Eintrag ${error.index + 1}: ` : ""}{error.message}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            {importState?.phase === "review" && importState.plan.errors.length === 0 && importState.plan.create.length > 0 ? (
              <>
                <DialogClose asChild>
                  <Button variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button onClick={() => void runImport(importState.plan)}>Importieren</Button>
              </>
            ) : (
              <DialogClose asChild>
                <Button variant="outline" disabled={importState?.phase === "writing"}>Schließen</Button>
              </DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Aussagen importieren</DialogTitle>
            <DialogDescription>In welchen Space sollen die Aussagen?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {targetSpaces.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setPickedTarget(option.id)
                  setPickOpen(false)
                  fileInput.current?.click()
                }}
              >
                {option.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auswertung exportieren</DialogTitle>
            <DialogDescription>
              Der Export enthält die Stellungnahmen anderer Menschen mit ihrer Identität. Mit der Datei verlassen diese Daten den Space.
              Exportiert werden die gezeigten Aussagen mit den Stimmen der gewählten Personen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Abbrechen</Button>
            </DialogClose>
            <Button onClick={() => void runExport()}>Exportieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
