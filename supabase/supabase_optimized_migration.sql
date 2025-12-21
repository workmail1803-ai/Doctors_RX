-- OPTIMIZED MIGRATION v3 (User-improved, production-ready)
-- Run this file to set up efficient suggestion + protocol functions

-- ============================================
-- STEP 1: DROP OLD FUNCTIONS (prevents return-type conflicts)
-- ============================================
DROP FUNCTION IF EXISTS get_suggestions(uuid, text, text);
DROP FUNCTION IF EXISTS get_protocol_matches(uuid, text[]);

-- ============================================
-- STEP 2: PERFORMANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_prescriptions_doc_created 
ON prescriptions(doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_meds_gin 
ON prescriptions USING GIN (meds);

CREATE INDEX IF NOT EXISTS idx_prescriptions_diseases_gin 
ON prescriptions USING GIN (diseases);

-- ============================================
-- STEP 3: OPTIMIZED SUGGESTIONS FUNCTION
-- ============================================
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
    IF length(search_term) < 2 THEN
        RETURN;
    END IF;

    IF category = 'medicines' THEN
        RETURN QUERY
        WITH recent_meds AS (
            SELECT m
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.meds) AS m
            WHERE p.doctor_id = doc_id
            AND p.created_at > (now() - interval '6 months')
            AND m->>'brand' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100
        )
        SELECT 
            (m->>'brand')::TEXT,
            COALESCE(m->>'dosage', '')::TEXT,
            COUNT(*)::BIGINT as usage_count,
            jsonb_build_object('dosage', m->>'dosage', 'freq', m->>'freq', 'duration', m->>'duration')
        FROM recent_meds
        GROUP BY m->>'brand', m->>'dosage', m->>'freq', m->>'duration'
        ORDER BY usage_count DESC
        LIMIT 15;

    ELSIF category = 'diseases' THEN
        RETURN QUERY
        WITH recent_diseases AS (
            SELECT d->>'name' as name
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.diseases) AS d
            WHERE p.doctor_id = doc_id
            AND p.created_at > (now() - interval '1 year')
            AND d->>'name' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100
        )
        SELECT name::TEXT, 'Previously used'::TEXT, COUNT(*)::BIGINT, NULL::JSONB
        FROM recent_diseases
        GROUP BY name
        ORDER BY COUNT(*) DESC
        LIMIT 15;

    ELSIF category = 'tests' THEN
        RETURN QUERY
        WITH recent_tests AS (
            SELECT t->>'name' as name, t->>'notes' as notes
            FROM prescriptions p,
                 LATERAL jsonb_array_elements(p.tests) AS t
            WHERE p.doctor_id = doc_id
            AND p.created_at > (now() - interval '1 year')
            AND t->>'name' ILIKE search_term || '%'
            ORDER BY p.created_at DESC
            LIMIT 100
        )
        SELECT name::TEXT, COALESCE(notes, '')::TEXT, COUNT(*)::BIGINT, NULL::JSONB
        FROM recent_tests
        GROUP BY name, notes
        ORDER BY COUNT(*) DESC
        LIMIT 15;

    ELSIF category = 'advice' THEN
        RETURN QUERY
        WITH recent_advice AS (
            SELECT trim(unnest(string_to_array(advice, E'\n'))) as item
            FROM prescriptions
            WHERE doctor_id = doc_id
            AND created_at > (now() - interval '6 months')
            AND advice ILIKE '%' || search_term || '%'
            ORDER BY created_at DESC
            LIMIT 50
        )
        SELECT item::TEXT, 'Advice'::TEXT, COUNT(*)::BIGINT, NULL::JSONB
        FROM recent_advice
        WHERE length(item) > 2 AND item ILIKE search_term || '%'
        GROUP BY item
        ORDER BY COUNT(*) DESC
        LIMIT 15;
    END IF;
END;
$$;

-- ============================================
-- STEP 4: OPTIMIZED PROTOCOL MATCHES FUNCTION
-- ============================================
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
    query_jsonb JSONB;
BEGIN
    IF array_length(query_diseases, 1) IS NULL THEN RETURN; END IF;

    SELECT jsonb_agg(jsonb_build_object('name', d)) 
    INTO query_jsonb 
    FROM unnest(query_diseases) d;

    -- Exact Match (GIN Index)
    RETURN QUERY
    SELECT 'exact'::TEXT, query_diseases, p.meds, p.tests, p.advice
    FROM prescriptions p
    WHERE p.doctor_id = doc_id
    AND p.created_at > (now() - interval '2 years')
    AND p.diseases @> query_jsonb
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Partial Match (Fallback)
    RETURN QUERY
    SELECT 'partial'::TEXT, ARRAY[query_diseases[1]]::TEXT[], p.meds, p.tests, p.advice
    FROM prescriptions p
    WHERE p.doctor_id = doc_id
    AND p.created_at > (now() - interval '1 year')
    AND p.diseases @> jsonb_build_array(jsonb_build_object('name', query_diseases[1]))
    ORDER BY p.created_at DESC
    LIMIT 1;
END;
$$;
