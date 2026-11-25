# Expand or collapse all sidebar folders at once

## Summary

Add two application menu items — **Expand All Folders** and **Collapse All Folders** — to the desktop app's View menu. They act on the sidebar's folder tree in one step: expand every folder to scan the whole workspace, or collapse everything to get back to a compact overview, instead of toggling folders one by one after digging through a deep tree.

Implements https://github.com/SubliminalGuy/software-factory-tutorial/issues/8.

## Behavior

1. The View menu gains two new items, **Expand All Folders** and **Collapse All Folders**, as their own separated section.
2. **Expand All Folders** expands every folder in the sidebar tree at once, including folders hidden inside compacted chains like `deeply/nested/folder`.
3. **Collapse All Folders** collapses every folder at once, returning the tree to its compacted top-level overview.
4. Both items are enabled whenever a workspace is open (same gating as **Refresh Folder**); with a workspace open but no folders, they are no-ops.
5. The resulting expansion state persists per workspace: it flows through the existing per-workspace persistence, so reopening the app keeps the collapsed or fully-expanded overview.
6. No keyboard shortcuts are added (see Out of scope); the items are menu-only.
7. The items appear in the View menu on every platform where the menu already exists (macOS included).

## Technical design

The feature follows the existing menu → IPC → renderer command path.

**Main process — `apps/desktop/electron/main.ts` (`buildMenu`)**
- Add two hand-rolled items to the View menu's template, modeled on the existing `sync-workspace` item (plain `{ id, label, enabled, click }`, deliberately NOT `commandMenuItem`, so no command-registry entry and no shortcut-settings integration):
  - `expand-all-folders` / "Expand All Folders", `enabled: menuState.hasWorkspace`, `click: () => sendToRenderer("desktop:menu-expand-all-folders")`
  - `collapse-all-folders` / "Collapse All Folders", same shape with `desktop:menu-collapse-all-folders`
- Place them as a new section after the zoom items, separated by a separator.

**Preload — `apps/desktop/electron/preload.ts` + `apps/desktop/src/desktopApi/types.ts`**
- Add `onMenuExpandAllFolders` / `onMenuCollapseAllFolders` following the existing `subscribe("desktop:menu-…")` pattern; declare both in `DesktopApi` so the `satisfies DesktopApi` check enforces completeness.

**Renderer bridge — `apps/desktop/src/App.tsx`**
- In the existing menu-listener `useEffect`, add two disposers that dispatch window CustomEvents (`SIDEBAR_EXPAND_ALL_FOLDERS_EVENT` / `SIDEBAR_COLLAPSE_ALL_FOLDERS_EVENT`, constants exported from `@marky/ui`). This mirrors the existing `OPEN_COMMAND_PALETTE_EVENT` precedent and keeps `@marky/ui` free of desktop-app imports.

**Shared UI — `packages/ui/src/components/useSidebarTree.ts`**
- Add two bulk operations to the hook's return:
  - `expandAll()`: walk the built `FolderNode` tree (`buildFileTree` output), collect every folder id, and replace the expanded set. Walking the tree covers compacted chains, since expansion state is keyed by real folder ids.
  - `collapseAll()`: replace the expanded set with an empty set.
  - Both follow the same `expandedState.key === storageKey` guard pattern as `setExpanded`; persistence needs no changes because the existing write effect stores whatever is in state.

**Shared UI — `packages/ui/src/components/Sidebar.tsx`**
- While the Sidebar is mounted, listen for the two CustomEvents and call the hook's `expandAll` / `collapseAll`. Rows re-render through the existing `flattenRows` flow.

## Decisions

- **View menu placement, not sidebar header buttons** (requester): the actions live in the application's View menu. The triage-stage idea of header buttons was rejected by the requester.
- **Two explicit menu items, not one adaptive toggle** (derived from the requester's placement choice): a menu item that silently flips its label between expand-all and collapse-all depending on tree state would be unusual; two stable items are predictable and cost nothing extra.
- **Persist per workspace** (requester): bulk expansion goes through the same persistence as manual toggles.
- **Hand-rolled menu items instead of command-registry commands** (derived): the registry requires a `defaultBinding`, and shortcuts are out of scope. The `sync-workspace` item is the established pattern for a menu item without a command.
- **Enabled when a workspace is open** (derived): matches `Refresh Folder`. Tracking "tree has folders" in `menuState` would add IPC state for little gain — with no folders the actions are harmless no-ops.
- **Window CustomEvents as the renderer bridge** (derived): matches the command-palette precedent and avoids prop-threading an imperative handle through `DesktopSidebar` into the shared `Sidebar`.

## Assumptions

- "macOS only is ok" was read as permission, not a requirement. The View menu already exists on all platforms, so the items are added unconditionally; macOS users get them either way.
- The actions apply to the file-tree view's expansion state even when the sidebar is closed or the inbox view is active; the state simply updates (and persists) and shows the next time the tree is visible.
- Labels use the menu title case used elsewhere ("Refresh Folder", "Toggle Terminal"): "Expand All Folders" / "Collapse All Folders".

## Out of scope

- Keyboard shortcuts for bulk expand/collapse (requester).
- Per-subtree expand (expanding one folder and everything beneath it) (requester).
- Any change to the auto-expand-ancestors-when-selecting-a-file behavior (requester).
- Header buttons in the sidebar (superseded by the View menu decision).

## Validation

- `pnpm --filter @marky/ui test` — extend `useSidebarTree.test.ts`:
  - `expandAll` expands every folder, including compacted-chain members, and the persisted set contains all ids.
  - `collapseAll` clears the expanded set and persists the empty set.
  - Expand `Sidebar.test.tsx`: dispatching each CustomEvent triggers the matching bulk operation in the rendered rows.
- `pnpm --filter @marky/ui test` / `pnpm --filter @marky/desktop test` — full suites stay green.
- `pnpm build:desktop` — builds packages, runs `tsc` and the electron-vite build (catches the preload/`DesktopApi` contract).
- `pnpm check` and `pnpm check:react-compiler` after the React changes.
- Manual/e2e spot check on macOS: View → Expand All Folders fully opens a deep tree; Collapse All Folders compacts it; state survives an app restart.
