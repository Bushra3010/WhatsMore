# WHATSMORE — More Than Chat.

Chat, calls, stories, AI, Pay, business, marketplace, services and community in one app, with the
WHATSMORE brand (a tricolour “W” on a blue theme).

- **Website:** https://bushra3010.github.io/WhatsMore/ (built from `web/` by `.github/workflows/pages.yml`)
- **Android app:** `cd web && npm run apk` (see `web/README.md`)
- **Admin panel (Command Center):** `web/app/admin` (needs a server, e.g. Vercel). Until then the older
  admin page is published at `/WhatsMore/admin.html`.

A WHATSMORE account is required: people, chats, stories and calls are real (Supabase accounts, live
database, realtime and WebRTC calls). There is no built-in demo data. The service sections show sample
content and payments use demo money.

## Project layout
| Folder | What |
|---|---|
| `web/` | The app and admin panel (Next.js 16, React 19, TypeScript), the Android project (`web/android`), tests (`web/tests`, Playwright) |
| `supabase/migrations/` | Database schema, row-level security and functions |
| `legacy/` | The original plain HTML version (not published, except its admin page) |

## Develop
```bash
cd web && npm install && npm run dev
```
Tests run against throwaway accounts that are created and deleted per run (`WM_SQL` must point to a
script that runs SQL on the project, for clean-up): `cd web && WM_SQL=/path/to/sql.sh npx playwright test`.
