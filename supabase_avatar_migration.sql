-- Migration: Add Avatar URL and Storage
-- IDEMPOTENT SCRIPT

-- 1. Add avatar_url to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- 2. Create 'avatars' storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for Avatars

-- Allow Public View (So patients can see doctors)
DROP POLICY IF EXISTS "Public view avatars" ON storage.objects;
CREATE POLICY "Public view avatars" ON storage.objects
    FOR SELECT USING ( bucket_id = 'avatars' );

-- Allow Authenticated Users to Upload their own avatar
-- We enforce that the filename starts with their User ID
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 4. Update get_active_doctors RPC to return avatar_url
DROP FUNCTION IF EXISTS get_active_doctors();

CREATE OR REPLACE FUNCTION get_active_doctors()
RETURNS TABLE(id UUID, full_name TEXT, clinic_details JSONB, avatar_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.full_name, p.clinic_details, p.avatar_url
    FROM profiles p
    WHERE p.role = 'doctor';
END;
$$;
