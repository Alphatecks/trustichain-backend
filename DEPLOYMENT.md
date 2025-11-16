# Database Deployment Guide

## Option 1: Using Supabase CLI (Recommended)

### Step 1: Link to Your Supabase Project

You need to link your local project to your remote Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your Project Reference ID:**
- Go to your Supabase Dashboard
- The project ref is in the URL: `https://app.supabase.com/project/YOUR_PROJECT_REF`
- Or find it in Project Settings > General

You'll be prompted for your database password (found in Project Settings > Database).

### Step 2: Push Database Migration

```bash
supabase db push
```

This will apply all migrations in the `supabase/migrations/` folder to your remote database.

### Alternative: Use the Deployment Script

```bash
./scripts/deploy-db.sh
```

The script will prompt you for your project reference if not set in environment variables.

---

## Option 2: Manual Deployment via Supabase Dashboard

If you prefer to run the SQL manually:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/001_create_users_table.sql`
5. Click **Run** to execute

---

## Option 3: Using Supabase CLI with Environment Variables

Set your project reference as an environment variable:

```bash
export SUPABASE_PROJECT_REF=your-project-ref
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase db push
```

---

## What Gets Deployed

The migration will create:

✅ **Users Table** with:
- `id` (UUID, references auth.users)
- `email` (unique)
- `full_name`
- `country`
- `created_at` and `updated_at` timestamps

✅ **Indexes** on email and country for faster queries

✅ **Row Level Security (RLS)** policies:
- Users can view their own profile
- Users can update their own profile

✅ **Automatic timestamp updates** via trigger

---

## Verify Deployment

After deployment, verify in Supabase Dashboard:

1. **Table Editor** → Should see `users` table
2. **Database** → Tables → `users` → Check structure
3. **Authentication** → Policies → Should see RLS policies

---

## Troubleshooting

**Error: "Cannot connect to Docker daemon"**
- This is for local development. For remote deployment, use `supabase link` and `supabase db push` (no Docker needed)

**Error: "Project not found"**
- Double-check your project reference ID
- Ensure you're logged in: `supabase login`

**Error: "Migration conflicts"**
- If migrations have already been applied, you may need to reset or manually adjust
- Check migration history in Supabase Dashboard


