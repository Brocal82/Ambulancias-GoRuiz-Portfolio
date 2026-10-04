# Ambulancias GoRuiz — Web frontend

Web panel for **company admins** and the **platform superadmin** (React 19, TypeScript, Vite 6, Tailwind CSS 4). Workers use the separate mobile app in `apps/app-worker/`.

Project overview and status: [../README.md](../README.md) · Full setup guide: [../docs/RECOVERY.md](../docs/RECOVERY.md)

## Quick start

Requires Node.js 20 and the backend running on `http://localhost:5000`.

```bash
npm ci
cp .env.example .env      # VITE_API_URL=http://localhost:5000/api
npm run dev               # http://localhost:5173
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (also proxies `/api` and `/uploads` to `localhost:5000`) |
| `npm run build` | Typecheck (`tsc -b`) and production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |
| `npm run test:run` | Vitest + Testing Library (jsdom), single run |
| `npm run lint` | ESLint (reports known pre-existing findings, see `docs/KNOWN-ISSUES.md`) |

## Structure

```
src/
  api/axios.ts        shared Axios instance (base URL, JWT header, error handling)
  modules/<domain>/   one folder per business domain (diensts, vacation, payroll, ...)
    domain/api.ts       HTTP calls for that domain (always through the shared Axios instance)
    pages/, components/, hooks/, utils/
  context/            authentication state (session stored in sessionStorage)
  components/         shared UI (route guards, layout pieces, language switcher)
  layouts/            admin and superadmin shells with sidebars
  hooks/              cross-cutting hooks (e.g. useWebSocketSync for real-time refresh)
  i18n/, locales/     i18next setup and translations (es, de, en)
```

Conventions used across the codebase:

- HTTP calls live in each module's `domain/api.ts`; components do not call Axios directly.
- Sensitive files (PDFs, medical documents) are opened through the authenticated file endpoint (`openSecureFile`), never through public `/uploads` links.
- Real-time updates: the backend sends minimal `{ event }` frames over WebSocket; `useWebSocketSync` maps them to local refresh events (see `docs/frontend/WEBSOCKET.md`).

More detail: [../docs/frontend/FRONTEND-STRUCTURE.md](../docs/frontend/FRONTEND-STRUCTURE.md).
