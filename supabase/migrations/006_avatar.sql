-- Add avatar field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT 'avatar_1';

-- Allow users to update their own avatar and username
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
