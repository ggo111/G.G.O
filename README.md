# G G O — Ink-Forge Physics Jousting

**Mobile-first 2D clockwork jousting** with freehand vehicle sketching, Matter.js physics, Solo Campaign, Online Quick Match, and Private Rooms.

> **v2.0 — Supabase edition**  
> Simple name-based accounts (no passwords / no email). Same visual identity. Stronger foundation. Ready for GitHub + Vercel + Supabase.

---

## What’s new in v2

- **Full migration to Supabase** (Auth + Postgres + Realtime)
- **Ultra-simple accounts**: player just types a name → that’s the account (perfect for kids)
- Anonymous Supabase session under the hood + unique username claim
- Profile, inventory, trophies, missions synced to the cloud
- Cleaner architecture, Error Boundary, Zustand for UI state, better Vite chunking
- Production-ready SQL schema + RLS policies included

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| UI           | React 19 + TypeScript + Tailwind 4  |
| State (UI)   | Zustand                             |
| Physics      | Matter.js                           |
| Backend      | **Supabase** (Auth + DB + Realtime) |
| Networking   | WebRTC DataChannels (P2P)           |
| Build        | Vite 6                              |
| Deploy       | Vercel                              |

---

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New project
2. Wait for the project to be ready
3. **Authentication → Providers** → enable **Anonymous** sign-ins
4. **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run
5. **Database → Replication** → enable Realtime for:
   - `profiles`
   - `match_queue`
   - `rooms`
6. **Settings → API** → copy:
   - Project URL
   - `anon` `public` key

---

## 2. Local Setup

```bash
git clone https://github.com/YOUR_USERNAME/ggo-ink-forge.git
cd ggo-ink-forge
npm install
cp .env.example .env.local
```

Fill `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_RTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
VITE_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

---

## 3. GitHub + Vercel (production)

```bash
git init
git add .
git commit -m "feat: G G O v2 – Supabase + simple name accounts"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ggo-ink-forge.git
git push -u origin main
```

On [vercel.com](https://vercel.com):

1. Import the repository
2. Framework: Vite
3. Build Command: `npm run build`
4. Output: `dist`
5. Add the same `VITE_*` environment variables
6. Deploy

After deploy, set `VITE_APP_URL` to your Vercel domain and redeploy.

Also add your Vercel domain in **Supabase → Authentication → URL Configuration → Site URL / Redirect URLs**.

---

## Account Model (kid-friendly)

1. First visit → beautiful name screen
2. Player types a name (2–20 chars, letters/numbers/_)
3. System creates an anonymous Supabase user + claims the username atomically
4. Profile is created and stored both locally and in the cloud
5. Next visits → automatic restore (no login form)

No email, no password, no OAuth complexity.

---

## Project Structure

```
src/
├── components/          # UI (TitleScreen, NameEntryScreen, GameViewport, modals…)
├── config/              # supabaseConfig, economy, promo
├── data/                # weapons, skins, themes, catalog
├── engine/              # Matter.js physics + input
├── lib/                 # supabase client + authService
├── net/                 # WebRTC (online + hotspot)
├── store/               # Zustand UI store
├── types/
├── utils/               # profileStore, audio, shape compiler…
supabase/
└── schema.sql           # Full production schema + RLS + claim_username RPC
```

---

## Scripts

| Command            | Description                |
|--------------------|----------------------------|
| `npm run dev`      | Local development          |
| `npm run build`    | Type-check + production    |
| `npm run preview`  | Preview production build   |
| `npm run typecheck`| TypeScript only            |

---

## Security (RLS)

- Profiles: anyone authenticated can read, only owner can write
- Usernames: unique claim via `claim_username` RPC (security definer)
- Queue & Rooms: authenticated access with owner checks
- Trophy inflation limited by application logic + DB constraints

---


## Online Architecture (v2)

```
Matchmaking     →  match_queue table + client-side pairing + Realtime broadcast
Private Rooms   →  rooms table (invite code) + Realtime channel room:{id}
Signaling       →  broadcast events (offer / answer / ice) on the room channel
Game traffic    →  WebRTC DataChannel (host-authoritative snapshots @ 20 Hz)
Identity        →  Supabase Anonymous Auth + claim_username RPC
```

Host runs the Matter.js simulation and streams snapshots + FX to guests.
Guests send inputs and blueprints to the host over the DataChannel.
If no opponent is found within ~20s, Quick Match falls back to a local bot.

## Design System (unchanged)

- BG `#161412` · Surface `#221e1b` · Brass `#D99B26` · Ember `#E85D2A`
- Fonts: Bricolage Grotesque · Plus Jakarta Sans · JetBrains Mono

---

Built for smooth play, simple onboarding, and clean deployment.
