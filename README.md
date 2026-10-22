# Tools

A collection of web tools in one app, with a Go (Gin) backend and a React (Vite + TypeScript) frontend.

## Tech Stack

| Part     | Stack                                   |
| -------- | --------------------------------------- |
| Backend  | Go 1.26, Gin                            |
| Frontend | React 19, React Router 8, Vite 8, TypeScript 6, oxlint |

## Project Structure

```
backend/
  cmd/server/         # HTTP server entry point (graceful shutdown)
  internal/router/    # Route registration (/api group)
  internal/handler/   # Request handlers + tests
  internal/qr/        # QR code generation and decoding (isolates the QR libraries)
frontend/
  src/api/            # Typed API clients (fetch wrappers)
  src/components/     # Shared UI components (icons)
  src/layout/         # App shell: sidebar navigation, tool search, mobile drawer
  src/theme/          # Light/dark theme hook and toggle button
  src/pages/          # Home (tool grid), tool page wrapper, 404
  src/tools/          # registry.ts (list of tools) + one folder per tool
  src/                # Router setup and global styles
tasks/
  plans/              # Per-task plans
  lessons/            # Lessons learned, by domain
```

## Getting Started

### Backend

```bash
cd backend
go run ./cmd/server      # listens on :8080 (override with PORT)
go test ./...
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # Vite dev server
npm run build            # type-check + production build
npm run lint
```

### Adding a tool

1. Build the page under `frontend/src/tools/<slug>/` with a default-exported component.
2. Add an entry to `TOOLS` in `frontend/src/tools/registry.ts` (slug, name, description, category, icon, keywords, lazy component).

The sidebar, home grid, search and `/tools/<slug>` route pick it up automatically.

In dev, Vite proxies `/api` to `http://localhost:8080`, so start the backend alongside it and call the API with relative URLs (e.g. `fetch('/api/qr')`).

## Progress

### Feature List

What the app can do for its users.

- [x] QR code generator: turn text or a URL into a downloadable PNG, with selectable size and error-correction level
- [x] QR code reader: read a QR code from an uploaded or dropped image (PNG, JPEG, GIF), or scan it live with the camera; copy the text or open it if it's a link
- [x] Tools hub: home page with a searchable grid of tools, sidebar navigation (drawer on mobile), `/` shortcut to search, per-tool pages and a 404 page
- [x] Casual, friendly look (blue and red sticker style with bold outlines and offset shadows, hand-drawn doodles, rounded Nunito font, playful copy and small animations) with a light/dark mode toggle that remembers your choice and defaults to the system setting

### Foundation

Technical groundwork the features are built on.

- [x] Project scaffold: Go backend and React frontend
- [x] Backend HTTP server with configurable `PORT` and graceful shutdown
- [x] `GET /api/health` endpoint, with unit test
- [x] Repo conventions in `CLAUDE.md`: branch naming, commit messages, push workflow
- [x] Frontend ↔ backend connection: typed API client and Vite dev proxy for `/api`
- [x] Client-side routing and a tool registry, so a new tool is one entry plus its page

### Working On

_Nothing in progress._

### Planned Features

Features the owner has decided to build.

_None right now._

### Suggested Updates

Claude's suggestions for next steps, for the owner to accept or drop.

- [ ] More tools: JSON formatter, Base64 encode/decode, password generator, unit converter, image resizer
- [ ] QR extras: SVG output, custom colors, Wi-Fi / vCard templates
- [ ] Recently used tools on the home page
- [ ] Frontend tests (Vitest + React Testing Library)
- [ ] Database layer
- [ ] Authentication
- [ ] CI pipeline
- [ ] Docker / deployment setup
