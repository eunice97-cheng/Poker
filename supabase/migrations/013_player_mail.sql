-- Migration 013: In-browser player mail for rewards and system notices.
CREATE TABLE IF NOT EXISTS player_mail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'reward')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_mail_player_created_idx
  ON player_mail (player_id, created_at DESC);

ALTER TABLE player_mail ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON player_mail FROM anon;
REVOKE ALL ON player_mail FROM authenticated;
GRANT SELECT ON player_mail TO authenticated;
GRANT UPDATE (is_read, read_at) ON player_mail TO authenticated;

DROP POLICY IF EXISTS "Users can view their own mail" ON player_mail;
CREATE POLICY "Users can view their own mail"
  ON player_mail FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update their own mail" ON player_mail;
CREATE POLICY "Users can update their own mail"
  ON player_mail FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

CREATE OR REPLACE FUNCTION claim_weekend_loyalty_chips()
RETURNS TABLE(chips INT, new_balance BIGINT, claimed_at TIMESTAMPTZ, next_claim_at TIMESTAMPTZ) AS $$
DECLARE
  v_player_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_dow INT := EXTRACT(DOW FROM v_today_utc)::INT;
  v_weekend_start DATE;
  v_weekend_end DATE;
  v_existing_claim TIMESTAMPTZ;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT email_confirmed_at
  INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_player_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Weekend loyalty chips require a verified account.';
  END IF;

  IF v_dow NOT IN (0, 6) THEN
    RAISE EXCEPTION 'Weekend loyalty chips can only be claimed on Saturday or Sunday (UTC).';
  END IF;

  v_weekend_start := CASE
    WHEN v_dow = 6 THEN v_today_utc
    ELSE v_today_utc - 1
  END;
  v_weekend_end := v_weekend_start + 2;

  UPDATE profiles
  SET chip_balance = chip_balance + 1000,
      last_weekend_loyalty_claim_at = v_now
  WHERE id = v_player_id
    AND (
      last_weekend_loyalty_claim_at IS NULL
      OR (last_weekend_loyalty_claim_at AT TIME ZONE 'UTC') < v_weekend_start::TIMESTAMP
      OR (last_weekend_loyalty_claim_at AT TIME ZONE 'UTC') >= v_weekend_end::TIMESTAMP
    )
  RETURNING chip_balance, last_weekend_loyalty_claim_at
  INTO new_balance, claimed_at;

  IF NOT FOUND THEN
    SELECT last_weekend_loyalty_claim_at INTO v_existing_claim
    FROM profiles
    WHERE id = v_player_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Player not found';
    END IF;

    IF v_existing_claim IS NOT NULL
      AND (v_existing_claim AT TIME ZONE 'UTC') >= v_weekend_start::TIMESTAMP
      AND (v_existing_claim AT TIME ZONE 'UTC') < v_weekend_end::TIMESTAMP THEN
      RAISE EXCEPTION 'Weekend loyalty chips already claimed for this weekend.';
    END IF;

    RAISE EXCEPTION 'Unable to claim weekend loyalty chips.';
  END IF;

  INSERT INTO transactions (player_id, table_id, type, amount, balance_after, note)
  VALUES (v_player_id, NULL, 'weekend_loyalty', 1000, new_balance, 'weekly_loyalty_weekend_bonus');

  next_claim_at := ((v_weekend_start + 7)::TIMESTAMP AT TIME ZONE 'UTC');

  INSERT INTO player_mail (player_id, category, subject, body)
  VALUES (
    v_player_id,
    'reward',
    'Weekend loyalty bonus received',
    FORMAT(
      'Your weekend loyalty reward of 1000 chips has been added to your balance. Your new balance is %s chips. Your next claim opens %s UTC.',
      new_balance,
      TO_CHAR(next_claim_at AT TIME ZONE 'UTC', 'FMDay, FMMonth DD, YYYY "at" HH12:MI AM')
    )
  );

  chips := 1000;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION claim_weekend_loyalty_chips() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_weekend_loyalty_chips() TO authenticated;
