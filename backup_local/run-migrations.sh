#!/bin/bash

# Script to run all Perplexity database migrations
# Make sure DATABASE_URL is set in your environment

echo "🚀 Running Perplexity Database Migrations"
echo "========================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "   Please set it using: export DATABASE_URL='your-supabase-connection-string'"
    exit 1
fi

echo "✅ DATABASE_URL found"
echo ""

# Run migrations in order
echo "1️⃣ Creating image history tracking table..."
psql $DATABASE_URL -f scripts/add-perplexity-image-tracking.sql
if [ $? -eq 0 ]; then
    echo "✅ Image history table created successfully"
else
    echo "⚠️  Image history table creation failed (may already exist)"
fi

echo ""
echo "2️⃣ Adding enhanced content fields..."
psql $DATABASE_URL -f scripts/add-enhanced-perplexity-fields.sql
if [ $? -eq 0 ]; then
    echo "✅ Enhanced fields added successfully"
else
    echo "⚠️  Enhanced fields migration failed (may already exist)"
fi

echo ""
echo "3️⃣ Adding contextual enrichment fields..."
psql $DATABASE_URL -f scripts/add-contextual-enrichment-fields.sql
if [ $? -eq 0 ]; then
    echo "✅ Contextual enrichment fields added successfully"
else
    echo "⚠️  Contextual enrichment fields migration failed (may already exist)"
fi

echo ""
echo "✅ All migrations completed!"
echo ""
echo "To verify the tables, run:"
echo "psql $DATABASE_URL -c '\dt perplexity*'"