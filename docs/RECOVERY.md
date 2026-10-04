# How to restore this project

This guide assumes the worst case: **years have passed, you have a new computer, a clone of this repository and nothing else.** None of the original hosted services (database, backend host, frontend host, push notifications, mobile build service) are available any more.

- **Part A — Local recovery** rebuilds and runs the whole system on one machine with no external accounts. Start here.
- **Part B — Full infrastructure recovery** describes what you need to deploy it again, first as generic requirements and then as a record of the infrastructure that was used historically.

No secret, password or connection string from the original deployment is needed (or stored in this repository). Every secret is generated fresh during recovery.

---

## 0. Last verified state

Verified in October 2026 on Windows 11 from a clean clone:

| Tool | Verified version | Notes |
|---|---|---|
| Node.js | **20.20.2** (`.nvmrc`) | Backend declares `engines: 20.x`. Node 24 also installs, builds and passes typecheck and frontend tests (with an `EBADENGINE` warning); the backend test suite was only verified on Node 20. |
| npm | 10.8 | Four lockfiles (`lockfileVersion: 3`): root, backend, frontend, mobile app. Always install with `npm ci`. |
| MongoDB | **6.0** | **Must run as a replica set** (some services use transactions). |
| Git | any recent | |
| JDK | 17 | Only for native Android builds of the mobile app. |
| Android SDK | platforms 34/36, build-tools 36, NDK 27.1 | Only for native Android builds. |
| Expo SDK / React Native | 54 / 0.81 | Mobile app. |
| EAS CLI | ≥ 16 (`eas.json`) | Only for cloud mobile builds. |

Status at that point: backend 893/893 tests, frontend 432/432, typecheck clean, CI green. Known issues: [KNOWN-ISSUES.md](KNOWN-ISSUES.md).

If Node 20 is no longer installable in your environment, try the oldest LTS available first, then read section A.11.

---

## Part A — Local recovery

### A.1 Install the tools

1. **Git.**
2. **Node.js 20** — with a version manager (`nvm`, `nvm-windows`, `fnm`, `volta`) run `nvm install` / `fnm use` in the repo root to pick up `.nvmrc`; or download the 20.x binary from nodejs.org.
3. **MongoDB 6.0 Community Server** — native install, or Docker if you prefer (see A.2).

Check:

```bash
node -v    # v20.x
npm -v     # 10.x
```

### A.2 Start MongoDB as a replica set

The backend and the test suite need a **single-node replica set**. A standalone `mongod` starts, but operations that use transactions fail.

**Option 1 — native `mongod`** (any OS; pick an empty data folder):

```bash
mongod --port 27017 --bind_ip 127.0.0.1 --replSet rs0 --dbpath /path/to/empty/data-folder
```

In a second terminal, initialise the replica set once:

```bash
mongosh --port 27017 --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

(The quoting above works in bash, zsh and Windows PowerShell. In PowerShell 5.1, a JavaScript argument with double quotes *inside* single quotes loses its inner quotes and fails with a `SyntaxError`.)

If MongoDB was installed as a Windows/Linux service, you can instead add this to its config file (`mongod.cfg` / `mongod.conf`) and restart the service, then run the same `rs.initiate(...)` once:

```yaml
replication:
  replSetName: rs0
```

**Option 2 — Docker:**

```bash
docker run -d --name goruiz-mongo -p 27017:27017 mongo:6 mongod --replSet rs0 --bind_ip_all
docker exec goruiz-mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Check: `mongosh --eval "rs.status().members[0].stateStr"` prints `PRIMARY` (it can take a few seconds after `rs.initiate`).

If port 27017 is already used by another MongoDB on your machine, use another port (for example `--port 27018`) consistently in the commands and connection strings below.

All connection strings below use `?replicaSet=rs0`.

### A.3 Clone and install

