# Infrastructure Lessons

- **Context:** Writing a GitHub Actions workflow with test jobs and a Docker image build.
- **Mistake:** The frontend CI job ran `npm run build`, which the Dockerfile already runs in the image job; the user pointed out the duplicate.
- **Correct Pattern:** Within one workflow run, don't repeat a build step the Dockerfile already does. Judge per event, though: once PRs stopped building the image, the PR job needed `npm run build` back to catch type errors.
