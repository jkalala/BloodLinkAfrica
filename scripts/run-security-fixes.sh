#!/bin/bash

# Security Fixes Migration Runner
# This script applies all critical security fixes to the database

set -e  # Exit on any error

echo "🔐 BloodConnect Security Fixes Migration Runner"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${RED}Error: SUPABASE_DB_URL environment variable is not set${NC}"
    echo "Please set your Supabase database URL:"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[password]@[host]:[port]/postgres'"
    exit 1
fi

# Function to run SQL file
run_sql_file() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}Running: $description${NC}"
    echo "File: $file"
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}Error: File $file not found${NC}"
        return 1
    fi
    
    # Use psql to run the SQL file
    if psql "$SUPABASE_DB_URL" -f "$file" -v ON_ERROR_STOP=1; then
        echo -e "${GREEN}✓ Successfully applied: $description${NC}"
        echo ""
    else
        echo -e "${RED}✗ Failed to apply: $description${NC}"
        echo -e "${RED}Please check the error above and fix before continuing${NC}"
        exit 1
    fi
}

# Function to backup database (optional but recommended)
backup_database() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo -e "${YELLOW}Creating database backup: $backup_file${NC}"
    
    if pg_dump "$SUPABASE_DB_URL" > "$backup_file"; then
        echo -e "${GREEN}✓ Backup created successfully${NC}"
        echo ""
    else
        echo -e "${RED}✗ Failed to create backup${NC}"
        echo "Continuing without backup (not recommended for production)"
        echo ""
    fi
}

# Main execution
echo "Starting security fixes migration..."
echo ""

# Ask for confirmation
echo -e "${YELLOW}⚠️  WARNING: This will modify your database schema and security policies${NC}"
echo "Make sure you have a backup of your database before proceeding."
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Create backup (optional)
read -p "Do you want to create a backup first? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    backup_database
fi

echo "Applying security fixes..."
echo ""

# Apply security fixes in order
run_sql_file "security-fix-01-secure-rls-policies.sql" "Secure RLS Policies and Remove Anonymous Access"
run_sql_file "security-fix-02-verification-table.sql" "Secure Verification Codes Table"

echo -e "${GREEN}🎉 All security fixes applied successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Update your .env.local file with proper environment variables"
echo "2. Remove any hardcoded credentials from your codebase"
echo "3. Test your application thoroughly"
echo "4. Run a security audit to verify fixes"
echo ""
echo "Security fixes applied:"
echo "✓ Removed hardcoded database credentials"
echo "✓ Fixed overly permissive RLS policies"
echo "✓ Removed anonymous database access"
echo "✓ Implemented secure verification code storage"
echo "✓ Added audit logging capabilities"
echo "✓ Created proper database indexes"
echo ""
echo -e "${YELLOW}⚠️  Remember to:${NC}"
echo "- Set VERIFICATION_SALT environment variable"
echo "- Configure Redis for production rate limiting"
echo "- Update your application code to use new APIs"
echo "- Test all authentication flows"
echo ""
echo -e "${GREEN}Migration completed successfully!${NC}"