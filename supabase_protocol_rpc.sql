-- SAFE MIGRATION: Optimized Protocol Matches RPC
-- This version is lightweight and won't crash Supabase

-- 1. Drop existing function first
DROP FUNCTION IF EXISTS get_protocol_matches(uuid, text[]);

-- 2. Create optimized function
CREATE OR REPLACE FUNCTION get_protocol_matches(
    doc_id UUID,
    query_diseases TEXT[]
)
RETURNS TABLE (
    match_type TEXT,
    matched_diseases TEXT[],
    meds JSONB,
    tests JSONB,
    advice TEXT
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    first_disease TEXT;
BEGIN
    -- Early exit if no diseases provided
    IF array_length(query_diseases, 1) IS NULL OR array_length(query_diseases, 1) = 0 THEN
        RETURN;
    END IF;

    first_disease := query_diseases[1];

    -- Try exact match first (all diseases match) - limit to recent 20 prescriptions
    RETURN QUERY
    SELECT 
        'exact'::TEXT as match_type,
        query_diseases as matched_diseases,
        p.meds,
        p.tests,
        p.advice
    FROM prescriptions p
    WHERE p.doctor_id = doc_id
    AND (
        SELECT COUNT(*)
        FROM jsonb_array_elements(p.diseases) d
        WHERE d->>'name' = ANY(query_diseases)
    ) = array_length(query_diseases, 1)
    ORDER BY p.created_at DESC
    LIMIT 1;

    -- If exact match found, we're done (RETURN QUERY doesn't exit, so check row count)
    IF FOUND THEN
        RETURN;
    END IF;

    -- Fallback: Match just the first disease
    RETURN QUERY
    SELECT 
        'partial'::TEXT as match_type,
        ARRAY[first_disease]::TEXT[] as matched_diseases,
        p.meds,
        p.tests,
        p.advice
    FROM prescriptions p
    WHERE p.doctor_id = doc_id
    AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.diseases) d
        WHERE d->>'name' = first_disease
    )
    ORDER BY p.created_at DESC
    LIMIT 1;
END;
$$;
