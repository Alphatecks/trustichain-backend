/**
 * Setup Script for Supabase Storage Bucket
 * 
 * This script creates the 'dispute-evidence' bucket in Supabase Storage
 * if it doesn't already exist.
 * 
 * Run with: npx tsx scripts/setup-storage-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BUCKET_NAME = 'dispute-evidence';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
];

async function setupBucket() {
  try {
    console.log('Checking for existing buckets...');

    // List existing buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      throw listError;
    }

    // Check if bucket already exists
    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (bucketExists) {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists.`);
      return;
    }

    console.log(`Creating bucket '${BUCKET_NAME}'...`);

    // Create the bucket
    const { data, error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false, // Private bucket - files accessible via signed URLs
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      throw createError;
    }

    console.log(`✅ Successfully created bucket '${BUCKET_NAME}'.`);
    console.log('\nBucket Configuration:');
    console.log(`  - Name: ${BUCKET_NAME}`);
    console.log(`  - Public: false (private bucket)`);
    console.log(`  - Max File Size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    console.log(`  - Allowed MIME Types: ${ALLOWED_MIME_TYPES.length} types`);
    console.log('\nNote: You may need to set up RLS policies in Supabase Dashboard for file access control.');
  } catch (error) {
    console.error('Failed to setup storage bucket:', error);
    process.exit(1);
  }
}

// Run the setup
setupBucket()
  .then(() => {
    console.log('\n✅ Storage bucket setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });

