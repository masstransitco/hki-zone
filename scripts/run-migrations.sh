#!/bin/bash

# Load environment variables
source .env.cli

# Extract connection details from POSTGRES_URL
# Format: postgres://username:password@host:port/database
PGURL="postgres://postgres.egyuetfeubznhcvmtary:ZHrt2ilBHk0o3TA5@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"

echo "🚀 Running database migrations..."
echo "📍 Database: Supabase"

# Function to run SQL file
run_sql_file() {
    local filename=$1
    echo -e "\n📄 Running $filename..."
    psql "$PGURL" -f "migrations/$filename" 2>&1 | grep -E "(ERROR|NOTICE|SUCCESS|DETAIL|duplicate_count|status|remaining_duplicates)"
}

# Step 1: Investigate duplicates
echo -e "\n🔍 Step 1: Investigating duplicates..."
run_sql_file "investigate_duplicate.sql"

echo -e "\n⏸️  Review the results above. Press Enter to continue with cleanup..."
read

# Step 2: Clean up duplicates
echo -e "\n🧹 Step 2: Cleaning up duplicates..."
run_sql_file "cleanup_duplicate_languages.sql"

echo -e "\n⏸️  Review cleanup results. Press Enter to apply uniqueness constraint..."
read

# Step 3: Apply uniqueness constraint
echo -e "\n🔒 Step 3: Applying uniqueness constraint..."
run_sql_file "add_language_uniqueness_v2.sql"

echo -e "\n✅ Migrations complete!"