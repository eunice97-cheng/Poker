-- Extend transaction types for supporter chip redemptions.
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('buyin', 'cashout', 'win', 'loss', 'refund', 'starting_bonus', 'kofi_redeem'));

-- Track upstream webhook identity so retries do not mint duplicate codes.
ALTER TABLE chip_codes
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'kofi',
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'donation',
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS external_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS chip_codes_external_event_id_key
  ON chip_codes (external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Redeem a chip code and credit the player in one database transaction.
CREATE OR REPLACE FUNCTION redeem_chip_code(
  p_code TEXT,
  p_player_id UUID
) RETURNS TABLE (chips INT, new_balance BIGINT) AS $$
DECLARE
  v_code chip_codes%ROWTYPE;
BEGIN
  UPDATE chip_codes
  SET is_redeemed = TRUE,
      redeemed_by = p_player_id,
      redeemed_at = NOW()
  WHERE code = UPPER(TRIM(p_code))
    AND is_redeemed = FALSE
  RETURNING * INTO v_code;

  IF NOT FOUND THEN
    SELECT * INTO v_code
    FROM chip_codes
    WHERE code = UPPER(TRIM(p_code));

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid redemption code.';
    END IF;

    RAISE EXCEPTION 'This code has already been used.';
  END IF;

  UPDATE profiles
  SET chip_balance = chip_balance + v_code.chips_amount
  WHERE id = p_player_id
  RETURNING chip_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Player not found.';
  END IF;

  INSERT INTO transactions (player_id, table_id, type, amount, balance_after, note)
  VALUES (p_player_id, NULL, 'kofi_redeem', v_code.chips_amount, new_balance, v_code.code);

  chips := v_code.chips_amount;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
