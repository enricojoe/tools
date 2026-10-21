# Git Lessons

- **Context:** Setting up the project's branch naming convention.
- **Mistake:** Recorded branch names as snake_case; the user wanted kebab-case.
- **Correct Pattern:** Branch names follow `{frontend|backend|project}/{type}/{kebab-case-name}` (e.g. `backend/feature/jwt-auth`, `project/docs/add-claude-md`), as documented in the project `CLAUDE.md`.

- **Context:** Iterating on the README and CLAUDE.md across several requests.
- **Mistake:** Committed and pushed after every small change, creating too many commits; the user wants to control when commits happen.
- **Correct Pattern:** Never commit or push until the user explicitly says so. Leave changes in the working tree and summarize them.
