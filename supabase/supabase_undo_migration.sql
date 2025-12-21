-- UNDO MIGRATION: Drop the functions that were just created
-- Run this in Supabase SQL Editor to revert

DROP FUNCTION IF EXISTS get_suggestions(uuid, text, text);
DROP FUNCTION IF EXISTS get_protocol_matches(uuid, text[]);

-- That's it. Your tables and policies remain untouched.
