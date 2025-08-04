-- Fix Phase 4 Schema Constraints
-- Add missing unique constraint for WhatsApp templates

-- Add unique constraint for template_name and language combination
ALTER TABLE whatsapp_templates 
ADD CONSTRAINT whatsapp_templates_template_name_language_unique 
UNIQUE (template_name, language);

-- Verify the constraint was added
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'whatsapp_templates' 
    AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.constraint_name; 