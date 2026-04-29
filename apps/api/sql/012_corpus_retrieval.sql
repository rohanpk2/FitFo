-- Vector retrieval RPC for the chat endpoint.
--
-- Wraps the pgvector cosine search behind a Postgres function so the API
-- doesn't need raw SQL — supabase-py can call it via `supa.rpc(...)`.
-- The function:
--   1. Filters to approval_status='approved' chunks only
--   2. Optionally filters by creator_id, muscle_groups, goals
--   3. Returns the top N by cosine similarity, joined to source URL
--
-- Cosine distance in pgvector is the `<=>` operator. We expose `similarity`
-- as `1 - distance` so callers can think in "higher is better" terms.

create or replace function public.match_content_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  filter_creator_id uuid default null,
  filter_muscle_groups text[] default null,
  filter_goals text[] default null
)
returns table (
  chunk_id uuid,
  source_id uuid,
  chunk_text text,
  chunk_type text,
  exercise text[],
  muscle_group text[],
  equipment text[],
  goal text[],
  source_url text,
  creator_id uuid,
  similarity float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.source_id,
    c.chunk_text,
    c.chunk_type,
    c.exercise,
    c.muscle_group,
    c.equipment,
    c.goal,
    s.original_url as source_url,
    s.creator_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.content_chunks c
  join public.content_embeddings e on e.chunk_id = c.id
  join public.content_sources s on s.id = c.source_id
  where c.approval_status = 'approved'
    and (filter_creator_id is null or s.creator_id = filter_creator_id)
    and (
      filter_muscle_groups is null
      or array_length(filter_muscle_groups, 1) is null
      or c.muscle_group && filter_muscle_groups
    )
    and (
      filter_goals is null
      or array_length(filter_goals, 1) is null
      or c.goal && filter_goals
    )
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

-- Allow the service role (which the backend uses) to call this RPC.
-- Note: anon/authenticated still cannot read the underlying tables thanks
-- to the RLS policies in 011_creator_corpus.sql. Backend-only retrieval.
grant execute on function public.match_content_chunks(
  vector(1536), int, uuid, text[], text[]
) to service_role;
