-- ============================================================================
-- LayerRemix database schema
-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL Editor
-- -> New query -> paste this whole file -> Run).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- One row per user, keyed to Supabase's built-in auth.users table.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
-- Reads the "username" passed in at signup time (see AuthContext.tsx);
-- falls back to a generated name if it's missing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'username', 'New Creator')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. ARTWORKS
-- ---------------------------------------------------------------------------
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text default '',
  tags text[] not null default '{}',
  -- Structured "what's needed" flags, distinct from the freeform
  -- description — e.g. {"Background","Color Grading"}. Lets the gallery
  -- be filtered by specific gaps instead of relying on reading every
  -- description. Values are validated client-side against a fixed list
  -- (see OPEN_CHALLENGES in src/lib/challenges.ts).
  open_challenges text[] not null default '{}',
  image_path text not null,          -- path inside the "previews" storage bucket
  source_file_path text,             -- path inside the "source-files" storage bucket
  source_file_name text,             -- original filename, e.g. "my-art.psd"
  type text not null default 'Original' check (type in ('Original', 'Remix')),
  parent_artwork_id uuid references public.artworks (id) on delete set null,
  downloads integer not null default 0,
  forks integer not null default 0,
  views integer not null default 0,
  resolution text default '',
  -- Real layer count and original file size, captured at publish time —
  -- shown as a badge on cards ("12 Layers · 142 MB"). Null for legacy rows
  -- published before these existed.
  layer_count integer,
  file_size_bytes bigint,
  -- Where the crop should focus when this preview is shown cropped (e.g.
  -- gallery cards). Percentages, 0-100; 50/50 is dead center. Only affects
  -- cropping/positioning — never changes which image is actually shown.
  focal_x real not null default 50,
  focal_y real not null default 50,
  -- SHA-256 hex digest of the original (unzipped) PSD's bytes. Used to
  -- block someone re-uploading an exact copy of a file that's already on
  -- the platform (e.g. downloading someone else's PSD, unchanged, to farm
  -- another credit). Null for legacy rows uploaded before this existed.
  file_hash text,
  created_at timestamptz not null default now()
);

alter table public.artworks enable row level security;

create policy "Artworks are publicly readable"
  on public.artworks for select
  using (true);

create policy "Users can publish their own artworks"
  on public.artworks for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own artworks"
  on public.artworks for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own artworks"
  on public.artworks for delete
  using (auth.uid() = owner_id);

