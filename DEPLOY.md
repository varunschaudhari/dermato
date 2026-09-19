# Deploying Dermato for the friends/family pilot

This gets the app onto a real HTTPS URL that anyone can log into, using seeded
demo data (fake patients, known passwords) — not real patient data. **Do not
put real patient photos into this deployment.** See the go-live checklist at
the bottom for what changes before that's safe.

Stack: [Fly.io](https://fly.io) for both containers (matches the existing
Dockerfiles almost exactly, gives you free HTTPS + a persistent disk for
uploaded photos) + [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
free tier for the database (Fly doesn't offer managed MongoDB).　Total cost:
$0–~$5/mo depending on Fly's current free allowance.

## 1. Create the database (MongoDB Atlas)

1. Sign up at mongodb.com/cloud/atlas, create a free **M0** cluster.
2. Database Access → add a user with a strong generated password.
3. Network Access → for now, allow `0.0.0.0/0` (Fly's outbound IPs aren't
   static on the free plan). This is a real tradeoff — see the checklist.
4. Get the connection string (Connect → Drivers → Python): it looks like
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`

## 2. Install flyctl and log in

```
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
fly auth signup   # or `fly auth login` if you already have an account
```

## 3. Deploy the backend

```
cd backend
fly launch --no-deploy       # creates the app from fly.toml; if "dermato-api"
                              # is taken, it'll prompt for a different name —
                              # update the `app = "..."` line in fly.toml to match
fly volumes create dermato_uploads --size 1   # 1GB, plenty for a pilot

fly secrets set `
  MONGO_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority" `
  SECRET_KEY="<run: python -c \"import secrets; print(secrets.token_hex(32))\">" `
  ADMIN_EMAIL="you@example.com" `
  ADMIN_PASSWORD="<a real password, not changeme123>" `
  FRONTEND_URL="https://dermato-app.fly.dev" `
  CORS_ORIGINS="https://dermato-app.fly.dev"

fly deploy
fly status   # confirm it's healthy; note the app's https URL
```

## 4. Seed demo data into Atlas

From your machine, pointed at the *same* Atlas cluster (one-time, run locally
— not on Fly):

```
cd backend
$env:MONGO_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
./.venv/Scripts/python.exe seed.py
```

This creates the known demo dermatologist/patient accounts (see the script's
own printed output for the exact emails — the shared password across all of
them is `password123`). That's intentional for this pilot: anyone with the
unlisted URL can explore without you handing out real credentials one by one.

## 5. Deploy the frontend

```
cd ../frontend
fly launch --no-deploy       # same deal — rename in fly.toml if the app name is taken
```

If you renamed the backend app in step 3, update `BACKEND_ORIGIN` in
`frontend/fly.toml` to match (`https://<your-backend-app-name>.fly.dev`) before deploying.

```
fly deploy
fly status   # this URL is what you share with people
```

## 6. Verify

Open the frontend's `https://...fly.dev` URL, log in with one of the seeded
accounts, run an analysis. If login works, CORS and the nginx proxy are both
wired correctly.

---

## Before this touches a real patient

This deployment is deliberately scoped for "friends click around with demo
data" in under a week. Cross every item here before any real patient's photo
or information goes in:

- **Rotate all credentials.** The seeded accounts' shared `password123` is
  fine for an unlisted pilot URL and nothing else — wipe and reseed with real,
  private credentials (or build real self-service signup) before real use.
- **Lock down Atlas network access** from `0.0.0.0/0` to Fly's actual egress
  IPs (`fly ips list`, or allocate a static egress IP — a paid Fly feature)
  once you're past the free-tier pilot.
- **Move uploaded photos off the local volume to object storage** (S3,
  Cloudflare R2, Backblaze B2). The Fly volume works fine for a pilot, but it's
  single-region and doesn't get you off-site backups the way object storage does.
- **Add backups.** Atlas free tier has no automated backups — at minimum,
  schedule a periodic `mongodump` before real data accumulates.
- **This is still single-tenant.** Every user shares one database — fine for
  one clinic, not for multiple clinics with data that must stay separated.
  Revisit before onboarding a second organization.
- **No automated tests cover `severity_classifier.py`** — the one module in
  this codebase that's been rewritten the most. Worth a regression suite
  before this drives real treatment recommendations at scale.
