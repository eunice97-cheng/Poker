-- Keep profile bootstrap consistent with the avatar ids used by the app.
ALTER TABLE profiles ALTER COLUMN avatar SET DEFAULT 'avatar_m1';

UPDATE profiles
SET avatar = 'avatar_m1'
WHERE avatar = 'avatar_1';

-- Allow a signed-in player to create their own profile row if the auth trigger missed it.
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
