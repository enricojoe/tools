# Deploying

On each `v*` tag, `.github/workflows/release.yml` builds the image, then the `deploy` job:

1. SSHes into the server.
2. Copies `deploy/compose.prod.yml` and `deploy/deploy.sh` to `DEPLOY_PATH`.
3. Runs `deploy.sh`, which pulls the new version, runs `docker compose up -d --wait --force-recreate` (the container is always replaced; it waits for the health check and fails the job if the app doesn't come up) and removes unused images. It uses the server's own Docker Hub login, so no token is sent to the server.

## Server setup (once)

1. Install Docker with the Compose plugin (`docker compose version` should work).
2. Create a user for deploys that can run Docker, e.g. `sudo adduser deploy && sudo usermod -aG docker deploy`.
3. Make an SSH key pair just for GitHub (on your computer, no passphrase):
   ```bash
   ssh-keygen -t ed25519 -f tools_deploy -C "github-actions deploy" -N ""
   ```
   Add `tools_deploy.pub` to `~deploy/.ssh/authorized_keys` on the server.
4. As the deploy user, log in to Docker Hub once, ideally with a separate **Read-only** access token (Docker Hub → Account settings → Personal access tokens):
   ```bash
   sudo -iu deploy docker login -u <dockerhub-user>
   ```
   The login is saved per user (`~/.docker/config.json`), so do it as the same user as `SSH_USER`, not as root.
5. Create the deploy folder and its `.env` (the same settings as `backend/.env.example`, without `STATIC_DIR`, which the image sets):
   ```bash
   mkdir -p ~/tools && nano ~/tools/.env && chmod 600 ~/tools/.env
   ```
   ```dotenv
   DB_HOST=...            # the database container's name when it's on DB_NETWORK
   DB_PORT=5432
   DB_USER=...
   DB_PASSWORD=...
   DB_NAME=...
   DB_SSLMODE=require
   TZ=Asia/Jakarta
   # The image for running compose by hand; deploys override it with the released version
   TOOLS_IMAGE=<dockerhub-user>/tools:latest
   # Lets you run `docker compose ps|logs` in this folder by hand
   COMPOSE_FILE=compose.prod.yml

   # Traefik (see "Traefik" below)
   TOOLS_DOMAIN=tools.example.com
   TRAEFIK_NETWORK=traefik_web
   DB_NETWORK=db_network
   TRAEFIK_ENTRYPOINT=websecure
   TRAEFIK_CERTRESOLVER=letsencrypt
   ```

## Traefik

The app publishes no port: Traefik, already running on the server, sends `https://TOOLS_DOMAIN` to the container on port 8080 over Traefik's Docker network. The four `.env` values must match your Traefik setup:

| `.env` | What it is | How to find it |
| ------ | ---------- | -------------- |
| `TOOLS_DOMAIN` | The app's domain; its DNS A record must point to the server | Your DNS settings |
| `TRAEFIK_NETWORK` | The Docker network Traefik is on (default `traefik_web`) | `docker network ls`, or `docker inspect <traefik-container> --format '{{json .NetworkSettings.Networks}}'` |
| `DB_NETWORK` | Not Traefik: the Docker network the PostgreSQL container is on (default `db_network`), so the app reaches it by container name | `docker inspect <postgres-container> --format '{{json .NetworkSettings.Networks}}'` |
| `TRAEFIK_ENTRYPOINT` | Traefik's HTTPS entrypoint (default `websecure`) | `--entrypoints.<name>.address=:443` in Traefik's command or `traefik.yml` |
| `TRAEFIK_CERTRESOLVER` | Traefik's Let's Encrypt resolver (default `letsencrypt`) | `--certificatesresolvers.<name>.acme...` in the same place |

Redirecting HTTP to HTTPS is Traefik's job (on its `web` entrypoint), not this file's.

## GitHub setup (once)

Settings → Environments → New environment `production`, then add:

| Kind | Name | Value |
| ---- | ---- | ----- |
| Secret | `SSH_HOST` | Server address (IP or domain) |
| Secret | `SSH_USER` | `deploy` |
| Secret | `SSH_PRIVATE_KEY` | The contents of `tools_deploy` (the private key) |
| Secret | `SSH_KNOWN_HOSTS` | Your server's host key line(s), so the job only talks to your server (see below) |
| Repository variable | `DOCKERHUB_USERNAME` | Your Docker Hub username (also used by the image job) |
| Repository secret | `DOCKERHUB_TOKEN` | A Docker Hub access token with Read & Write (used by the image job only) |
| Variable | `SSH_PORT` | Optional, default `22` |
| Variable | `DEPLOY_PATH` | Optional, default `~/tools` |

The two Docker Hub entries go under Settings → Secrets and variables → Actions (repository level), because the image job uses them too; the rest go in the `production` environment. The environment also lets you require an approval before each deploy (Required reviewers) and shows deploy history on the repo page.

### Getting `SSH_KNOWN_HOSTS`

It's your server's public host key: the job refuses to connect if the server answers with a different key.

1. On your computer, fetch the keys (use your SSH port if it isn't 22):
   ```bash
   ssh-keyscan -p 22 your.server.com
   ```
   It prints lines like `your.server.com ssh-ed25519 AAAAC3Nza...`. With a non-22 port the host shows as `[your.server.com]:2222`.
2. Check they're really your server's: on the server, run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, and on your computer `ssh-keyscan -p 22 your.server.com | ssh-keygen -lf -`. The `SHA256:...` fingerprints of the ed25519 line must match.
3. Paste all printed lines (not the `#` comments) as the `SSH_KNOWN_HOSTS` secret.

Use the same host (IP or domain) as in `SSH_HOST`; the entry only matches that name. If you reinstall the server or its host keys change, update the secret.

## Rolling back

On the server: `cd ~/tools && TOOLS_IMAGE=<dockerhub-user>/tools:1.1.0 docker compose up -d`, or push a new tag from a fixed commit. The server's Docker Hub login covers this too.
