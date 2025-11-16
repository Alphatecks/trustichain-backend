#!/bin/bash

# Script to link Supabase project and push database migrations
# Usage: ./scripts/deploy-db.sh

echo "🚀 TrustiChain Database Deployment"
echo "=================================="
echo ""

# Check if project ref is provided
if [ -z "$SUPABASE_PROJECT_REF" ]; then
  echo "❌ SUPABASE_PROJECT_REF environment variable is not set."
  echo ""
  echo "To link your Supabase project, you need:"
  echo "1. Your Project Reference ID (find it in your Supabase dashboard URL)"
  echo "2. Your database password"
  echo ""
  echo "You can link by running:"
  echo "  supabase link --project-ref YOUR_PROJECT_REF"
  echo ""
  echo "Or set the environment variable:"
  echo "  export SUPABASE_PROJECT_REF=your-project-ref"
  echo ""
  read -p "Enter your Supabase Project Reference ID: " project_ref
  
  if [ -z "$project_ref" ]; then
    echo "❌ Project reference is required. Exiting."
    exit 1
  fi
  
  SUPABASE_PROJECT_REF=$project_ref
fi

echo "📦 Linking to Supabase project: $SUPABASE_PROJECT_REF"
supabase link --project-ref "$SUPABASE_PROJECT_REF"

if [ $? -ne 0 ]; then
  echo "❌ Failed to link project. Please check your credentials."
  exit 1
fi

echo ""
echo "📤 Pushing database migrations..."
supabase db push

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database migrations pushed successfully!"
  echo "✅ Users table created in your Supabase database"
else
  echo ""
  echo "❌ Failed to push migrations. Please check the error above."
  exit 1
fi


