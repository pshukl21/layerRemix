-- ============================================================================
-- LayerHub database schema
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
  image_path text not null,          -- path inside the "previews" storage bucket
  source_file_path text,             -- path inside the "source-files" storage bucket
  source_file_name text,             -- original filename, e.g. "my-art.psd"
  type text not null default 'Original' check (type in ('Original', 'Remix')),
  parent_artwork_id uuid references public.artworks (id) on delete set null,
  downloads integer not null default 0,
  forks integer not null default 0,
  views integer not null default 0,
  resolution text default '',
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

-- ---------------------------------------------------------------------------
-- 3. STORAGE BUCKETS
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

create policy "Source files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'source-files');

create policy "Users can upload their own source files"
  on storage.objects for insert
  with check (
    bucket_id = 'source-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
