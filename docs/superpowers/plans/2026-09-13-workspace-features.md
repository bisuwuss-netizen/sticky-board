# Workspace Features Implementation Plan

**Goal:** Evolve Sticky Board into a fixed-canvas local workspace with structured tasks, search, views, and practical board tools while preserving existing data.

**Architecture:** Keep the zero-dependency HTML/WKWebView shell. Extend the v1 state with normalized sticky metadata, derive global indexes and views from state, and keep rendering/event handlers in the existing file until a later module split is justified.

**Tech Stack:** Vanilla JavaScript, CSS, Swift/WKWebView, Node built-in test runner.

**Spec:** User request in chat, 2026-09-13.

**Global Constraints:** local-only storage; macOS 12+; fixed 2400x1600 boards; backward-compatible state migration; no network dependency for core features.

### Task 1: Structured Data
- Add metadata for tags, status, priority, due date, recurrence, parent/dependencies, locked state, z-order, and trash state.
- Normalize old records and test migration.

### Task 2: Search and Views
- Add global search across boards, filters, and jump-to-sticky.
- Add board, timeline, calendar, and statistics views derived from the same state.

### Task 3: Task Workflow
- Add due dates, priority, status, subtasks, dependencies, and recurring task controls to note cards.
- Add weekly review and streak summary data without external services.

### Task 4: Canvas Tools
- Add selectable/locked/layered cards, alignment/distribution, grouping, arrows/connectors, shapes, tables, and freehand strokes.
- Keep all tool objects inside fixed board bounds.

### Task 5: Media and Backup
- Add clipboard image paste, PNG preservation, image replacement/preview/crop, annotations, trash, and automatic JSON backups.

### Task 6: Verification and Release
- Run unit/browser/build checks, package Universal app, push main, and update the GitHub release asset.
