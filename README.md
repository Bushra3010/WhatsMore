# WHATSMORE — More Than Chat.

Chat, calls, stories, AI, Pay, business, marketplace, services and community in one app, with the
WHATSMORE brand (a tricolour “W” on a blue theme).

- **App + admin panel on Vercel:** https://whatsmore-pi.vercel.app (admin: https://whatsmore-pi.vercel.app/admin).
  Vercel project `whatsmore` (account whatsmore5997-8000), root `web/`; deploy with `vercel deploy --prod` from `web/`.
- **App on GitHub Pages:** https://bushra3010.github.io/WhatsMore/ (static build of `web/` by `.github/workflows/pages.yml`
  on every push to main; the old admin page is still at `/WhatsMore/admin.html`).
- **Android app:** `cd web && npm run apk` (see `web/README.md`)

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