```bash
git clone <repository-url> ambulancias-goruiz
cd ambulancias-goruiz
npm ci                                         # root workspace — required, see note
npm ci --prefix ambulancias-goruiz-backend
npm ci --prefix ambulancias-goruiz-frontend
```

**Do not skip the root `npm ci`.** The frontend production build (`tsc -b`) also typechecks `vitest.config.ts`, which needs `@types/node`; the frontend package does not declare it and resolves it from the root `node_modules`. Without the root install, `npm run dev` works but `npm run build` fails with `Cannot find module 'node:path'`.

Optional, only for the mobile app:

```bash
npm ci --prefix apps/app-worker
```

### A.4 Configure the backend

Create `ambulancias-goruiz-backend/.env` (never commit it; it is gitignored). Generate a new random secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Minimal `.env` for local development:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ambulancias_dev?replicaSet=rs0
JWT_SECRET=<paste the generated value>
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
```

All other variables are optional and documented in `ambulancias-goruiz-backend/.env.example` and [DEPLOYMENT.md](DEPLOYMENT.md). The backend validates the environment with Zod at start-up and exits with a clear message if something required is missing.

### A.5 Configure the web frontend

```bash
cp ambulancias-goruiz-frontend/.env.example ambulancias-goruiz-frontend/.env
```

It contains `VITE_API_URL=http://localhost:5000/api`, which is correct for local development.

### A.6 Start the backend

```bash
npm run dev:backend
```

Expected log lines: `Conectado a MongoDB`, `WebSocket server activo en /ws`, `Server listening on http://0.0.0.0:5000`. Check:

```bash
curl http://localhost:5000/health        # {"status":"ok",...,"db":"ok"}
```

API documentation (OpenAPI): <http://localhost:5000/api/docs> (the Swagger UI page loads its assets from unpkg.com; the raw spec is at `/api/docs.json`).

Uploaded files are stored in `ambulancias-goruiz-backend/uploads/` (created automatically, gitignored).

### A.7 Create the first superadmin

There is no public registration. Create the platform operator account from the backend folder (pick your own email and a strong password):

```bash
cd ambulancias-goruiz-backend
SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='<strong password>' npm run create:superadmin
```

PowerShell: `$env:SUPERADMIN_EMAIL="you@example.com"; $env:SUPERADMIN_PASSWORD="<strong password>"; npm run create:superadmin`.

The script does nothing if a superadmin already exists. An alternative with the same effect is `EMAIL=… PASSWORD=… npm run bootstrap:superadmin`.

### A.8 Start the web panel and log in

```bash
npm run dev:web-admin        # from the repository root
```

Open <http://localhost:5173>, choose **"Ya tengo cuenta"** (I already have an account) and log in as the superadmin. The language can be switched with the flags at the top.

### A.9 Enable MFA for the superadmin (required before creating companies)

Creating a company and creating a company's first admin are **step-up protected**: the API asks for a current TOTP code even when MFA is not mandatory at login (`SUPERADMIN_MFA_REQUIRED=false`). So the superadmin must enrol TOTP first:

1. In the superadmin panel open **MFA** (`/superadmin/security-mfa`).
2. Start the TOTP enrolment and add the shown secret / QR code to any authenticator app (Google Authenticator, Microsoft Authenticator, KeePassXC TOTP, etc.).
3. Confirm with a current 6-digit code.

When a later action asks for a step-up code, enter the current code from the authenticator app.

### A.10 Create a company, its admin and demo data

1. **Superadmin → Companies → +** (`/superadmin/companies/new`): create a company. The **email domain** is required (for example `@example.com`).
   **Select the modules explicitly: a new company starts with all modules disabled** (by design), and every module route returns 403 until it is enabled. For a full local instance, tick all of them. Automatic *Prämien* requires the `workday` module.
