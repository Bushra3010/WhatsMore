# Porting WHATSMORE to Next.js — rules for every area

The original app lives at the repo root: `index.html`, `js/*.js`, `css/*.css`, `admin.html` + `js/admin.js`.
This folder (`web/`) is the Next.js 16 + React 19 + TypeScript rewrite. **Goal: the same app, feature for
feature, same look, same demo data** — rebuilt as React components.

Read `AGENTS.md` (Next.js 16 has breaking changes; docs are in `node_modules/next/dist/docs/`).

## How the original is layered (important)
Feature files override earlier functions by reassigning them, e.g. `tabSettings = function () { return _orig().replace(...) }`
or `sendMsg = function (...) { ...; return _prev(...) }`. These live in `superapp.js`, `privacy.js`, `devices.js`,
`recovery.js`, `cloudplus.js`, `callsplus.js`, `callsx.js`, `onboarding.js`, `cloud.js`, `rtc.js`, `stories.js`,
`moderation.js`. **Port the final combined behaviour**: before writing a component, `grep -n "functionName" js/*.js`
to find every layer, including `.replace(...)` string patches that insert rows/buttons into another screen.

## Foundation (already written — use it, don't rewrite it)
- **State** `@/lib/state`: `S` (the saved app state, same shape as the original `S`), `ui` (transient UI state),
  `commit()` = save + re-render, `refresh()` = re-render only, `useRender()`. The whole tree re-renders on every
  commit/refresh (the shell subscribes), so components can read `S`/`ui` directly. Mutate `S`, then `commit()`.
  Don't wrap components that read `S` in `React.memo`. `ui` uses arrays instead of Sets (`ui.ngPick`, `ui.unlocked`, `ui.blobs`).
- **Helpers** `@/lib/util`: `uid pick MIN HOUR DAY COLORS PLANS PRIVACY_OPTS privacyLabel BADGE_LABELS fmtTime dayDiff dayKey
  dayLabel listTime callTime money fmtDur fmtSize fileType extOf initials hash isJumbo contact person chatById chatTitle
  senderName firstName lastMsg lastTime isBiz isAdmin directChatFor productById allUsernames sample findPeople ensureContact
  namesSummary generatePeople preview esc fmtText`.
- **Overlays** `@/lib/overlay`: `modal({ title, body, actions, wide, cls, onClose, onMount })`, `closeModal`, `confirmModal`,
  `showMenu(anchorElOrPoint, items, opts)`, `closeMenu`, `toast(text|node, onClick?, { ms })`, `copyText`,
  `readImage(file, max)`, `readDataURL(blob)`, `pickFile({ accept, multiple })`. Modal `body` is a React node. An action's
  `onClick(root)` receives the dialog element; return `false` to keep it open. For interactive bodies, write a small
  component with its own `useState`, and share values with the actions through a `useRef`/closure object.
- **Actions** `@/lib/actions`: `sendMsg scheduleReply simulateIncoming notify openChat closeChat startDM createGroup addMembers
  simulateVotes simulatePayRequest bizReply personReply DISAPPEAR REPLIES` + hook arrays (`beforeSend afterSend replyGuards
  replyRules tickHooks notifyHooks bizBots openGuards onOpenChat createGroupHooks addMembersHooks`).
- **Navigation** `@/lib/nav`: `goTab openPage back openView closeView openDrawer isMobile`; `openTab` and `onTabOpen` in
  `@/components/app/Rail`.
- **UI** `@/components/Icon` (`<Icon name size cls />`, same names as `icon()`), `@/components/ui/Avatar`
  (`Avatar ChatAvatar Verified DocIcon`), `@/components/ui/Bits` (`PageHead SearchBox ToggleRow SelectRow SettingRow Note
  Sec Kpi ViewHead setSetting setPath getPath settingHooks`), `@/components/ui/Slot` (`<Slot name="…" />`),
  `@/components/app/Logo`.
