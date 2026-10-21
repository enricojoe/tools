# Tools

A full-stack project with a Go (Gin) backend and a React (Vite + TypeScript) frontend.

## Tech Stack

| Part     | Stack                                   |
| -------- | --------------------------------------- |
| Backend  | Go 1.26, Gin                            |
| Frontend | React 19, Vite 8, TypeScript 6, oxlint  |

## Project Structure

```
backend/
  cmd/server/         # HTTP server entry point (graceful shutdown)
  internal/router/    # Route registration (/api group)
  internal/handler/   # Request handlers + tests
  internal/qr/        # QR code generation (isolates the QR library)
frontend/
  src/api/            # Typed API clients (fetch wrappers)
  src/components/     # UI components
  src/                # App shell and global styles
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

In dev, Vite proxies `/api` to `http://localhost:8080`, so start the backend alongside it and call the API with relative URLs (e.g. `fetch('/api/qr')`).

## Progress

### Feature List

What the app can do for its users.

- [x] QR code generator: turn text or a URL into a downloadable PNG, with selectable size and error-correction level

### Foundation

Technical groundwork the features are built on.

- [x] Project scaffold: Go backend and React frontend
- [x] Backend HTTP server with configurable `PORT` and graceful shutdown
- [x] `GET /api/health` endpoint, with unit test
- [x] Repo conventions in `CLAUDE.md`: branch naming, commit messages, push workflow
- [x] Frontend ↔ backend connection: typed API client and Vite dev proxy for `/api`

### Working On

_Nothing in progress._

### Planned Features

Features the owner has decided to build.

_None right now._

### Suggested Updates

Claude's suggestions for next steps, for the owner to accept or drop.

- [ ] QR extras: SVG output, custom colors, Wi-Fi / vCard templates
- [ ] Frontend tests (Vitest + React Testing Library)
- [ ] Database layer
- [ ] Authentication
- [ ] CI pipeline
- [ ] Docker / deployment setup