2. In the company row, use the admin action (`/superadmin/companies/<id>/admin`) to create the company's first **admin** (name, email, password of at least 8 characters). Creating the company and the admin both ask for a TOTP step-up code.
3. Log out and log in as that admin.
4. **Invitations:** create invitations for workers; the panel shows an invitation link to copy (no e-mail service is involved). Open the link in a private window to register the worker.
5. **Users:** for every worker, edit the user and set the **ambulance role** (driver, medic or both). Workers registered through an invitation have none, and teams cannot be created without it.
6. **Drivers need a valid P-Schein** (German passenger-transport licence) to be assigned to a shift. Open the worker's profile as admin (`/admin/user/<id>`), set the P-Schein expiry date and upload the certificate as a PDF (any PDF works locally). Saving marks it as confirmed by the admin.
7. **Ambulances** and **Hospitals:** add a few.
8. **Teams:** create driver + medic pairs, optionally with a fixed ambulance and rotation mode.
9. **Plantillas / Dienst templates:** create shift templates (number, start and end time, days off).
10. **Diensts:** generate a week from the templates and assign teams. This produces the weekly plan shown in the README screenshot.

While setting up you will log in and out often: after 5 logins in 15 minutes from the same IP the API answers 429 (rate limit). Restart the backend, or set `RATE_LIMIT_LOGIN_MAX` to a higher value in your local `.env`.

Other scripts in `ambulancias-goruiz-backend/package.json` (`create:hospitals`, `create:ambulances`, `seed:test-workers`) can add sample records directly to the database; read each script's header before running it.

### A.10b Run the mobile app (optional)

The mobile app is for workers (role `worker`). Push notifications will not work locally without Part B.4; everything else talks to the local backend.

```bash
npm ci --prefix apps/app-worker
npm run dev:worker            # = expo start, from the repository root
```

- **API URL:** in development the app derives `http://<this computer's LAN IP>:5000/api` from the Expo dev server automatically. If that does not work (different network, emulator), copy `apps/app-worker/.env.example` to `apps/app-worker/.env.local` and set `EXPO_PUBLIC_API_BASE_URL` (Android emulator: `http://10.0.2.2:5000/api`).
- The phone and the computer must be on the same network, and the firewall must allow inbound connections to port 5000.
- **Expo Go** only supports recent Expo SDKs. If Expo Go no longer supports SDK 54, build a development client instead: `cd apps/app-worker && npx expo run:android` (needs JDK 17 and the Android SDK; `android/` is generated by `expo prebuild` and is not versioned), or upgrade the Expo SDK.
- Log in with a worker account created in A.10. Admin and superadmin accounts are blocked in the mobile app by design.

### A.11 Run the tests and quality checks

Backend tests need their own database. Create `ambulancias-goruiz-backend/.env.test`:

```dotenv
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/ambulancias_test?replicaSet=rs0
JWT_SECRET=<any random value>
```

| Check | Command |
|---|---|
| Full backend suite (893 tests, ~3 min) | `npm --prefix ambulancias-goruiz-backend run test:full` |
| Tenant-isolation security tests | `npm --prefix ambulancias-goruiz-backend run test:security:isolation` |
| Frontend tests | `npm --prefix ambulancias-goruiz-frontend run test:run` |
| Typecheck (all three apps; needs root + mobile installs) | `npm run typecheck` |
| Backend production build | `npm --prefix ambulancias-goruiz-backend run build` |
| Frontend production build | `npm --prefix ambulancias-goruiz-frontend run build` |
| Mobile app checks | `npm --prefix apps/app-worker run validate` |
| Frontend lint (reports known findings) | `npm --prefix ambulancias-goruiz-frontend run lint` |
| Secret scan (needs the `gitleaks` binary) | `npm run secrets:scan` |

Do **not** run the whole backend suite with `--runInBand`: it runs out of memory. See `ambulancias-goruiz-backend/TESTING.md`. The CI workflow (`.github/workflows/ci.yml`) is the reference for the exact sequence.

If you have to move to a newer Node version: install, run `npm ci` in each package, then run the table above. Do not upgrade dependencies at the same time.