- **Registry** `@/lib/registry` — how areas plug in without editing each other's files. In your area's `index.tsx`:
  `tabs.status = StatusTab`, `pages['set-profile'] = ProfilePage`, `views['mod:pay'] = PayView`, `mains.ai = …`,
  `drawers.info = …`, `overlays.callScreen = CallScreen` (always mounted; render null when idle),
  `menuHooks.message.push((ch, m) => [...items])`, `messageRenderers.doc = DocBubble`, `chatBars.push(ch => <div …/>)`,
  `register({ startCall, openStatus, … })` for cross-area actions, and call other areas through `act.name(...)`.
  `addToSlot('settings.account', Comp)` fills a slot; render slots where the list in `registry.ts` says.
- **Shared domain modules**: `@/lib/translate` (`LANG_LIST PHRASES ALIASES normPhrase phraseKey englishOf phraseIn
  translateSentences translateText langName readAloud`), `@/lib/scam` (`scamCheck`), `@/lib/profiles` (`PROFILES profileOf
  profileMatch switchProfile`). Super-app module data lives in `S.mod[key]` exactly as before (`MS(key, init)` pattern).
- **Cross-area actions you may call** (whoever owns them registers them): `act.logNotif(cat, title, text, extra)`
  (notification center, modules area), `act.startCall`, `act.openStatus`, `act.openMyStatus`, `act.addStatusModal`,
  `act.callLinkModal` (media area), `act.openDocViewer`, `act.openStudio`, `act.signRequestModal`, `act.sendFiles`
  (docs area), `act.qrModal`, `act.scanModal`, `act.startOnboarding` (settings area), `act.payModal`, `act.locationModal`,
  `act.reportMessage`, `act.reportUser`, `act.translateMsgModal`, `act.openView` (chat area), and live-layer calls
  `act.liveSignUp({ name, username, email, password })`, `act.liveSignIn({ email, password })`,
  `act.liveUsernameAvailable(u) → Promise<boolean|null>`, `act.liveResetPassword(email)`, `act.liveSignOut()`,
  `act.liveIsSignedIn() → boolean` (live area).
- Timers that ran with `setInterval` at startup: put them in a `useEffect` inside an overlay component you register.

## Markup rules
- Reproduce the original HTML structure and **class names exactly** — the CSS (`app/styles/*.css`) is the original, unchanged.
- **Keep `data-act="<original action name>"`** (and the original `data-*` attributes such as `data-mod`, `data-page`,
  `data-chat`, `data-mid`) on clickable elements. The automated tests click by these. Handlers are normal React
  `onClick`s; the attributes are only markers.
- Keep the same `id`s for inputs that tests or other code look up (`#input`, `#chat-search`, `#ai-input`, …).
- Rich text: only `fmtText()` output may go through `dangerouslySetInnerHTML` (it is escaped). Never inject other HTML.
- Accessibility as in the original: `aria-label` on icon buttons, `role`s on custom controls.

## Scope and ownership
Each area owns only its folder (plus new files inside it). **Do not edit files outside your folder** — not `lib/*`,
not `components/app/*`, not another area, not `package.json`. Don't install packages (available: react, next, zustand,
@supabase/supabase-js, @supabase/ssr, qrcode). If you need a shared helper that's missing, write it inside your folder.
If you need something another area provides, call it via `act.xxx(...)` (it shows a "still loading" toast until that
area registers it). Live (Supabase) features are **not** in the demo areas' scope; where a screen has live-only rows,
render the slot named in `registry.ts` instead.

## Done means
- Every screen, modal, menu item and behaviour from your original files exists in React, with the same text.
- `npx tsc --noEmit` reports no errors in your files, and `npx eslint <your folder>` is clean (warnings OK).
- Your final report lists: files created, everything ported, anything you could not port (and why), any action you
  call through `act.*` that another area must register, and any slot you render.
