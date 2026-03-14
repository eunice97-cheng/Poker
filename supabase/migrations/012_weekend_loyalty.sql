-- Migration 012: Weekend loyalty bonus for registered players.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_weekend_loyalty_claim_at TIMESTAMPTZ;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('buyin', 'cashout', 'win', 'loss', 'refund', 'starting_bonus', 'kofi_redeem', 'weekend_loyalty'));

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
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
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

  chips := 1000;
  next_claim_at := ((v_weekend_start + 7)::TIMESTAMP AT TIME ZONE 'UTC');
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