### A.12 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Backend exits at start with a Zod error | A required variable (`MONGODB_URI`, `JWT_SECRET`) is missing in `.env`. |
| Errors mentioning transactions or `replica set` | MongoDB is running standalone. See A.2 and add `?replicaSet=rs0` to the URI. |
| `/health` shows `"db":"error"` or the backend cannot connect | MongoDB not running, wrong port, or replica set not initialised. |
| Login returns 429 | Login rate limit (5 attempts per 15 min per IP by default). Wait, restart the backend, or raise `RATE_LIMIT_LOGIN_MAX` locally. |
| Browser shows CORS errors | `FRONTEND_URL` / `ALLOWED_ORIGINS` do not include the URL you use for the web panel. |
| Creating a company fails with `STEP_UP_REQUIRED` / `MFA_NOT_ENROLLED` | Enrol TOTP first (A.9). |
| Admin pages return 403 "El módulo '…' no está habilitado" | The company has that module disabled; enable it as superadmin (A.10 step 1). |
| Team creation fails: driver/medic must have an ambulance role | Set the worker's ambulance role (A.10 step 5). |
| Assigning a team fails with `pschein_invalid_for_date` | The driver has no valid, confirmed P-Schein for those dates (A.10 step 6). |
| `npm ci` fails with "package.json and package-lock.json are not in sync" | Someone changed a `package.json` without its lockfile. In `apps/app-worker` use `npm install --package-lock-only --workspaces=false`. |
| Frontend build: `Cannot find module 'node:path'` in `vitest.config.ts` | Run `npm ci` in the repository root first (A.3). |
| `npm warn EBADENGINE` | Running a Node version other than 20.x. Usually harmless; prefer Node 20. |
| Backend tests: `JavaScript heap out of memory` | Use `npm run test:full`, not `--runInBand`. |
| Backend tests refuse to start | `.env.test` is missing (by design; tests never fall back to `.env`). |
| Mobile app cannot reach the API | Wrong LAN IP, different network or firewall; set `EXPO_PUBLIC_API_BASE_URL`. |
| Default avatar image missing | It is loaded from an external CDN (flaticon); cosmetic only. |

---

## Part B — Full infrastructure recovery (optional)

Only needed to make the system reachable from the internet again. Nothing here is required for Part A.

### B.1 Generic requirements

| Component | Requirement |
|---|---|
| **Database** | MongoDB 6.x **replica set** (any managed MongoDB service, or self-hosted). Create a dedicated database user and network access rule for the backend only. Never reuse credentials from another project. |
| **Backend** | A host that runs a **long-lived Node.js 20 process** (`npm ci && npm run build`, then `npm start`). Serverless/function platforms are not suitable: the backend keeps WebSocket connections open and runs scheduled jobs (node-cron, `Europe/Berlin` time zone). |
| **File storage** | Uploaded documents are written to the backend's local `uploads/` folder. The host needs a **persistent disk** (and backups); with an ephemeral filesystem uploads are lost on every redeploy. |
| **Backend configuration** | `NODE_ENV=production`, `MONGODB_URI`, a new `JWT_SECRET`, `FRONTEND_URL` / `ALLOWED_ORIGINS` set to the public web URL. Recommended: `SUPERADMIN_MFA_REQUIRED=true`. Full list: `.env.example` and [DEPLOYMENT.md](DEPLOYMENT.md). |
| **Web frontend** | Any static hosting with SPA fallback (all unknown paths → `index.html`). Build with `npm ci && npm run build` in `ambulancias-goruiz-frontend`, publish `dist/`. Set `VITE_API_URL` at build time to the public API (`https://<api-host>/api`), **or** keep `/api` relative and configure the host to proxy `/api/*` and `/uploads/*` to the backend. |
| **HTTPS** | Required in production for the web panel, the API and the WebSocket (`wss://`). |
| **Push notifications** | An Expo account/project plus Firebase Cloud Messaging (FCM v1) credentials for Android (B.4). |
| **Mobile builds** | EAS Build, or local builds with JDK 17 + Android SDK. Production builds **require** `EXPO_PUBLIC_API_BASE_URL` with a public HTTPS URL; the app refuses to start otherwise. |

