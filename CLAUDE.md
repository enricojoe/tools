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

## Git Commit Messages

- Keep commit messages short: 1 sentence, 2 at most.
- Never add `Co-Authored-By`, "Generated with Claude", or any other attribution/credit trailers.

## Git Workflow

- Do not commit or push until the user explicitly says to. Leave changes uncommitted in the working tree and report what changed.
- When told to commit, commit on the feature branch, then push the branch to GitHub (`git push -u origin <branch>`).
- Do not merge feature branches into `main` locally; merging happens on GitHub.

## README Progress

- Keep the **Progress** section of the root `README.md` current, in the same branch as the work:
  - **Feature List:** what the app can do for its users (e.g. a QR code generator). Add a feature here, checked off, once it's finished.
  - **Foundation:** technical groundwork that isn't a user-facing feature (server setup, database, auth, CI, repo conventions). Add items here, checked off, once finished.
  - **Working On:** add an item when work on it starts; remove it when it moves to Feature List or Foundation.
  - **Planned Features:** features the user has asked to build. Remove an item when it moves to Working On.
  - **Suggested Updates:** Claude's own suggestions for next steps. Keep it current as the project evolves; move an item to Planned Features when the user accepts it, or remove it when they drop it.
- Also update other README sections (stack, structure, setup commands) if the feature changes them.
