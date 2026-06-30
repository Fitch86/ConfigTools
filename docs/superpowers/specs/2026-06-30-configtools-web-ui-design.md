# configtools Web UI Design

**Date**: 2026-06-30
**Status**: Approved

## Overview

Add a local Web UI to configtools, launched via `configtools ui`.
The UI provides a visual, step-by-step wizard for generating Xray configs
and a project manager for browsing/editing/validating existing projects.

## Architecture

**Single-process**: `configtools ui` starts a Hono HTTP server that serves both
the REST API and static frontend files. All existing generation/validation/
formatting logic is reused 1:1 via the library entrypoint.

```
Browser (Preact + HTM)
    ↕ REST API (JSON)
Hono server (port 3000)
    ↕
Existing modules (assembler, validator, formatter, project store, crypto)
```

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Backend | Hono | ~14KB, zero deps, TS native, fast |
| Frontend | Preact + HTM | No build step, browser-native ESM |
| Syntax highlight | Prism.js (JSON only) | Lightweight, proven |
| Styling | Hand-written CSS, dark theme | No framework needed for tool UI |
| Icons | Simple SVG inline | No icon library dependency |

## Pages

### 1. Home — Project List
- Card grid of existing projects (from `output/`)
- Each card: name, inbound types, creation date
- "New Project" button (prominent, top-right)
- Click card → Project Detail

### 2. New Project Wizard (3 steps)
- **Step 1: Protocol Selection** — Card-based (not checkboxes), each protocol has
  icon + 1-line description. Multi-select allowed.
- **Step 2: Parameters** — Dynamic form fields based on selected protocols.
  Common fields (log level, routing preset) at top. Per-protocol fields grouped
  in collapsible sections. Auto-generated credentials shown with copy button.
- **Step 3: Preview & Generate** — Read-only preview of the full config JSON.
  "Generate" button saves to disk and redirects to Project Detail.

### 3. Project Detail
- Tab bar: Config / Project / README / Certs
- **Config tab**: JSON viewer with syntax highlight + "Edit" button
- **Project tab**: project.json viewer (raw choices for rebuild)
- **README tab**: Rendered markdown (simple regex → HTML instead of full md parser)
- **Certs tab**: cert.pem / key.pem content with copy buttons
- Action bar: Edit Wizard / Validate / Format / Download ZIP

### 4. JSON Editor
- Full-page textarea with JSON syntax highlighting overlay
- Debounced validation (500ms after last keystroke)
- Error/warning markers on the right gutter
- Save button → PUT to API → success toast
- Esc → back to Project Detail

## API Endpoints

```
GET    /api/projects                    — list all projects
POST   /api/generate                    — generate new project (body = wizard params)
GET    /api/projects/:name              — get project detail
GET    /api/projects/:name/files/:path  — get a project file (server.json, project.json, README.md, certs/*)
PUT    /api/projects/:name/server.json  — update server.json
POST   /api/projects/:name/check       — validate server.json
POST   /api/projects/:name/format      — format server.json in place
GET    /api/modules                     — list available inbound modules
```

## File Structure

```
src/
  ui/
    server.ts          — Hono app, API routes + static serving
    frontend/
      index.html       — SPA shell
      app.ts           — Preact app entry, router
      styles.css       — Global styles (dark theme)
      components/      — Preact components
        ProjectList.ts
        Wizard.ts
        ProjectDetail.ts
        JsonEditor.ts
        ...shared components (Button, Card, Toast, etc.)
```

## Design Decisions

1. **No build step** — HTM replaces JSX, CSS is hand-written, no bundler needed.
   `src/ui/frontend/` files are served as-is (or with minimal TS→JS transpile).
2. **Frontend < 50KB** — Preact (4KB) + HTM (2KB) + Prism JSON (10KB) + app code.
3. **Debounced validation** — JSON editor calls `/api/validate` 500ms after typing stops.
4. **Copy-paste friendly** — All credentials, keys, and share links have one-click copy.
5. **Mobile-friendly** — Responsive layout, works on phone for quick config checks.
