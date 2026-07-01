
-- Create knowledge_chunks table for RAG
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  relevant_stages integer[] NOT NULL DEFAULT '{}',
  source_url text,
  embedding extensions.vector(1536),
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create trigger to maintain search_vector
CREATE OR REPLACE FUNCTION public.knowledge_chunks_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_knowledge_search_vector
  BEFORE INSERT OR UPDATE ON public.knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_chunks_search_vector();

-- Create indexes
CREATE INDEX idx_knowledge_chunks_search ON public.knowledge_chunks USING gin(search_vector);
CREATE INDEX idx_knowledge_chunks_framework ON public.knowledge_chunks(framework);
CREATE INDEX idx_knowledge_chunks_category ON public.knowledge_chunks(category);
CREATE INDEX idx_knowledge_chunks_stages ON public.knowledge_chunks USING gin(relevant_stages);
CREATE INDEX idx_knowledge_chunks_tags ON public.knowledge_chunks USING gin(tags);

-- RLS
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge"
  ON public.knowledge_chunks FOR SELECT
  TO authenticated
  USING (true);

-- Hybrid search function
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_text text,
  stage_filter integer DEFAULT NULL,
  framework_filter text DEFAULT NULL,
  max_results integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  framework text,
  category text,
  title text,
  content text,
  tags text[],
  relevance real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.id,
    k.framework,
    k.category,
    k.title,
    k.content,
    k.tags,
    ts_rank_cd(k.search_vector, websearch_to_tsquery('english', query_text)) AS relevance
  FROM public.knowledge_chunks k
  WHERE
    (stage_filter IS NULL OR stage_filter = ANY(k.relevant_stages))
    AND (framework_filter IS NULL OR k.framework = framework_filter)
    AND (
      query_text IS NULL
      OR query_text = ''
      OR k.search_vector @@ websearch_to_tsquery('english', query_text)
    )
  ORDER BY relevance DESC
  LIMIT max_results;
$$;
