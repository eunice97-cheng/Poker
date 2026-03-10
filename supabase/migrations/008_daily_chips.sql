-- Migration 008: Daily chip recovery for broke players
-- When a player runs out of chips, they get 2,000 free chips after 24 hours.

-- Track when a player went broke
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS broke_at TIMESTAMPTZ DEFAULT NULL;

-- Mark a player as broke (only if they have 0 chips and aren't already marked)
CREATE OR REPLACE FUNCTION mark_player_broke(p_player_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET    broke_at = now()
  WHERE  id = p_player_id
    AND  chip_balance = 0
    AND  broke_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award 2,000 chips to players who have been broke for 24+ hours
-- Returns rows of (player_id, new_balance) for each player who received chips
CREATE OR REPLACE FUNCTION award_daily_chips()
RETURNS TABLE(player_id UUID, new_balance INTEGER) AS $$
BEGIN
  RETURN QUERY
  UPDATE profiles
  SET    chip_balance = chip_balance + 2000,
         broke_at     = NULL
  WHERE  chip_balance = 0
    AND  broke_at IS NOT NULL
    AND  broke_at <= now() - INTERVAL '24 hours'
  RETURNING id, chip_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify add_chips to also clear broke_at when chips are added
-- (In case a player gets chips via Ko-fi redemption before the 24h timer fires)
-- Must drop first because PostgreSQL won't allow changing a function's return type
DROP FUNCTION IF EXISTS add_chips(UUID, UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION add_chips(
  p_player_id UUID,
  p_table_id  UUID,
  p_amount    INTEGER,
  p_type      TEXT DEFAULT 'cashout'
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE profiles
  SET    chip_balance = chip_balance + p_amount,
         broke_at     = NULL
  WHERE  id = p_player_id
  RETURNING chip_balance INTO v_new_balance;

  INSERT INTO transactions (player_id, table_id, type, amount, balance_after)
  VALUES (p_player_id, p_table_id, p_type, p_amount, v_new_balance);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
