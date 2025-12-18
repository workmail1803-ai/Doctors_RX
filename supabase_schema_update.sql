-- Add layout_config column to prescription_templates
alter table prescription_templates 
add column if not exists layout_config jsonb default '{}'::jsonb;

-- Comment: This column stores X/Y offsets for print layout sections
-- Format: { "section_name": { "x": 0, "y": 0, "visible": true } }
