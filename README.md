# WHATSMORE — More Than Chat.

A working, clickable demo of the WHATSMORE chat app with a WhatsApp-style interface. It covers all 10 core features. It runs entirely in the browser: no install, no build step, no server.

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

## Important: this is a prototype

- **Other people are simulated.** Replies, typing indicators, votes and payments come from scripted bots. There is no backend and no real network messaging.
- **Encryption is shown, not implemented.** A production build would use the Signal protocol for 1:1 chats and Sender Keys for groups, with independent audits.
- **AI and translation are rule-based.** Production would use an on-device or privacy-preserving model.
- **Digital signatures are a demo.** A legally binding launch would use Aadhaar eSign or a DSC under the IT Act, 2000.
- **Payments are fake.** No money moves. A real launch needs licensed payment partners and must follow local regulations, such as RBI and NPCI rules for UPI.

## Project structure

```
index.html          App shell
css/styles.css      WhatsApp-style theme (light + dark), mobile layout
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
js/cloudplus.js     Smart folders, links, duplicates, backup, voice status, SOS audio, Learn PDF, marketplace & admin extras
js/onboarding.js    Splash, login/registration with OTP, username creation
js/main.js          Event wiring and startup
```
