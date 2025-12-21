-- SAFE MIGRATION: Optimized Suggestion RPC
-- This version is lightweight and won't crash Supabase

-- 1. Drop existing function first (required for return type changes)
DROP FUNCTION IF EXISTS get_suggestions(uuid, text, text);

-- 2. Create optimized function
CREATE OR REPLACE FUNCTION get_suggestions(
    doc_id UUID,
    category TEXT,
    search_term TEXT
)
RETURNS TABLE (
    label TEXT,
    subtext TEXT,
    usage_count BIGINT,
    payload JSONB
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Early exit if search term is too short
    IF length(search_term) < 2 THEN
        RETURN;
    END IF;

    -- MEDICINES: Simple aggregation with early LIMIT
    IF category = 'medicines' THEN
        RETURN QUERY
        WITH recent_meds AS (
            SELECT m
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.meds) AS m
            WHERE p.doctor_id = doc_id
            AND m->>'brand' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100  -- Limit source data early
        )
        SELECT 
            (m->>'brand')::TEXT as label,
            COALESCE(m->>'dosage', '')::TEXT as subtext,
            COUNT(*)::BIGINT as usage_count,
            jsonb_build_object(
                'dosage', m->>'dosage',
                'freq', m->>'freq',
                'duration', m->>'duration'
            ) as payload
        FROM recent_meds
        GROUP BY m->>'brand', m->>'dosage', m->>'freq', m->>'duration'
        ORDER BY usage_count DESC
        LIMIT 15;

    -- DISEASES: Simple label-only return
    ELSIF category = 'diseases' THEN
        RETURN QUERY
        WITH recent_diseases AS (
            SELECT d->>'name' as name
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.diseases) AS d
            WHERE p.doctor_id = doc_id
            AND d->>'name' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100
        )
        SELECT 
            name::TEXT as label,
            'Previously used'::TEXT as subtext,
            COUNT(*)::BIGINT as usage_count,
            NULL::JSONB as payload
        FROM recent_diseases
        GROUP BY name
        ORDER BY usage_count DESC
        LIMIT 15;

    -- TESTS
    ELSIF category = 'tests' THEN
        RETURN QUERY
        WITH recent_tests AS (
            SELECT t->>'name' as name, t->>'notes' as notes
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.tests) AS t
            WHERE p.doctor_id = doc_id
            AND t->>'name' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100
        )
        SELECT 
            name::TEXT as label,
            COALESCE(notes, '')::TEXT as subtext,
            COUNT(*)::BIGINT as usage_count,
            NULL::JSONB as payload
        FROM recent_tests
        GROUP BY name, notes
        ORDER BY usage_count DESC
        LIMIT 15;

    -- ADVICE
    ELSIF category = 'advice' THEN
        RETURN QUERY
        WITH recent_advice AS (
            SELECT trim(unnest(string_to_array(advice, E'\n'))) as item
            FROM prescriptions
            WHERE doctor_id = doc_id
            AND advice ILIKE '%' || search_term || '%'
            ORDER BY created_at DESC
            LIMIT 50
        )
        SELECT 
            item::TEXT as label,
            'Advice'::TEXT as subtext,
            COUNT(*)::BIGINT as usage_count,
            NULL::JSONB as payload
        FROM recent_advice
        WHERE length(item) > 2
        AND item ILIKE search_term || '%'
        GROUP BY item
        ORDER BY usage_count DESC
        LIMIT 15;
        
    END IF;
END;
$$;
