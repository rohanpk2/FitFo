-- Knowledge corpus for creator-driven chatbot retrieval.
--
-- This is intentionally separate from the per-user `ingestion_jobs` /
-- `workouts` tables because the corpus is admin-owned, public-read content
-- (Jacob's TikToks, future creators) — not per-user workout imports.
--
-- Postgres is the source of truth. pgvector is the search index. Approval
-- status lives on the chunk so a single video can have some great chunks
-- and some rejected ones without gating the whole video.

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_corpus_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ─── creators ───────────────────────────────────────────────────────────
-- One row per coach/source whose content we ingest. Lets us scale beyond
-- Jacob without a schema change.
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  handle text not null,
  display_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (platform, handle)
);

drop trigger if exists creators_set_updated_at on public.creators;
create trigger creators_set_updated_at
before update on public.creators
for each row
execute function public.set_corpus_updated_at();

-- ─── content_sources ────────────────────────────────────────────────────
-- One row per source video/post. `transcript` is the raw, reusable
-- knowledge — keep it forever so we can re-chunk / re-embed later without
-- re-downloading. We do NOT store the raw video/audio for corpus content.
create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  platform text not null,
  platform_video_id text not null,
  original_url text not null,
  caption text,
  transcript text,
  transcript_model text,
  transcript_language text,
  -- pending | transcribing | transcribed | chunked | tagged | embedded | failed
  processed_status text not null default 'pending',
  -- pending | approved | rejected
  approval_status text not null default 'pending',
  error text,
  apify_meta jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Idempotency: re-running discovery never creates duplicates.
  unique (platform, platform_video_id)
);

create index if not exists content_sources_creator_idx
  on public.content_sources (creator_id, created_at desc);
create index if not exists content_sources_processed_status_idx
  on public.content_sources (processed_status);
create index if not exists content_sources_approval_status_idx
  on public.content_sources (approval_status);

drop trigger if exists content_sources_set_updated_at on public.content_sources;
create trigger content_sources_set_updated_at
before update on public.content_sources
for each row
execute function public.set_corpus_updated_at();

-- ─── content_chunks ─────────────────────────────────────────────────────
-- One row per retrieval chunk. Tags are checked at write time against the
-- locked taxonomies below (chunk_type / muscle_group / goal). equipment and
-- exercise stay free-text since we want to surface whatever Jacob says.
create table if not exists public.content_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.content_sources (id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  chunk_type text,
  exercise text[] not null default '{}',
  muscle_group text[] not null default '{}',
  equipment text[] not null default '{}',
  goal text[] not null default '{}',
  -- pending | needs_review | approved | rejected
  approval_status text not null default 'pending',
  reviewer_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, chunk_index),
  constraint content_chunks_chunk_type_chk
    check (
      chunk_type is null
      or chunk_type in ('tip', 'cue', 'programming', 'form', 'mindset', 'nutrition', 'other')
    ),
  -- muscle_group must be a subset of the locked 5-group taxonomy used in
  -- workout_parser.py. We use the array containment trick: target <@ allowed.
  constraint content_chunks_muscle_group_chk
    check (muscle_group <@ array['chest','back','shoulders','arms','legs']::text[]),
  constraint content_chunks_goal_chk
    check (goal <@ array['hypertrophy','strength','fat_loss','endurance','mobility','mindset','recovery']::text[]),
  constraint content_chunks_approval_chk
    check (approval_status in ('pending','needs_review','approved','rejected'))
);

create index if not exists content_chunks_source_idx
  on public.content_chunks (source_id, chunk_index);
create index if not exists content_chunks_approval_status_idx
  on public.content_chunks (approval_status, created_at desc);
create index if not exists content_chunks_muscle_group_gin_idx
  on public.content_chunks using gin (muscle_group);
create index if not exists content_chunks_goal_gin_idx
  on public.content_chunks using gin (goal);
create index if not exists content_chunks_equipment_gin_idx
  on public.content_chunks using gin (equipment);
create index if not exists content_chunks_exercise_gin_idx
  on public.content_chunks using gin (exercise);

drop trigger if exists content_chunks_set_updated_at on public.content_chunks;
create trigger content_chunks_set_updated_at
before update on public.content_chunks
for each row
execute function public.set_corpus_updated_at();

-- ─── content_embeddings ─────────────────────────────────────────────────
-- One row per chunk. Model is on the row so we can re-embed to a new model
-- (e.g. -3-large) later without losing the old vectors.
-- vector(1536) matches OpenAI text-embedding-3-small.
create table if not exists public.content_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.content_chunks (id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- HNSW + cosine matches OpenAI's embedding geometry. ivfflat would also work
-- but HNSW handles low-cardinality datasets (early MVP) without a `lists`
-- tuning parameter and does not require a rebuild after bulk inserts.
create index if not exists content_embeddings_hnsw_idx
  on public.content_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ─── RLS ────────────────────────────────────────────────────────────────
-- The corpus is admin-owned. We do all writes via the service role from the
-- backend (which bypasses RLS), and we deliberately do NOT expose these
-- tables to the anon / authenticated roles. If you ever want to power chat
-- retrieval from the client side, add a policy here that reads only rows
-- with approval_status='approved'. For now, all access goes through the
-- backend.
alter table if exists public.creators enable row level security;
alter table if exists public.content_sources enable row level security;
alter table if exists public.content_chunks enable row level security;
alter table if exists public.content_embeddings enable row level security;

-- No policies = deny-all for anon/authenticated. Service role still works.
