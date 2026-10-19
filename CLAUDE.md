# Project Instructions

## Git Branch Naming

Before starting any work, create a new branch off `main` using this format:

```
{frontend|backend|project}/{feature|fix|chore|refactor|docs|...}/{kebab-case-name}
```

- **Scope:** `frontend` or `backend`, depending on which part of the codebase is changed. Use `project` for global changes that aren't specific to frontend or backend (e.g. repo config, docs, tooling, changes spanning both).
- **Type:** the kind of change (`feature`, `fix`, `chore`, `refactor`, `docs`, etc.).
- **Name:** short, descriptive, kebab-case (lowercase words separated by hyphens).

Examples:
- `backend/feature/jwt-auth`
- `frontend/fix/login-button-alignment`
- `backend/chore/update-dependencies`
- `project/docs/add-claude-md`

If the scope is unclear, ask which prefix to use.
