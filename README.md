# WHATSMORE — More Than Chat.

A working, clickable demo of the WHATSMORE super app (chat, AI, calls, pay, business, marketplace, services and community), with the WHATSMORE brand: a tricolour “W” on a blue technology theme. It covers all 10 core features. It runs entirely in the browser: no install, no build step, no server.

## Run it

Double-click **`index.html`** to open it in Chrome, Edge, Safari or Firefox.

To get the microphone, camera and screen-sharing features, serve the folder over localhost:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. The demo also works on a phone-sized screen. It switches to a mobile layout with bottom tabs.

Everything you do is saved in your browser. Use **Settings → Reset demo data** to start fresh.

## What to try

| # | Feature | Try this |
|---|---------|----------|
| 1 | **Private chat** 💬 | Reply, react, edit, delete, forward, pin or star a message (hover a message → ⌄, or right-click). Use the emoji, GIFs and stickers panel, voice notes (mic button), photos and docs (**+**), the scheduled message option (**+ → Schedule message**), **Lock chat** and **Disappearing messages** (choose *1 minute (demo)* to watch messages vanish). Open **⋮ → AI summary**. |
| 2 | **Voice & video calls** 📞 | Use the call and video buttons in any chat. They support mute, camera, background blur and screen share. **Calls → Create call link** makes a WHATSMORE Call Room. |
| 3 | **Groups & communities** 👥 | **No limit on group size.** Add anyone on WHATSMORE by name or @username, or share an **invite link** (Group info → Invite via link; the demo can simulate thousands of people joining). *Weekend Trip*: vote in the poll, pay the split bill, open **⋮ → AI summary**. **Communities** tab: an Announcements group where only admins can post. |
| 4 | **Stories & status** 📸 | **Status** tab: view stories (including a business offer), react or reply, and post your own with a privacy setting. |
| 5 | **Username connection** 👤 | **New chat** → search `@meera.designs` to send a chat request without a phone number. Settings → Profile changes your @username (checks it's unique). There's also **My QR code** and QR scanning. |
| 6 | **End-to-end encryption** 🔐 | Tap the yellow encryption note to see a security code. **Settings → Account & security** has the privacy dashboard, passkeys, 2-step verification and remote logout of sessions. |
| 7 | **AI assistant & translation** 🤖 | Chat with *Siva* (Telugu) or *Priya* (Hindi) and tap **Translate to English**. Tap the ✨ button in the message box to fix grammar or rewrite a message as formal or casual. Smart reply chips appear above the message box. |
| 8 | **Cloud & files** ☁️ | **Files** tab: type *“Show me the invoice Ramesh sent in January”*. Files are auto-sorted (Photos, Documents, Receipts, Invoices…), and there are storage plans. |
| 9 | **Payments** 💳 | **+ → Payment** to send, request or split a bill. Your history is in Settings → Payments. |
| 10 | **Business accounts** 💼 | *Sunrise Bakery*: ask *“What time do you open tomorrow?”* and the AI auto-replies. **+ → Catalogue → Order → Pay** gets you an invoice. |

## New in v2 (client demo)

| Feature | Try this |
|---|---|
| **Linked devices** 💻 | **Settings → Linked devices → Link a device**: a QR code that refreshes, a "link with code" option and a simulated scan (key exchange, encrypted history sync, security alert). Up to 4 devices, each with its own key, and you can rename or log out any of them. **Live sync:** open the demo in a second tab and messages appear in both. |
| **Any file type** 📁 | **+ → Document · any file type** (pick several at once) or drag files onto a chat. PDF, Word, Excel, PPT, ZIP, audio, video, CAD, design, APK, code and more each get their own icon and a preview. **Files → ⬆** uploads to My Cloud. |
| **Document correction** ✍️ | Open any document → **Edit & AI-correct**. **AI proofread** marks spelling, grammar, capitalisation and punctuation as tracked changes (accept or reject each one, or all at once). There's also a toolbar, a summary and a details panel. The corrected copy is sent as a new version. Try *WHATSMORE_PRD_v2.pdf* in *Project WHATSMORE*. |
| **Digital signature** 🖊️ | *Ramesh Kumar* has sent a **signature request**: **Review & sign → Sign**. You can draw, type or upload a signature (and save it). The signed copy is sealed with SHA-256, and the **certificate** shows an audit trail and a **Verify integrity** button. **+ → Request signature** asks someone else to sign. |
| **Home dashboard** 🏠 | Greeting, quick actions, SOS, and smart cards (unread messages, pending signature, scam alert, AI summary, wallet, family events, devices). |
| **WHATSMORE AI** 🤖 | **AI** tab: translation into 18 languages, chat and document summaries, writing, a Telugu/Hindi tutor, interactive quizzes, an AI status creator, spending analysis, a scam check and voice input. |
| **Services** 🌍 | Pay (scan, @username, recharge, bills), Business dashboard, Marketplace (seller AI: *"Is blue shirt available?" → "Book one L size"*), Citizen Services, Emergency SOS, Family Hub, Learn, News & Channels, My Area, Creator Studio, Voice Rooms, Digital Wellbeing, Admin Command Center. |
| **Anti-scam AI** 🛡️ | *KYC Update Desk* chat: warnings that list the reasons, a confirmation before links open, and report & block. |
| **More** | Voice → text transcripts, read aloud (text-to-voice), translating a message to any language, multiple profiles, AI memory controls, notification categories, chat import (from exported .txt). |

## New in v3 (product blueprint gaps)

| Blueprint item | Try this |
|---|---|
| **Sign-up flow** (Stage 2 UI) | Shown on first launch: splash → phone or email → OTP (demo code on screen) → name and unique **@username** with suggestions → hide phone number → security. Replay it from **Settings → Replay welcome & sign-up**. Only a masked number is kept. |
| **Secret chat** (§1) | **New chat → New secret chat**, or **⋮ → Start secret chat**. Device-only, no forwarding or copying, disappears in 24 h, hidden when you switch away, and screenshot alerts (best-effort: browsers only see some screenshot shortcuts). |
| **Chat privacy & forwarding controls** (§1) | **⋮ → Chat privacy**: turn off forwarding and copying, screenshot alerts, hide read receipts or last seen for one chat. Forwarding is limited to 5 chats at a time. |
| **Two-way live translation** (§3) | **⋮ → Live translation** in Ramesh's chat (you Telugu ⇄ them English), then send “ఎలా ఉన్నారు?”. They read “How are you?” and their English reply reaches you in Telugu. |
| **AI summary + photo enhance** (§2) | Summaries now list important links, mentioned people and action items. Message menu on any real photo → **Enhance with AI**. |
| **Super calling** (§11) | In any call: **CC** live captions (tap 🌐 to translate them into Telugu or Hindi), consent-based **recording** (saved to the chat), and a **participants** panel with mute-all, lock, waiting room and remove. **Calls → Schedule a meeting**. |
| **Voice status** (§13) | **Status → 🎤** records up to 60 seconds. Siva has posted a voice status. |
| **Cloud** (§14) | **Files**: smart folders (Aadhaar, PAN, Education, Business, Bills · Family, Travel, Work, Events), a **Links** tab, duplicate clean-up, encrypted backup. |
| **Separate profiles** (§16) | Home → profile pill → **Business**: only customer chats, and other profiles' messages arrive as quiet notices. |
| **SOS audio** (§7) | Emergency SOS → *Record 15 seconds of audio* (off by default). |
| **Learn from your PDF** (§9) | WHATSMORE Learn → **Upload a chapter**, then **Explain in simple Telugu** or **Create 20 multiple-choice questions**. |
| **Marketplace & Admin** (§5, admin panel) | Digital products and professional services categories. Admin adds user management, payment monitoring, subscriptions and API management. |

## New in v4 (calling and recovery gaps)

| Feature | Try this |
|---|---|
| **Switch camera** 🔄 | In a video call, tap the camera-switch button. It cycles through every camera on the device (front ⇄ rear on phones). |
| **Virtual backgrounds** 🏖️ | In a video call, tap the effects button: None, Blur, Office, Beach, Library, Space, Sunset, WHATSMORE. (Demo: an approximate portrait cut-out. Production would use on-device person segmentation.) |
| **HD audio, noise cancellation, echo reduction** 🎙️ | In any call, tap the quality (sliders) button. It shows a live mic level and turns HD audio (48 kHz), noise cancellation, echo reduction, auto volume and HD video on or off. These are real browser settings, and the panel shows what the browser confirmed. |
| **Call waiting** ⏳ | About 12 seconds into a 1:1 or group call, Ananya calls you. **Decline**, **Message** (“I'm on another call”), **End & answer**, or **Hold & answer**. When a call is on hold, **Swap** switches between the two calls, and ending one brings back the other. Happens once per page load. |
| **Add people to a call** ➕ | In a 1:1 call, tap the add-person button. It becomes a group call, with no limit on participants. |
| **Account recovery** 🔑 | **Settings → Account & security → Account recovery**: a recovery key (shown once, downloadable; only its SHA-256 fingerprint is stored), a recovery email (code check) and 2–5 trusted contacts. On the sign-in screen, **Lost access? Recover account** lets you recover with the key, codes from 2 trusted contacts, or email. Recovering logs out every other session and device. |

## New in v5 (Telugu world-class blueprint gaps)

| Blueprint item | Try this |
|---|---|
| **Home bar** (§2) | Home now has 🔍 Search, a 🔔 **notification center** (filter by Messages, Calls, Payments, Business, Marketplace, Community, AI, Security, Services) and the profile switcher. The greeting follows your language (Telugu: “శుభోదయం”). |
| **Location sharing** (§3) | **+ → Location**: send your current location, a nearby place, or **live location** for 15 min / 1 h / 8 h (with **Stop sharing**). Opens in OpenStreetMap. |
| **Who can reach me** (§5) | **Settings → Privacy**: who can message me, call me, and add me to groups. |
| **Group live translation** (§10) | In *Weekend Trip*: **⋮ → Live translation**, then send “ఎలా ఉన్నారు?”. Members read it in English and Hindi, and Priya's Hindi and Arjun's English replies reach you in Telugu. |
| **Meeting chat & summary** (§12) | In a group call or call room, tap 💬 for **meeting chat**. When the call ends, an **AI meeting summary** (people, what was discussed, action items, chat) is posted to the chat. |
| **Link & location status** (§13) | **Status → New status → Link / Location**. |
| **Seller dashboard** (§18) | **Marketplace → Seller dashboard**: sales, inventory with stock controls and low-stock alerts, orders (Packed → Shipped → Delivered), customers, promotions (coupon codes) and payouts. |
| **Do Not Disturb** (§28) | **Digital Wellbeing → Do Not Disturb** with schedules (always, nights, work hours, weekends). Silenced notifications still go to the notification center. |
| **Your data & privacy** (§35) | **Settings → Your data & privacy**: download your data (JSON), AI, location, contacts, camera, mic and cloud permissions, devices and sessions, **My reports**, and **Delete my account**. |
| **Report anything** (§41) | Report a **message** (message menu), **user / business** (contact info), **group** (group info), **channel** (News) or a **scam** (Your data & privacy), using these categories: Spam, Harassment, Fraud, Impersonation, Illegal content, Security concern, Other. Reports appear in the admin queue. |
| **Creator verified** (§42) | A new badge in News & Channels (*TechGuru Kiran*). |
| **Plans** (§44) | Free, **WHATSMORE Plus**, Business, **Business Pro**, Enterprise. |
| **Command Center** (§36–40) | Admin adds **global regions** (India, Asia, Europe, North America), **disaster recovery** (RPO/RTO, replication, a **Run drill** button), **AI monitoring** (requests, latency, model routing through an AI gateway) and **developer health**. |
| **Languages** (§52) | Translate menus list 110+ languages. The demo phrasebook translates common phrases in the Indian languages. |

## New in v6 (brand design language, §55–56)

- **Logo:** the WHATSMORE “W” in the Indian tricolour (saffron, white, green) on a blue tile. It's used for the app icon (favicon), splash, sign-up, web welcome screen and About page.
- **Blue theme:** the whole app moved from WhatsApp-style green to a clean blue technology theme, in light and dark mode. Accents, buttons, chat bubbles, badges, dashboards and the call screen are all blue. Payments keep green for money.
- **Brand message:** “Connect. Communicate. Create. Pay. Work. Discover.” on the splash, and “One App. More Possibilities.” on the web welcome screen, which also has a tricolour bar along the bottom edge.
- **Existing demo data:** saved data in your browser is updated automatically, so your avatar turns from green to blue.

The logo is drawn in code (`logoSVG` in `js/settings.js`). To use the official logo artwork instead, replace that function and the favicon in `index.html`.

## New in v7 (real accounts and live chats, powered by Supabase)

The welcome screen now offers **Create an account**, **Sign in**, or **Try the demo without an account**.

| Feature | How it works |
|---|---|
| **Accounts** | Sign up with your name, a unique **@username** (checked live as you type), email and password (8+ characters). There's no confirmation email, so people can start right away. You stay signed in across visits. **Forgot password?** sends a reset link. Supabase's built-in email sender only allows a few emails per hour; add your own SMTP in Supabase for more. |
| **Find people** | **New chat** → type at least 2 letters of someone's @username or name. Real accounts appear under **WHATSMORE accounts** with a *Live* tag. |
| **Live 1:1 chats** | Text messages are saved in Supabase and appear instantly for the other person (Supabase Realtime). |
| **Live groups** | **New group** with people who have accounts. The creator is the admin and can add more people; there's no participant limit. A group can't mix real accounts with demo contacts. |
| **Profile** | **Settings → Profile** saves your name, @username and about to your account. **Settings → Signed in** signs you out; demo chats stay. |
| **Privacy** | Row-level security in the database: you can only read or send messages in conversations you belong to, you can't send as someone else, only admins can add group members, and signed-out visitors can't read anything. |

**What's live and what's still demo (updated in v9):** between real accounts, chats sync **everything** (text, photos, videos, voice notes, documents, stickers, GIFs, locations, polls, events, payment requests and shared contacts), and **voice/video calls and stories are real** too (see v9). **Payments use the demo wallet** — no real money moves. AI, Pay's bill/recharge flows and the super-app modules (Citizen Services, Marketplace, Learn and so on) are still the simulated demo, and the demo contacts and bots work as before.

**Setup:** the database (tables, security rules, functions, realtime) is in [`supabase/migrations/20261108000000_accounts_and_chats.sql`](supabase/migrations/20261108000000_accounts_and_chats.sql) and is applied to the Supabase project `nkmqdkkjdrvsconphnae` (Mumbai). The app connects using the project URL and its **publishable** key in `js/cloud.js`. That key is meant to be public; the row-level security rules are what protect the data.

## New in v8 (live chat features)

| Feature | How it works |
|---|---|
| **Photos, videos, voice notes, documents** | Uploaded to a private Supabase Storage bucket (`chat-media`, up to 25 MB per file), in one folder per conversation. Only members of that chat can upload or download, through short-lived signed links. |
| **Stickers, GIFs, locations** | Sent as small structured messages. |
| **Replies** | Quote any message; the reply must point to a message in the same chat. |
| **Edit** | Your own text messages, within 15 minutes. Everyone sees the change and an *Edited* label. |
| **Delete for everyone** | Replaces the message for everyone and removes its file from storage. *Delete for me* still only hides it on your device. |
| **Reactions** | One reaction per person per message; changes appear live for everyone. |
| **Read receipts** | Blue ticks once everyone else has read your message. Turning off **Settings → Privacy → Read receipts** stops sending yours and seeing others'. |
| **Typing and online** | "typing…", "online" and "last seen" come from Supabase Realtime (broadcast and presence). Setting **Last seen & online** to *Nobody* hides you. A failed message shows a red ⚠ instead of ticks. |

The database changes are in [`supabase/migrations/20261108010000_media_receipts_reactions.sql`](supabase/migrations/20261108010000_media_receipts_reactions.sql). Editing, deleting and reacting go through checked database functions, so people can only change their own messages.

## New in v9 (real calls, real stories, live polls and payments)

| Feature | How it works |
|---|---|
| **Live polls** | Everyone's votes show up live. You can't vote in a chat you're not in. |
| **Live events** | **Going** replies show up for everyone. No made-up RSVPs from real people. |
| **Payment requests and split bills** | Paying, declining and "2/3 paid" totals sync. The money moves between **demo wallets** (the payer's goes down, the requester's goes up). You can't pay your own request or pay twice. **No real money moves.** |
| **Send money** | Arrives in the other person's demo wallet. |
| **Shared contacts** | A shared contact card works only for people with WHATSMORE accounts, and the other person can message them straight away. |
| **Voice and video calls** | Real calls between accounts, using WebRTC. Audio and video go **directly between the two browsers**, encrypted by WebRTC (DTLS-SRTP), and never pass through Supabase. Supabase Realtime only carries the call setup. |
| **Call features** | Incoming-call screen with ringtone, answer (or answer a video call with voice only), decline, busy, missed calls, mute, camera on/off (turn a voice call into video), switch camera and a call timer. Calls are saved to your call history. |
| **Group calls** | Everyone who answers connects to everyone else. |
| **Stories** | Text, photo and voice statuses are stored for **24 hours** and shown only to the audience you pick: **Everyone**, **Contacts** (people you share a chat with), **Close friends** (pick them in **Status → Close friends**) or **Only me**. *Selected contacts* currently counts as Contacts. Photos and voice notes are kept in a private bucket that only allowed viewers can read. |
| **Status views** | You see real view counts and **Who viewed**. Replying to a status opens a live chat with the person who posted it. Deleting a status removes it for everyone. |

**Limits of calls:** both people need WHATSMORE open to ring, because there are no push notifications yet. Calls use Google's public STUN servers only. A small share of networks (strict corporate or mobile-carrier networks) need a TURN relay server, which a production launch should add (for example Twilio Network Traversal, Cloudflare Calls or a self-hosted coturn). Large group calls would need a media server (SFU) rather than everyone-to-everyone.

**Database:** [`20261108020000_message_actions.sql`](supabase/migrations/20261108020000_message_actions.sql) (votes, RSVPs, payments) and [`20261108030000_stories.sql`](supabase/migrations/20261108030000_stories.sql) (statuses, close friends, views, `status-media` bucket).

## New in v10 (the real admin panel: Command Center)

Open **`admin.html`** on the live site (for example `https://bushra3010.github.io/WhatsMore/admin.html`) and sign in with a WHATSMORE account that is on the admin list. Anyone else sees "This account is not an admin". The database refuses every admin action from them too, not just the page.

| Page | What admins can do |
|---|---|
| **Dashboard** | Real numbers: users, sign-ups today and this week, active and signed-in users, messages, chats and groups, live statuses, files and storage, open reports, verification requests, suspended and verified accounts. Two 14-day charts (sign-ups, messages) in the admin's own time zone, with a table view, plus messages by type. |
| **Users** | Search by name, @username or email. See joined date, last sign-in, messages, chats and open reports. Give or remove a badge (Verified, Business, Creator, Official, Government). Suspend for 1, 7 or 30 days or indefinitely, with a reason. Unsuspend. Delete an account (owner only, after typing the username). |
| **Reports** | Reports filed in the app (users, businesses, messages, groups, scams) arrive here with the reported message. Choose **Dismiss**, **Remove message** (it disappears for everyone), **Suspend 7 days** or both. Filter by Open, Actioned, Dismissed or All. |
| **Verification** | Badge requests from **Settings → Profile → Request a badge**. Approve (the badge appears next to the person's name) or reject. |
| **Statuses** | Every live status, with the option to remove one for everyone. |
| **Announcements** | Publish an Information, Warning or Critical notice. It appears as a banner at the top of WHATSMORE for everyone signed in, until you end it. |
| **Audit log** | Every admin action, with who did it and to whom. It can't be edited. |
| **Admins** | (Owner only) Add moderators or owners by @username, or remove them. |

**What users see:** badges next to names, and a clear notice when suspended (date and reason; they can read but can't send, post or start chats). The database enforces the suspension, so it can't be bypassed. Announcements appear as banners. Their reports go to the real queue (**Settings → Your data & privacy → My reports** shows *Sent to Trust & Safety*).

**Privacy:** a person's suspension date and reason are visible only to them and to admins. Admins see a reported message's content only because someone reported it; they can't browse private chats.

**First admin:** create your account in WHATSMORE, then the project owner adds it once in the Supabase SQL editor (replace the email):

```sql
insert into public.admins (user_id, role) select id, 'owner' from auth.users where email = 'you@example.com';
```

After that, add more admins from the **Admins** page. The database is in [`20261108040000_admin.sql`](supabase/migrations/20261108040000_admin.sql) and [`20261108050000_admin_fixes.sql`](supabase/migrations/20261108050000_admin_fixes.sql).

## Important: this is a prototype

- **Demo people are simulated.** Demo contacts' replies, typing indicators, votes and payments come from scripted bots. Real accounts (v7) send real text messages through Supabase.
- **Encryption is shown, not implemented.** A production build would use the Signal protocol for 1:1 chats and Sender Keys for groups, with independent audits.
- **AI and translation are rule-based.** Production would use an on-device or privacy-preserving model.
- **Digital signatures are a demo.** A legally binding launch would use Aadhaar eSign or a DSC under the IT Act, 2000.
- **Payments are fake.** No money moves. A real launch needs licensed payment partners and must follow local regulations, such as RBI and NPCI rules for UPI.

## Project structure

```
index.html          App shell
css/styles.css      Base theme: WHATSMORE blue tokens (light + dark), mobile layout
css/more.css        Styles for the v2 features
css/blueprint.css   Styles for the v3 blueprint features
js/icons.js         SVG icon set
js/data.js          Demo seed data (contacts, chats, stories, catalogue…)
js/core.js          State, storage, helpers, menus, modals, toasts
js/sidebar.js       Navigation rail, chat list, new chat, status, calls, communities, files
js/settings.js      Settings pages (profile, security, privacy, payments, plans)
js/chat.js          Conversation view, message rendering, composer, emoji panel
js/messaging.js     Sending, simulated replies, business bot, payments, polls, voice, AI
js/features.js      Chat actions, lock, forward, attachments, QR, call links, groups
js/overlays.js      Info drawer, stories viewer, calls, media viewer
js/docs.js          Any file type, document viewer, Document Studio (AI correction), digital signatures
js/devices.js       Linked devices, multi-tab sync, anti-scam AI, voice AI, translation, data migration
js/modules.js       Home, WHATSMORE AI, Services hub and all super-app modules, profiles, chat import
js/privacy.js       Secret chat, chat privacy, forwarding limits, two-way live translation, profiles, photo enhance
js/callsplus.js     Live captions, call recording with consent, host controls, waiting room, meeting scheduling
js/callsx.js        Camera switching, virtual backgrounds, audio/video quality, call waiting & hold, add people to a call
js/recovery.js      Account recovery: recovery key, recovery email, trusted contacts, recover from sign-in
js/superapp.js      v5: home bar & notification center, location sharing, reach controls, group live translation, meeting chat & summary, seller dashboard, DND, data & privacy, reporting, plans, admin regions/DR/AI monitoring
js/cloudplus.js     Smart folders, links, duplicates, backup, voice status, SOS audio, Learn PDF, marketplace & admin extras
js/onboarding.js    Splash, login/registration with OTP, username creation
js/cloud.js         v7: Supabase accounts, @username search, live 1:1 and group chats
js/rtc.js           v9: real voice/video calls (WebRTC, Supabase Realtime signalling)
js/stories.js       v9: real 24-hour stories with audiences, close friends and view counts
js/moderation.js    v10: suspension notices, announcements, badges and badge requests in the app
js/admin.js         v10: the Command Center admin panel (admin.html, css/admin.css)
js/main.js          Event wiring and startup
```
