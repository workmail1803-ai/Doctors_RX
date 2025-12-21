-- EMERGENCY CLEANUP
-- Run this FIRST to stop any stuck queries

-- Kill any running queries on prescriptions (optional, may need superuser)
-- SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%prescriptions%';

-- Drop all custom functions
DROP FUNCTION IF EXISTS get_suggestions(uuid, text, text);
DROP FUNCTION IF EXISTS get_protocol_matches(uuid, text[]);

-- Drop indexes we created (these might be causing the crash during creation)
DROP INDEX IF EXISTS idx_prescriptions_doc_created;
DROP INDEX IF EXISTS idx_prescriptions_meds_gin;
DROP INDEX IF EXISTS idx_prescriptions_diseases_gin;

-- Done. Your base table is untouched.
