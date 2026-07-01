CREATE OR REPLACE FUNCTION public.search_knowledge(query_text text, stage_filter integer DEFAULT NULL::integer, framework_filter text DEFAULT NULL::text, max_results integer DEFAULT 5)
 RETURNS TABLE(id uuid, framework text, category text, title text, content text, tags text[], relevance real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    k.id,
    k.framework,
    k.category,
    k.title,
    k.content,
    k.tags,
    ts_rank_cd(k.search_vector, 
      to_tsquery('english', 
        array_to_string(
          ARRAY(SELECT lexeme FROM unnest(to_tsvector('english', coalesce(query_text, ''))) ORDER BY positions LIMIT 10),
          ' | '
        )
      )
    ) AS relevance
  FROM public.knowledge_chunks k
  WHERE
    (stage_filter IS NULL OR stage_filter = ANY(k.relevant_stages))
    AND (framework_filter IS NULL OR k.framework = framework_filter)
    AND (
      query_text IS NULL
      OR query_text = ''
      OR k.search_vector @@ to_tsquery('english',
        array_to_string(
          ARRAY(SELECT lexeme FROM unnest(to_tsvector('english', coalesce(query_text, ''))) ORDER BY positions LIMIT 10),
          ' | '
        )
      )
    )
  ORDER BY relevance DESC
  LIMIT max_results;
$$;