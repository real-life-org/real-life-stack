# Toolkit-Index (0.1.6)

Erzeugt aus den Typdateien des gebauten Pakets mit `scripts/toolkit-index.mjs`. Nicht von Hand ändern. Je Bereich: exportierte Namen mit dem ersten Satz ihres JSDoc. Die Zone sagt, wo der Baustein in der [Anatomie eines Moduls](anatomie-eines-moduls.md) hingehört.

## layout — App-Shell und Modulfläche

- `AppShell`
- `AppShellMain`
- `PanelSafeArea` — Der Bereich einer vollflaechigen Modulflaeche, den ein offenes Panel NICHT verdeckt.
- `PanelSafeAreaProps`
- `ModuleToolbar` — Der eine Beitrag eines Moduls zu seiner Flaeche — und ihre Verteilung auf zwei Orte (Design-Board 2a/2g): - **Kopf** (oben): Suche und Modul-Aktionen in der ers
- `ModuleToolbarProps`
- `ModuleFrame` — Die Modulflaeche als Spalte: fester Kopf, darunter der Scrollbereich (Spec 01 → „Die Modulflaeche ist eine Spalte").
- `ModuleControls` — Die schwebende Ecke unten links einer Modulflaeche — Heimat der Filter-Pille (Design-Board: `bottom:16px; left:16px`).
- `moduleContainerClass`
- `moduleBleedContentClass` — Die Breite des Inhalts einer randlosen Flaeche (`fill: "bleed"`).
- `resolveModuleLayout` — Das Layout einer Flaeche: aus dem Register, wenn eine Id vorliegt, sonst aus dem, was der Aufrufer mitbringt.
- `useModuleLayout`
- `useModuleContentClass` — Die Breite, in der der Inhalt dieser Flaeche steht.
- `useOptionalModuleHead` — Der Kopf der umgebenden Modulflaeche — `null`, wenn es keine gibt.
- `ModuleFrameProps`
- `ModuleLayout` — Die Geometrie eines Moduls: Randabstand, Zentrierung, Hoechstbreite.
- `ModuleSurfaceScope` — Alles, was eine Modulflaeche braucht und normalerweise die App stellt: einen Besitzer fuer den Filter und die Flaeche selbst (Kopf und schwebende Ecke).
- `ModuleSurfaceScopeProps`
- `PanelHeaderActions` — Haengt Aktionen in die Knopfleiste des umgebenden Panels — links neben dessen eigene Knoepfe (Modus, Schliessen).
- `PanelHeaderSlotContext` — Das DOM-Element in der Knopfleiste des umgebenden Panels, in das Inhalte ihre eigenen Kopf-Aktionen legen duerfen.
- `PanelHeaderActionsProps`
- `readPanelEdges` — `AdaptivePanel` veroeffentlicht zwei Groessen: `--adaptive-panel-margin-*` (wieviel Platz dem Inhalt genommen wird, Luft eingerechnet) und `--adaptive-panel-edg
- `usePanelEdges` — Dieselben Raender, aber reaktiv: Ein Panel oeffnet in einem eigenen Effekt, also erst NACH dem Klick, der es ausgeloest hat.
- `PanelEdges` — Wo die Kanten der offenen Panels liegen, gemessen vom jeweiligen Fensterrand in CSS-Pixeln — also der Bereich, den sie UEBERDECKEN, nicht der groessere Abstand,
- `Navbar`
- `NavbarStart`
- `NavbarCenter`
- `NavbarEnd`
- `WorkspaceSwitcher`
- `UserMenu`
- `ModuleTabs`
- `BottomNav`
- `ConnectorSwitcher`
- `AdaptivePanel`
- `GroupDialog`

## navigation — App-Shell (Navbar, Tabs)

- `FieldNavigationProvider`
- `useFieldLink` — Die Aktion fuer ein Feld — oder `null`.
- `FieldNavigationValue` — Wie ein Feld zu der Sicht fuehrt, die es darstellen kann: ein Datum in den Kalender, eine Position auf die Karte.
- `CommentNavigationProvider`
- `useCommentLink` — Der Weg ins Kommentarfeld dieses Items — oder `null`.
- `CommentNavigationValue` — Wie ein Klick auf den Kommentar-Hinweis ins Kommentarfeld fuehrt.
- `TagNavigationProvider` — Macht Tags anklickbar: Ein Klick nimmt das Tag in den geteilten Filter auf, ein Klick auf ein aktives nimmt es wieder heraus.
- `useTagLink`
- `TagNavigationValue` — Wie ein Tag auf einer Karte zu allem anderen fuehrt, das so verschlagwortet ist: Er setzt den geteilten Filter.
- `TagLink` — Der Weg, den ein Tag oeffnet — oder `null`, wo es keinen gibt.

## auth — App-Shell (Anmeldung)

- `AuthScreen` — Generischer Login-/Registrierungs-Screen über die Authenticatable- Capability (Spec 02).
- `AuthScreenProps`
- `MnemonicGrid`
- `MnemonicGridProps`
- `MnemonicVerify`
- `MnemonicVerifyProps`
- `PassphraseInput`
- `PassphraseConfirm`
- `PassphraseInputProps`
- `PassphraseConfirmProps`
- `StepProgress`
- `StepProgressProps`

## contacts — App-Shell (Kontakte, Verifikation, Relay-Status)

- `ContactCard`
- `ContactList`
- `AddContactDialog`
- `RelayStatusBadge`
- `VerificationDialog`
- `VerificationBadge`
- `ContactsDialog`
- `IncomingVerificationDialog`
- `IncomingSpaceInviteDialog`
- `MutualVerificationDialog`
- `IncomingContactRequestDialog` — Sichtbare Zustellung einer Kontaktanfrage (Anfrage-Connectoren) — das Gegenstück zum WoT-IncomingVerificationDialog: der Empfänger bekommt einen Dialog statt ei

## profile — App-Shell (Profil)

- `ProfilePanelContent` — Inner content of the profile panel — rendered inside the App Shell's shared `AdaptivePanel` (modal / sidebar / drawer), not its own dialog.
- `ProfileData`
- `ProfilePanelContentProps` — `edit` renders the own-profile form (avatar upload, name/bio inputs, Save) and requires `onSave`.
- `ProfileLink` — Wraps an avatar (or any user-bound element) so a click opens that user's profile via `useOpenProfile`.
- `ProfileLinkProps`

## activity — App-Shell (Aktivität, Benachrichtigungen)

- `ActivityBell`
- `ActivityBellProps`
- `ActivityPanel` — Best-effort space history; targets remain visible even when not projectable.
- `ActivityPanelProps`
- `NotificationBell`
- `NotificationCenter`
- `projectNotifications` — Pure all-space projection.
- `unreadHighPriorityKeys`
- `NotificationCandidate`
- `NotificationCenterProps`

## debug — App-Shell (Debug)

- `DebugDashboard`
- `TraceTimeline`
- `StoreInspector`

## module-panel — Modul-Einstellungen

- `ModulePanelProvider` — Single shared `AdaptivePanel` instance for a module surface.
- `useModulePanel`
- `useOptionalModulePanel` — Soft variant — returns null when no provider is present.
- `ModulePanelKind` — Identifies what's currently rendered inside the shared module panel.
- `ModulePanelEntry`
- `ModulePanelContextValue`
- `ModulePanelProviderProps`
- `ModuleSettingsPlaceholder` — Placeholder content for the per-module settings panel.
- `ModuleSettingsPlaceholderProps`

## filter — Modul-Kopf und Filter-Pille

- `FilterBar`
- `FilterBarProps` — `FilterBar` — shared filter surface for every Space Module.
- `ModuleSearchBar` — Suche links, Modul-Aktionen rechts — der ganze Inhalt des Modulkopfes.
- `ModuleSearchBarProps`
- `FilterPill` — Der Filter einer Modulflaeche: eine Pille unten links, die bei einem Klick an Ort und Stelle zur Karte morpht (Design-Board 2a → 2g).
- `FilterPillProps`
- `ModuleFilterChips` — Die aktiven Filter, im Kopf der Modulflaeche — jeder einzeln entfernbar.
- `ModuleFilterChipsProps`
- `FilterCardSections` — Der Inhalt der Filter-Karte: Sektion „Typ", Sektion „Tags", danach die Extras des Moduls.
- `isTypeSelected` — Ein Typ ist gewaehlt, wenn er in `types` steht — ODER wenn dort gar nichts steht.
- `toggleTypeSelection` — Der neue `types`-Wert, wenn jemand einen Typ anfasst.
- `FilterCardSectionsProps`
- `FilterProvider`
- `FilterScope` — Der Besitzer fuer eine Flaeche, die auch AUSSERHALB der App laeuft.
- `useSharedFilter` — Der geteilte Filter.
- `useOptionalSharedFilter` — Weiche Variante — `null` ohne Provider.
- `SharedFilterValue` — Der Filter einer App — app-weit, nicht modulgebunden.
- `FilterChip`
- `FilterMultiSelect`
- `FilterToggle`
- `FilterSection`
- `FilterChipProps` — Building blocks for the shared `FilterBar` UI.
- `FilterMultiSelectProps`
- `FilterMultiSelectOption`
- `FilterToggleProps`
- `FilterSectionProps`
- `emptyFilterBarValue` — Empty `FilterBarValue` constant — handy as initial state.
- `FilterBarValue` — The shared `FilterBar` value.
- `FilterTypeOption` — Option entry for the type filter.

## create-fab — Ecke unten rechts: Erstellen

- `CreateFab` — Floating Action Button for "create new item" — sits bottom-right of its containing module surface.
- `CreateFabProps`

## preview — Item-Karte (ItemPreview) und Adornments

- `ItemPreview`
- `DEFAULT_ACTIVE_ITEM_COLOR`
- `DEFAULT_ACTIVE_ITEM_GLOW_COLOR` — @deprecated Frueherer Name von {@link DEFAULT_ACTIVE_ITEM_COLOR}.
- `ItemPreviewProps`
- `ItemPreviewSkeleton` — Loading placeholder shaped like {@link ItemPreview} (author row + title + description lines).
- `MarkdownText`
- `ItemTypeBadge`
- `ItemTypeBadgeProps` — `ItemTypeBadge` — small chip showing what kind of item a card represents (Event, Task, Place, Person, …).
- `ItemTypeBadgeConfig`
- `ItemGroupBadge`
- `ItemGroupBadgeProps` — `ItemGroupBadge` — small chip showing which group/space an item belongs to, a coloured dot in the group's colour plus its name.
- `ItemPrivateBadge`
- `ItemPrivateBadgeProps` — `ItemPrivateBadge` — small chip marking an item as private (it lives in the user's personal space, shared with nobody).
- `ItemScopeBadge` — `ItemScopeBadge` — shows an item's sharing scope as a single chip next to `ItemTypeBadge`: „Privat" ({@link ItemPrivateBadge}) for an item in the personal space
- `ItemMetaRow`
- `formatEventRange` — Format a single date or a range.
- `ItemMetaRowProps` — `ItemMetaRow` — small inline meta row showing the temporal and spatial cues for an item.
- `ItemCommentCount`
- `ItemCommentCountProps` — `ItemCommentCount` — comment-count badge for the `footerAdornment` slot of `ItemPreview`.
- `ItemAssignees`
- `ItemAssigneesProps` — `ItemAssignees` — overlapping avatar stack with a compact name summary, used by `footerAdornment` to show who an item is assigned to.
- `ItemTimeRange`
- `formatTimeRange` — Format start/end as a time-of-day range.
- `ItemTimeRangeProps` — `ItemTimeRange` — inline row showing the time-of-day for an event (and optionally its location), without repeating the date.
- `ItemProfileMeta` — Avatar and display name for a canonical `person` item.
- `ItemProjectMeta` — Website and repository hints for a canonical `project` item.
- `ItemResourceMeta` — Kind and availability hints for a canonical `resource` item.
- `getItemPreviewAdornments` — Resolve the type-aware slots for the generic ItemPreview surface.
- `ItemPreviewAdornments`
- `ItemTypeMetaProps` — Type-specific preview adornments for items whose useful metadata is not part of ItemPreview's generic title/description body.
- `registerTypePresentation` — Register a presentation layer (the app; space layers are not supported yet — see the SCOPE note above and rls#212) at startup.
- `resolveTypePresentation` — Resolve the presentation for a type.
- `renderTypeFooter` — Render a type's footer slot for an item, or null.
- `setTypeManifest` — Bind the register to the app's composed manifest (the authoritative type identity, spec rule 1).
- `GENERIC_BADGE` — The generic fallback badge style (spec rule 5).
- `ItemSlotProps` — Every slot receives the item — nothing else.
- `TypeBadgeStyle`
- `TypePresentationEntry` — Presents a type for the first time (spec: Typdefinition, Darstellungsseite).
- `TypePresentationFragment` — Additively fills fields an existing presentation left unset (spec: Erweiterungsfragment, Darstellungsseite).
- `TypePresentationLayer`
- `ResolvedTypePresentation` — What surfaces consume: entry with every fallback already applied.

## detail — Panel: Item-Detail lesen und bearbeiten

- `ItemDetailBody`
- `ItemDetailBodyProps` — `ItemDetailBody` — die Leseansicht eines Items im Detail-Panel.
- `ItemDetailSkeleton` — Ladeplatzhalter in der Form von {@link ItemDetailBody} — Kopfzeile, Titel, Meta-Box, Text.
- `ItemDetailPanel`
- `ItemDetailPanelProps` — Shared skeleton for an item's detail panel: a scrollable area with a caller-provided top slot, the item's comment list below it, and a comment input pinned to t
- `ItemDetailView` — Shared item-detail body: a read view and an inline edit composer in the SAME panel (read↔edit toggle), plus the permission-gated action menu (⋮ + „Bearbeiten").
- `ItemDetailViewProps`
- `ItemDetailActions` — Detail-header actions in a single ⋮ menu (Bearbeiten / Teilen / Löschen), all gated by `useItemPermissions(item)` — actions the user can't perform are hidden, n
- `ItemDetailActionsProps`
- `visibleDetailActions` — Which actions a detail header shows, given the user's permissions and which handlers the caller wired.
- `DeleteConfirmDialog` — Confirm-before-delete dialog for an item.
- `DeleteConfirmDialogProps`

## composer — Panel: Composer und Widgets

- `ContentComposer`
- `WidgetType`
- `MediaFile`
- `DateRange`
- `LocationData`
- `WidgetData`
- `StatusOption`
- `GroupOption`
- `ContentTypeConfig`
- `WidgetComponentProps`
- `CustomWidgetDefinition`
- `ContentComposerSubmitData`
- `ContentComposerProps`
- `ContentComposerHandle`
- `PersonOption`
- `ComposerFullscreenShell` — Fullscreen fade-in shell for the content composer — a presentation *variant* of the composer (the form is the same; only the surface differs).
- `ComposerFullscreenShellProps`
- `ItemComposer` — The shared item form: the {@link ContentComposer} plus its editor and submit handling, used by BOTH create (no `existingItem`) and edit (with one).
- `ItemComposerProps`

## comments — Panel: Diskussion

- `CommentSection` — Complete comment section: comment list + input.
- `CommentSectionProps`
- `CommentInput` — Messenger-style comment input with auto-expanding textarea, quote preview for replies, and Enter-to-send.
- `CommentInputProps`
- `CommentQuote`
- `CommentBubble` — Single comment display: avatar, author, timestamp, text, reactions, reply button.
- `CommentBubbleProps`
- `CommentThread` — A first-level comment with collapsible second-level replies.
- `CommentThreadProps`

## reactions — Panel: Reaktionen

- `ReactionBar` — Inline display of reactions on an item.
- `ReactionBarProps`
- `ReactionPicker` — Floating panel showing the 16 available reaction emojis.
- `ReactionPickerProps`
- `ReactionDetails` — Panel showing who reacted to an item.
- `ReactionDetailsProps`
- `REACTION_EMOJIS` — The 16 available reaction emojis.
- `REACTION_NAMES` — Human-readable names for accessibility (aria-label).
- `ReactionEmoji`

## tag — Tags

- `TagChip` — Shared tag chip — one source of truth for how a tag looks everywhere: post/preview cards, the filter picker and active filter chips.
- `TagChipProps`
- `TagFilterChip` — Ein Tag auf einer Karte oder im Detail: klickbar, wo es einen Filter gibt, sonst stiller Text.
- `TagFilterChipProps`

## lens — Linsen (Liste, Raster, Sammlung)

- `ListView` — A read-only, type-agnostic projection of every domain item.
- `lensItems` — The shared lens rule: relation records describe connections, not cards.
- `ListViewProps`
- `GridView` — A read-only grid composed from comfortable ItemPreview cards.
- `GridViewProps`
- `CollectionView` — Die Lens laeuft auch ausserhalb der App (Story, Test, apps/network).
- `CollectionLayoutToggle` — Liste oder Raster — als eigene Komponente, damit der Umschalter dort stehen kann, wo die Steuerung eines Moduls hingehoert: im Kopf der Modulflaeche (Spec 01, R
- `collectionFocusGateKey` — A density change is a new projection pass for the same selected item.
- `CollectionLayout`
- `CollectionViewProps`
- `CollectionLayoutToggleProps`
- `MapLens` — A small, read-only map projection.
- `SINGLE_MARKER_ZOOM` — A single selected marker is close enough to read without a street-level jump.
- `fitMapLensViewport` — Returns whether a viewport action actually ran, so the caller can preserve its one-time gate on failure.
- `focusMapLensMarkerOnce` — Selection uses the shared lens gate and panel-aware visible-area semantics.
- `initialMapLensViewportState`
- `mapLensViewportStateForAdapter` — A replacement adapter owns a fresh map and must not inherit prior viewport gates.
- `mapLensBounds`
- `mapLensMarkers` — Map markers are field-composed and never expose relation records as map items.
- `mountMapLensAdapter` — Own one adapter mount.
- `updateMapLensViewport` — Apply selection before the one-time aggregate viewport fit.
- `MapLensProps`
- `MapLensViewportState`
- `MapLensViewportContext`

## feed — Modul: Feed

- `SimplePostWidget`
- `PostCard`
- `Post`
- `PostAuthor`
- `PostType`
- `FeedComposerTrigger` — Feed post creation trigger that opens a fullscreen modal.
- `FeedComposerTriggerProps`

## kanban — Modul: Kanban

- `KanbanBoard`
- `defaultColumns`
- `kanbanItemsByColumn` — Field-based membership; values outside the configured columns are omitted.
- `sortReadOnlyKanbanItems` — Stable, data-derived ordering used by presentation-only boards.
- `KanbanBoardProps`
- `KanbanColumn`
- `computeColumnReorder` — Compute the item updates for dropping `item` into the `newStatus` column at `position`.
- `normalizeStatus` — Map legacy column IDs to the current spec enum.
- `ColumnReorderUpdate`
- `KanbanToolbar`
- `KanbanToolbarProps`
- `KanbanCardDetail`
- `KanbanCardDetailProps`
- `KanbanTaskForm`
- `KanbanTaskCreate`
- `KanbanTaskFormProps`
- `KanbanTaskFormData`
- `KanbanTaskCreateProps`
- `KanbanTaskCreateData`

## calendar — Modul: Kalender

- `CalendarView` — Der Kalender laeuft auch ausserhalb der App-Shell (Story, Test, apps/network).
- `calendarFilterItems` — Calendar filters only expose items that can become an event in this view.
- `focusCalendarItemOnce` — The Calendar counterpart to the shared lens focus gate.
- `CalendarFocusTarget`
- `CalendarViewProps`

## map — Modul: Karte

- `hasGlobe` — True when `adapter` implements {@link GlobeCapable}.
- `hasCluster` — True when `adapter` implements {@link ClusterCapable}.
- `hasUserPosition` — True when `adapter` implements {@link UserPositionCapable}.
- `hasUserGesture` — True when `adapter` implements {@link UserGestureCapable}.
- `LocationPickProvider` — Shared map hand-off state.
- `useLocationPick`
- `LatLng`
- `PickHandlers`
- `LocationPickValue`
- `MapView` — Full Map module: filter/create/bbox behaviour around the filterless MapLens core.
- `MapViewProps`
- `MapViewportMode`
- `renderMarkerSvg`
- `markerDataUrl`
- `MARKER_SHAPES`
- `DEFAULT_SHAPE`
- `PIN_ANCHOR`
- `PIN_SIZE`
- `PIN_VIEWBOX`
- `RenderMarkerOptions`
- `MarkerShape`

## graph — Modul: Graph

- `GraphView`

## resonance — Modul: Resonanz

- `VoteBar` — Inline vote display + controls for a statement (Resonance module).
- `VoteBarProps`

## dashboard — Modul: Dashboard

- `StatCard`
- `ActionCard`

## hooks — Daten und Zustand

- `useIsMobile`
- `useIsCompact` — True below the panel breakpoint — i.e.
- `ConnectorProvider`
- `useConnector`
- `useOptionalConnector` — The connector if one is provided, otherwise `null`.
- `useItems`
- `useItem`
- `useItemsWithDraft` — Like {@link useItems}, but merges the live draft item (an in-progress create/edit) when it matches the filter — so a module previews it before it's saved.
- `useActivity` — Reads the optional space activity projection without making it a shell requirement.
- `useNotifications` — Optional shell enhancement; raw activity remains available without it.
- `useMarkNotificationsSeen` — Mark the visible frontier once per center mount, and only when it advances.
- `DraftItemProvider` — Holds the live "draft" item — the in-progress create/edit composer state as an Item — so modules can show it as a preview before it's saved (a task in its colum
- `useDraftItem` — The live draft item (or null).
- `useSetDraftItem` — Publish/clear the live draft (used by the shared item composer).
- `DRAFT_ITEM_ID` — Synthetic id for a not-yet-saved create draft (edit drafts reuse the real id).
- `UnsavedChangesProvider` — Tracks whether an open composer (create or edit) holds unsaved content, so the app can warn before that content is discarded — by cancel, by opening another ite
- `useUnsavedChanges` — Read the unsaved-changes state (for the app-level navigation guard).
- `useSetUnsavedDirty` — Publish/clear the unsaved flag (used by the shared item composer).
- `useRelatedItems`
- `useRelationRecords`
- `useRelationNeighbors`
- `useCreateItem`
- `useUpdateItem`
- `useDeleteItem`
- `useItemPermissions` — Whether the current user may edit / delete a given item — drives the detail action menu (⋮).
- `useCanCreate` — Whether the current user may create an item in a space (optionally typed).
- `ItemPermissions`
- `useGroups`
- `usePersonalGroupId` — Id of the user's personal/private space („share with nobody"), or `null` for connectors without one.
- `useCurrentGroup`
- `useCreateGroup`
- `useUpdateGroup`
- `useDeleteGroup`
- `useMembers`
- `useInviteMember`
- `useRemoveMember`
- `useAuthState`
- `useCurrentUser`
- `useFeatures`
- `useFeature`
- `useContacts`
- `useVerification`
- `useConfirmations`
- `useRelayStatus`
- `useInitialSync` — Läuft gerade die Erstbefüllung dieses Geräts?
- `useReactions` — Hook for reading and toggling reactions on an item.
- `useReactionUsers` — Hook for loading the list of users who reacted to an item.
- `AggregatedReaction` — Aggregated reaction for a single emoji.
- `UseReactionsResult` — Return value of useReactions hook.
- `ReactionUser` — User who reacted, for the ReactionDetails panel.
- `UseReactionUsersResult` — Return value of useReactionUsers hook.
- `useCommentCount` — Number of comments on an item — the cheap counterpart to {@link useComments}.
- `useUserNameResolver` — Resolves user ids to display names — defensively.
- `useComments` — Hook for reading and creating comments on an item.
- `useReplies` — Hook for loading second-level replies to a first-level comment.
- `CommentWithAuthor` — A comment with resolved author info, for UI rendering.
- `UseCommentsResult` — Return value of useComments hook.
- `UseRepliesResult` — Return value of useReplies hook.
- `useVotes` — Hook for reading and casting votes on a statement (Resonance module).
- `useVoteUsers` — Reactive list of voters (with stance) for a statement: subscribes to the vote records and re-resolves display names when the set changes.
- `useVerifiedRelationRecords`
- `VoteSummary` — Aggregated vote distribution for a statement.
- `UseVotesResult` — Return value of useVotes hook.
- `VoteUser` — Voter entry for the transparent voter list — votes are transparent by design.
- `UseVoteUsersResult`
- `useIncomingEvents`
- `IncomingEventsProvider` — Provider that listens to connector's incoming events and manages a FIFO notification queue.
- `useItemAuthor` — Resolves the author (`createdBy`) of an item against a preloaded user list.
- `useItemTags` — Returns the normalized top-level tag list of an item.
- `useItemDateHint`
- `formatItemDateHint` — Default formatter: short relative or absolute label suitable for Feed-style cards.
- `ItemDateHint` — Structured representation of an item's temporal hint, ready for any UI to render in its own style.
- `useItemPosition`
- `ItemPosition` — Extracts a position hint from an item's `data.position`.
- `useItemGroupColorResolver` — Returns a resolver `(item) => colour` that yields the primary colour of the group an item was *created* in (its origin group), via the connector's `ItemGroupCap
- `useItemGroupResolver` — Returns a resolver `(item) => Group | undefined` for the group an item was created in (its origin group), via the connector's `ItemGroupCapable`.
- `useItemPrivacyResolver` — Returns a resolver `(item) => boolean` telling whether an item is private — it lives in the user's personal space (its group equals the personal-space id), i.e.
- `useOpenProfile` — Returns an `(userId: string) => void` callback that opens the user's profile, or a no-op if no `OpenProfileProvider` is mounted above.
- `OpenProfileProvider`
- `OpenProfile` — Imperative handle to open a profile view for a user.
- `OpenProfileProviderProps`
- `useItemEditor`
- `UseItemEditorOptions`
- `UseItemEditorResult`
- `ItemEditorMapper` — Maps a composer submission to a payload the connector can persist.
- `ItemEditorPayload` — The shape a caller-supplied mapper returns.
- `useFilterableItems` — Apply a shared `FilterBarValue` to a list of items, client-side.
- `useModuleFilteredItems` — Die Items eines Moduls, gefiltert wie die Steuerleiste im Kopf es anzeigt: geteilte Tag-/Typ-Auswahl plus geteilter Suchtext.
- `applyFilterBarValue` — Pure filter logic — exported for tests and for non-React callers.
- `applyItemSearch` — Freitextsuche ueber ein Item: Titel, Beschreibung, Inhalt.
- `useResolvedUsers` — Fallback author resolution: some ids are not in the current member list (e.g.