**Production checklist:** new secrets everywhere; `SUPERADMIN_MFA_REQUIRED=true` and TOTP enrolled; at least one company admin per tenant; CORS restricted to the real web URL; database backups enabled; `uploads/` on persistent storage with backups.

### B.2 Redeploy the backend and the web panel

1. Provision the database (B.1) and note its connection string.
2. Deploy the backend from `ambulancias-goruiz-backend/` with the variables above. Check `https://<api-host>/health`.
3. Create the superadmin with `npm run create:superadmin` from a shell that has the production `MONGODB_URI` (or temporarily from your machine), then follow A.9–A.10.
4. Build and deploy the web panel. If you use the proxy approach, update `ambulancias-goruiz-frontend/public/_redirects` (Netlify syntax) or the equivalent rules of your host: **it still points to the retired historical backend URL.**

### B.3 Restore old data (if a backup exists)

The historical database contained only fictitious test data. If a backup was kept (see the private recovery notes), restore it with the MongoDB tools into the new replica set:

```bash
mongorestore --uri "mongodb://<host>:27017/?replicaSet=rs0" --gzip --archive=<backup-file>
```

Uploaded files are separate from the database and must be restored into `ambulancias-goruiz-backend/uploads/` if they were backed up.

### B.4 Push notifications (Android)

The backend sends pushes through the Expo Push API; Expo delivers to Android through FCM.

1. Create an Expo account and project. In `apps/app-worker/app.json` replace `expo.owner` and `expo.extra.eas.projectId` with your own (`eas init` does this). Change `android.package` if you publish under a different identifier.
2. Create a Firebase project, add an Android app with the same package name and download `google-services.json` (keep it out of Git; it is gitignored). Historically it was copied into `android/app/` of the locally generated native project; `app.json` does **not** reference it. For EAS cloud builds, add `"googleServicesFile": "./google-services.json"` under `expo.android` and provide the file to the build (for example as an EAS file secret) instead of committing it.
3. In Google Cloud / Firebase, create a **service account key** for FCM v1 and upload it with `eas credentials` (Android → FCM V1). Store the JSON in a password manager, never in the repository.
4. Build the app with EAS (`eas build -p android --profile production`, with `EXPO_PUBLIC_API_BASE_URL` set in the EAS environment) or locally.

### B.5 Historical infrastructure (2025–2026)

Recorded for reference only. **Do not assume any of these accounts, URLs or resources still exist.** Account names and resource identifiers are kept in the private recovery notes, not here.

| Component | Historical choice | Notes |
|---|---|---|
| Database | MongoDB Atlas, free shared cluster | Development and test databases on the same cluster. |
| Backend | Render web service (free tier) | Free tier sleeps when idle and has an ephemeral filesystem. |
| Web frontend | Netlify | `netlify.toml` (build) and `public/_redirects` (proxy `/api/*` and `/uploads/*` to the backend). |
| Push | Expo Push Service + Firebase Cloud Messaging (v1) | Firebase service account key uploaded to EAS. |
| Mobile builds | Expo EAS (`eas.json`: `development` and `production` profiles) | Development builds were also made locally with Android Studio. |
| CI | GitHub Actions | `ci.yml` (build, tests, smoke test), `gitleaks.yml`, branch-protection audit. |

The project was never deployed to production and had no real users. These services hosted development instances only and were retired when the project was archived.

---

## What is intentionally not in this repository

- Secrets of any kind (`.env` files, JWT secrets, database users, Firebase/Google service account keys, keystores, tokens).
- The historical database contents and uploaded files.
- Account names and resource identifiers of the historical infrastructure.

These are referenced, without secret values, in private recovery notes kept outside the repository by the project owner.