-- Safe to run standalone against an existing database (adds the columns
-- only if they aren't already there).
alter table public.artworks add column if not exists focal_x real not null default 50;
alter table public.artworks add column if not exists focal_y real not null default 50;
alter table public.artworks add column if not exists file_hash text;
alter table public.artworks add column if not exists open_challenges text[] not null default '{}';
alter table public.artworks add column if not exists layer_count integer;
alter table public.artworks add column if not exists file_size_bytes bigint;

-- Partial unique index: enforces "no two artworks share the same file
-- hash" as a hard database-level backstop, while still allowing any
-- number of legacy rows with a null hash (a partial unique index ignores
-- nulls). This is the real enforcement — the client-side check exists
-- only to give people an immediate, friendly message instead of a raw
-- constraint-violation error.
create unique index if not exists artworks_file_hash_unique
  on public.artworks (file_hash)
  where file_hash is not null;

-- ---------------------------------------------------------------------------
-- Favorites ("hearting" an artwork)
--
-- The list of what a person has hearted is private — visible only to them,
-- on their own profile. But the aggregate count of hearts per artwork needs
-- to be public, since it's used for sorting (Trending) and shown on cards.
-- That split is why this is two things: a private join table, plus a public
-- counter column on `artworks` kept in sync by a single atomic function.
--
-- There are deliberately no insert/delete policies on `favorites` — all
-- writes go through toggle_favorite() below, so the counter can never drift
-- out of sync with the actual rows.
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

alter table public.artworks add column if not exists hearts_count integer not null default 0;

-- Hearts or un-hearts an artwork for the current user, atomically updating
-- the public counter at the same time. Returns the new state (true = now
-- hearted, false = now un-hearted) so the client knows how to update its UI.
create or replace function public.toggle_favorite(p_artwork_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_already_favorited boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select exists(
    select 1 from public.favorites
    where user_id = auth.uid() and artwork_id = p_artwork_id
  ) into v_already_favorited;

  if v_already_favorited then
    delete from public.favorites
    where user_id = auth.uid() and artwork_id = p_artwork_id;

    update public.artworks
    set hearts_count = greatest(0, hearts_count - 1)
    where id = p_artwork_id;

    return false;
  else
    insert into public.favorites (user_id, artwork_id)
    values (auth.uid(), p_artwork_id);

    update public.artworks
    set hearts_count = hearts_count + 1
    where id = p_artwork_id;

    return true;
  end if;
end;
$$;

grant execute on function public.toggle_favorite(uuid) to authenticated;

-- Engagement counters (forks, views) need to be bumped by people who don't
-- own the artwork — e.g. anyone forking someone else's piece, or just
-- viewing it. The plain "Users can update their own artworks" policy above
-- blocks that (correctly — it stops people editing content they don't own),
-- so these run as SECURITY DEFINER to bump only the counter column, nothing
-- else, regardless of who's calling.
create or replace function public.increment_artwork_forks(p_artwork_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  update public.artworks
  set forks = forks + 1
  where id = p_artwork_id
  returning forks into new_count;
  return new_count;
end;
$$;

grant execute on function public.increment_artwork_forks(uuid) to authenticated;

create or replace function public.increment_artwork_downloads(p_artwork_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  update public.artworks
  set downloads = downloads + 1
  where id = p_artwork_id
  returning downloads into new_count;
  return new_count;
end;
$$;

grant execute on function public.increment_artwork_downloads(uuid) to authenticated;

create or replace function public.increment_artwork_views(p_artwork_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  update public.artworks
  set views = views + 1
  where id = p_artwork_id
  returning views into new_count;
  return new_count;
end;
$$;

-- Granted to anon too, since browsing (and thus racking up views) doesn't
-- require an account.
grant execute on function public.increment_artwork_views(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. DOWNLOAD CREDITS ("Give to Get" karma system)
-- New users start with 0 credits — they earn their first one by publishing
-- something. Publishing an original artwork or a
-- remix both earn 1 credit (1 upload/remix = 1 download). Downloading
-- someone else's file costs 1 credit.
--
-- Credits are only ever granted by the trigger below — a side effect of a
-- real artwork row being inserted, which is already gated by the "Users can
-- publish their own artworks" RLS policy above. There is intentionally no
-- client-callable "add credits" function, so nobody can mint credits without
-- actually publishing something.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists credits integer not null default 0;

create or replace function public.handle_new_artwork_credits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set credits = credits + 1
  where id = new.owner_id;
  return new;
end;
$$;

drop trigger if exists on_artwork_published on public.artworks;
create trigger on_artwork_published
  after insert on public.artworks
  for each row execute procedure public.handle_new_artwork_credits();

-- Atomically spends one credit for the currently authenticated user.
-- Restricted to auth.uid() = p_user_id so nobody can spend down someone
-- else's balance; raises an exception if they have no credits left.
create or replace function public.spend_credit(p_user_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set credits = credits - 1
  where id = p_user_id and credits > 0
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'Not enough credits';
  end if;

  return new_balance;
end;
$$;

grant execute on function public.spend_credit(uuid) to authenticated;

-- Atomically enforces the "deleting costs 1 credit" rule: checks ownership
-- and that the owner has at least 1 credit, deducts it, then deletes the
-- artwork row — all in one transaction so there's no window where credits
-- could be spent without the delete happening (or vice versa). Returns the
-- storage paths so the client can clean up the actual files afterward.
-- Never allows credits below 0, since the same "credits > 0" guard used by
-- spend_credit applies here too.
create or replace function public.delete_artwork_with_credit_check(p_artwork_id uuid)
returns table(image_path text, source_file_path text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner_id uuid;
  v_image_path text;
  v_source_file_path text;
  v_new_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select owner_id, artworks.image_path, artworks.source_file_path
    into v_owner_id, v_image_path, v_source_file_path
    from public.artworks
    where id = p_artwork_id;

  if v_owner_id is null then
    raise exception 'Artwork not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set credits = credits - 1
  where id = v_owner_id and credits > 0
  returning credits into v_new_balance;

  if v_new_balance is null then
    raise exception 'Not enough credits';
  end if;

  delete from public.artworks where id = p_artwork_id;

  return query select v_image_path, v_source_file_path;
end;
$$;

grant execute on function public.delete_artwork_with_credit_check(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. STORAGE BUCKETS
-- "previews" holds public gallery thumbnails/preview images.
-- "source-files" holds the original uploaded files (e.g. .psd).
-- Both are public-read buckets so the gallery + downloads work with plain
-- URLs; only signed-in users may upload, and only into their own folder
-- (storage path must start with their user id).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('previews', 'previews', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('source-files', 'source-files', true)
on conflict (id) do nothing;

create policy "Preview images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'previews');

create policy "Users can upload their own preview images"
  on storage.objects for insert
  with check (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own preview images"
  on storage.objects for delete
  using (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Source files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'source-files');

create policy "Users can upload their own source files"
  on storage.objects for insert
  with check (
    bucket_id = 'source-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own source files"
  on storage.objects for delete
  using (
    bucket_id = 'source-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- "avatars" holds profile photos. Public-read (so avatars display anywhere
-- without a backend), but only the owner may upload/replace/delete their own.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Site admin flag + homepage hero images
--
-- A small number of trusted accounts (set manually via SQL — see below) can
-- update the before/after images shown in the homepage hero, without
-- needing a code change. Everyone else can only read the current images.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- To grant someone admin access, run (replace the username):
--   update public.profiles set is_admin = true where username = 'ParthCreations';

-- Singleton table — the `check (id)` trick means only one row can ever
-- exist, since `true` is the only boolean value satisfying it.
create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  hero_before_image_path text,
  hero_after_image_path text,
  hero_download_url text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

-- Safe to run standalone if site_settings already existed before this column did.
alter table public.site_settings add column if not exists hero_download_url text;

alter table public.site_settings enable row level security;

create policy "Site settings are publicly readable"
  on public.site_settings for select
  using (true);

create policy "Only admins can update site settings"
  on public.site_settings for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- "site-assets" holds admin-managed images (currently just the hero
-- before/after pair). Public-read, but only admins may upload/replace them.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "Site assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'site-assets');

create policy "Only admins can upload site assets"
  on storage.objects for insert
  with check (
    bucket_id = 'site-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can update site assets"
  on storage.objects for update
  using (
    bucket_id = 'site-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- Content reports + admin takedown
--
-- Any signed-in user can report an artwork. Reports are private — only
-- admins can ever read them (not even the reporter can see others' reports,
-- and the reported artwork's owner never sees who reported them). Admins
-- get a real enforcement path: a takedown function that can actually
-- remove violating content, not just a form that goes into a black hole.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users can submit their own reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Only admins can view reports"
  on public.reports for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can update report status"
  on public.reports for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admin-only takedown — deliberately separate from the regular
-- delete_artwork_with_credit_check function, since this isn't the owner
-- removing their own work (no credit cost, no ownership check) — it's an
-- admin acting on a report. Returns the storage paths so the client can
-- clean up the actual files, same pattern as the regular delete function.
create or replace function public.admin_delete_artwork(p_artwork_id uuid)
returns table(image_path text, source_file_path text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_image_path text;
  v_source_file_path text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Not authorized';
  end if;

  select artworks.image_path, artworks.source_file_path
    into v_image_path, v_source_file_path
    from public.artworks
    where id = p_artwork_id;

  if v_image_path is null then
    raise exception 'Artwork not found';
  end if;

  delete from public.artworks where id = p_artwork_id;

  return query select v_image_path, v_source_file_path;
end;
$$;

grant execute on function public.admin_delete_artwork(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Contests
--
-- A contest is built on top of a normal artwork: the admin publishes the
-- base PSD through the regular upload flow (like anyone else would), then
-- links that artwork as a contest's "base file" here. Entries are just
-- ordinary remixes of that artwork — the existing parent_artwork_id
-- relationship, fork mechanism, and tree-building logic all work
-- unmodified. Publicly readable by everyone; only admins can create or
-- manage them.
-- ---------------------------------------------------------------------------
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  base_artwork_id uuid not null references public.artworks(id) on delete cascade,
  deadline timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.contests enable row level security;

create policy "Contests are publicly readable"
  on public.contests for select
  using (true);

create policy "Only admins can create contests"
  on public.contests for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can update contests"
  on public.contests for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Only admins can delete contests"
  on public.contests for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
