# Deploying Dermato

The app runs on a single VPS via `docker-compose.yml` at the repo root, with
GitHub Actions auto-deploying every push to `main`. **This is still scoped for
a friends/family pilot with demo data — not real patient data.** See the
go-live checklist at the bottom for what changes before that's safe.

Stack: one VPS running three containers — `mongo` (official image, data in a
named Docker volume), `backend` (FastAPI + the trained ML models), and
`frontend` (nginx serving the built SPA, reverse-proxying `/api`, `/uploads`,
and `/health` to the backend). No managed database or PaaS — just Docker.

## Current deployment

- VPS: `187.127.149.141`, app reachable at `http://187.127.149.141:8081/`
- Project files live in `/opt/dermato` on the VPS (not a git checkout —
  populated by the CI deploy job via `rsync`)
- `/opt/dermato/.env` (root-only, never in git) holds `SECRET_KEY`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_ORIGIN`, `FRONTEND_PORT`

## CI/CD

`.github/workflows/ci.yml` has a `deploy` job that runs after the `backend`
and `frontend` test jobs pass, only on a push to `main`:

1. Checks out the repo
2. `rsync`s it to `/opt/dermato` on the VPS over SSH (excluding `.env` and
   `backend/uploads`, which exist only on the server and must survive every
   deploy)
3. Runs `docker compose up -d --build` on the VPS

This needs three repository secrets under **Settings → Secrets and variables
→ Actions**:

- `VPS_HOST` — the server's IP
- `VPS_USER` — `root`
- `VPS_SSH_KEY` — a private key whose public half is in that user's
  `~/.ssh/authorized_keys` on the VPS (a dedicated deploy key, not your
  personal one)

Once those are set, **every push to `main` deploys automatically** — no
manual step required.

Expect a brief `502` on `/health`/`/api/*` for up to ~60s right after a
deploy recreates the backend container: nginx resolves the `backend` hostname
dynamically with a 10s DNS cache (see the comment in
`frontend/nginx.conf.template`), and needs a cycle or two to pick up the new
container's IP. It self-heals — not a failed deploy.

## Setting up a new VPS from scratch

Only needed once per server (e.g. migrating to a new host):

```
# On your machine — generate a dedicated deploy key, install the public half
# on the VPS, and copy the current commit's tracked files across:
ssh-keygen -t ed25519 -f dermato_deploy -N ""
ssh root@<vps-ip> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < dermato_deploy.pub
git archive HEAD | ssh root@<vps-ip> "mkdir -p /opt/dermato && tar -x -C /opt/dermato"
```

Then on the VPS, create `/opt/dermato/.env`:

```
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<a real password, not changeme123>
PUBLIC_ORIGIN=http://<vps-ip>:8081
FRONTEND_PORT=8081
```

```
mkdir -p /opt/dermato/backend/uploads
cd /opt/dermato && docker compose up -d --build
```

`ADMIN_EMAIL`/`ADMIN_PASSWORD` seed the one admin account on first boot,
since Mongo starts empty (see `config.py`) — there's no `seed.py` demo-data
step in this flow; run it manually (`python backend/seed.py` against the
VPS's Mongo, or over SSH) if you want the old demo dermatologist/patient
accounts.

Finally, add `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY` as GitHub secrets so future
pushes to `main` deploy there automatically.

## Verify

Open `http://<vps-ip>:8081/`, log in with the admin account, register a test
patient via "New patient? Create an account", and run an analysis. If login
works and analysis returns a result, CORS, the nginx proxy, and the ML models
are all wired correctly.

---

## Before this touches a real patient

This deployment is deliberately scoped for "friends click around with demo
data." Cross every item here before any real patient's photo or information
goes in:

- **Rotate all credentials.** Generate a fresh `ADMIN_PASSWORD` and `SECRET_KEY`
  before anything beyond a private pilot — reissue if either was ever shared
  in chat, a screenshot, or a support ticket.
- **Database backups — done, but local-only.** `scripts/backup_mongo.sh`
  (deployed to `/opt/dermato/scripts/` by the normal CI/CD rsync) runs daily
  at 03:00 via crontab on the VPS, dumping `mongodump --archive --gzip` to
  `/var/backups/dermato-mongo/` (outside `/opt/dermato`, so a deploy's
  `rsync --delete` can never touch it) and pruning anything older than 14
  days. Still **all on the same VPS** — a disk failure takes out both the
  live data and every backup. Copying these off-box (S3, Backblaze B2, even
  another VPS) is the remaining gap.
- **Move uploaded photos off the local disk to object storage** (S3,
  Cloudflare R2, Backblaze B2). `backend/uploads` is a bind mount on the VPS's
  local disk — fine for a pilot, but single point of failure with no
  off-site copy.
- **HTTPS — done.** `dermato.cloud`/`www.dermato.cloud` front the app via
  certbot-issued certs on the VPS's host nginx (auto-renews; see the note in
  memory/deploy history if this needs revisiting — none of that nginx/certbot
  config lives in this repo, it's server-only state like `.env`).
- **This is still single-tenant.** Every user shares one database — fine for
  one clinic, not for multiple clinics with data that must stay separated.
  Revisit before onboarding a second organization.
- **`severity_classifier.py` now has a regression suite**
  (`tests/test_severity_classifier.py`) — but it only pins down today's
  thresholds and overrides; it doesn't validate they're clinically correct
  in the first place. Worth periodic review as the thresholds themselves
  evolve.
- **Wrinkle severity is unreliable for close-up crops with no face in
  frame** (this app's primary intended photo type). No documented capture
  distance/zoom exists anywhere in this project for users to follow, so
  `wrinkle_analyzer.py`'s fallback scale assumption has no real basis —
  confirmed by testing: the classical formula never once produced "severe"
  across 930 test images from two different datasets, including a visibly
  severe forehead close-up. See the full writeup in
  `face_detector.py`'s `detect_and_calibrate()` docstring. Both the
  bootstrap `wrinkle_severity` model and the classical fallback inherit this
  — fix needs either a real, enforced capture protocol or an in-frame
  reference object for scale, not more training.
- **Pigmentation/wrinkle severity classifiers have no clinical ground
  truth.** `pigmentation_severity`/`wrinkle_severity` (`backend/models/`)
  were bootstrap-trained to imitate the classical CV formula's own output
  (see `backend/training/train_pigmentation_wrinkle_severity.py`), not
  independently verified accuracy — and neither ever saw a real "severe"
  example during training. A dermatologist-facing confirm/correct-severity
  workflow would be the way to get real labels; doesn't exist yet.
