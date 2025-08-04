#!/bin/bash

# Get Supabase credentials from environment variables
SUPABASE_URL="lglquyksommwynrhmkvz.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"

# List of migration files in order
MIGRATIONS=(
  "01-create-tables.sql"
  "02-seed-data.sql"
  "03-add-verification-fields.sql"
  "04-add-rls-policies.sql"
  "04-add-scheduling-tables-fixed.sql"
  "04-fix-blood-banks-table.sql"
  "05-add-real-time-tables.sql"
  "05-fix-verification-columns.sql"
  "06-fix-database-schema.sql"
  "07-test-schema.sql"
  "08-simplified-rls-policies.sql"
  "09-final-fix.sql"
  "10-complete-schema-setup.sql"
  "11-phase3-schema.sql"
  "12-phase4-schema.sql"
  "13-enhanced-rbac-schema.sql"
  "13-fix-phase4-constraints.sql"
  "14-enhanced-blood-requests.sql"
  "15-fix-user-creation.sql"
  "16-fix-users-table.sql"
  "17-fix-institutions-table.sql"
)

# Run each migration
for migration in "${MIGRATIONS[@]}"; do
  echo "Running migration: $migration"
  psql -h $SUPABASE_URL -p $SUPABASE_PORT -d $SUPABASE_DB -U $SUPABASE_USER -f "$migration"
done 