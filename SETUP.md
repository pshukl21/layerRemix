# LayerRemix — Setup Guide

This app now has real accounts (sign up / log in), a real database, and real
file uploads/downloads, powered by [Supabase](https://supabase.com) (a free
hosted Postgres + Auth + file storage service). Follow these steps once to
connect it.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free tier is plenty for this).
2. Click **New Project**. Pick any name/region, and set a database password
   (save it somewhere — you won't need it for this app, but Supabase asks).
3. Wait ~2 minutes for the project to finish provisioning.

## 2. Run the database schema

1. In your new project, open the **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` in this project, copy its entire contents,
   paste into the SQL editor, and click **Run**.
   - This creates the `profiles` and `artworks` tables, sets up row-level
     security so people can only edit their own data, creates two storage
     buckets (`previews` and `source-files`), and adds a trigger that
     automatically creates a profile row whenever someone signs up.
4. You should see "Success. No rows returned."

## 3. Get your API keys

1. In the sidebar, go to **Settings -> API**.
2. Copy the **Project URL** and the **anon / public** key (NOT the
   `service_role` key — that one must never go in frontend code).

## 4. Configure the app

1. In this project's root folder, copy `.env.local.example` to `.env.local`:
   ```
   cp .env.local.example .env.local
   ```
2. Open `.env.local` and paste in your values:
   ```
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ```

## 5. Install and run

```
npm install
npm run dev
```

Open the printed local URL. You should no longer see the yellow "backend
isn't configured" banner. Click **Sign In** in the header to create an
account (email + password) and try uploading a piece of art.

> Note: by default, Supabase requires email confirmation before a new
> account can log in. For faster local testing, you can turn this off in
> **Authentication -> Providers -> Email -> Confirm email** (toggle off).
> For a real production launch, leave email confirmation on and consider
> also enabling Supabase's rate limiting / CAPTCHA options under
> **Authentication -> Settings**.

## 6. Deploying it for real

This is a static Vite app + Supabase backend, so you can deploy the built
frontend (`npm run build` -> the `dist/` folder) to any static host —
Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc. Just set the same
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as environment variables in
that host's dashboard. No separate server process is needed — the browser
talks directly to Supabase.

> The app uses real client-side routes (e.g. `/art/some-id`) so artwork
> pages are shareable and bookmarkable. That means a direct visit or a
> page refresh on one of those URLs needs your host to serve `index.html`
> for every path instead of 404ing. `vercel.json` (for Vercel) and
> `public/_redirects` (for Netlify) are already included in this project
> to handle that — no extra setup needed on those two hosts. If you use a
> different host, look for a "SPA fallback" or "rewrite all routes to
> index.html" option in its docs.

## How it all fits together

- **Accounts**: Supabase Auth handles email/password signup and login.
  A database trigger auto-creates a row in `profiles` for every new user.
- **Database**: the `artworks` table stores every published piece
  (title, description, tags, owner, file paths, counts). Row-level
  security policies mean anyone can *read* artworks, but only the owner
  can create/edit/delete their own.
- **File storage**: uploaded preview images go in the `previews` bucket;
  uploaded `.psd`/source files go in the `source-files` bucket, each
  under a folder named after the uploader's user ID. Both buckets are
  public-read (so gallery images and downloads work with a plain URL),
  but only signed-in users can upload, and only into their own folder.
- **Demo content**: the sample artworks you saw before (Neon Echoes,
  Obsidian Echoes, etc.) are still bundled as static demo data so the
  gallery isn't empty on first run. They're marked read-only — they
  won't rack up real downloads/forks, and their "download" just grabs
  the demo preview image since there's no real source file behind them.
  Feel free to delete `src/data.ts`'s contents (or remove the merge in
  `App.tsx`) once you have real content of your own.

## Where things live in the code

| Concern | File |
|---|---|
| Supabase client | `src/lib/supabase.ts` |
| Auth state (signup/login/logout) | `src/contexts/AuthContext.tsx` |
| Login/signup UI | `src/components/AuthModal.tsx` |
| Fetching/publishing artworks, download URLs | `src/lib/artworks.ts` |
| Database schema + storage policies | `supabase/schema.sql` |
