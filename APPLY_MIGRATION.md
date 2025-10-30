# Apply Avatar Storage Migration

## Option 1: Via Supabase CLI (Recommended)

```bash
# Apply migration
supabase db push

# Or if using link
supabase migration up
```

## Option 2: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Copy contents of `supabase/migrations/015_setup_avatar_storage.sql`
5. Paste and click "Run"

## Option 3: Via psql

```bash
psql $DATABASE_URL < supabase/migrations/015_setup_avatar_storage.sql
```

## Verify Migration

Run this query to check if everything was created:

```sql
-- Check if full_name column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'full_name';

-- Check if avatars bucket exists
SELECT * FROM storage.buckets WHERE id = 'avatars';

-- Check storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
```

## Test Avatar Upload

1. Go to: http://localhost:3000/dashboard/settings
2. Click on avatar or "Change Avatar" button
3. Select an image file (JPG, PNG, WEBP, or GIF, max 5MB)
4. Verify upload succeeds and avatar displays
5. Check browser localStorage for cache:
   - Open DevTools → Application → Local Storage
   - Look for key: `jello_user_profile`
   - Should contain profile data + timestamp

## Troubleshooting

### Error: "Bucket already exists"
The migration handles this with `ON CONFLICT DO UPDATE`, should work fine.

### Error: "Permission denied for storage"
Check RLS policies were created correctly. Re-run the policy creation part of migration.

### Cache not working
Clear localStorage and reload page. Check browser console for errors.
