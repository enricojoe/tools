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
frontend/
  src/                # React app
tasks/
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

## Progress

### Feature List

What the app can do for its users.

_No features yet._

### Foundation

Technical groundwork the features are built on.

- [x] Project scaffold: Go backend and React frontend
- [x] Backend HTTP server with configurable `PORT` and graceful shutdown
- [x] `GET /api/health` endpoint, with unit test
- [x] Repo conventions in `CLAUDE.md`: branch naming, commit messages, push workflow

### Working On

_Nothing in progress._

### Planned Features

Features the owner has decided to build.

- [ ] QR code generator

### Suggested Updates

Claude's suggestions for next steps, for the owner to accept or drop.

- [ ] Frontend UI (still the Vite starter page)
- [ ] Frontend ↔ backend connection (API client, Vite dev proxy)
- [ ] Database layer
- [ ] Authentication
- [ ] CI pipeline
- [ ] Docker / deployment setup
