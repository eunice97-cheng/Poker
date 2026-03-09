-- Atomic chip deduction (buy-in)
CREATE OR REPLACE FUNCTION deduct_chips(
  p_player_id UUID,
  p_table_id  UUID,
  p_amount    INT
) RETURNS BIGINT AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  UPDATE profiles
  SET chip_balance = chip_balance - p_amount
  WHERE id = p_player_id AND chip_balance >= p_amount
  RETURNING chip_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient chips or player not found';
  END IF;

  INSERT INTO transactions (player_id, table_id, type, amount, balance_after)
  VALUES (p_player_id, p_table_id, 'buyin', -p_amount, new_balance);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic chip addition (cashout / win)
CREATE OR REPLACE FUNCTION add_chips(
  p_player_id UUID,
  p_table_id  UUID,
  p_amount    INT,
  p_type      TEXT DEFAULT 'cashout'
) RETURNS BIGINT AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  UPDATE profiles
  SET chip_balance = chip_balance + p_amount
  WHERE id = p_player_id
  RETURNING chip_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  INSERT INTO transactions (player_id, table_id, type, amount, balance_after)
  VALUES (p_player_id, p_table_id, p_type, p_amount, new_balance);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment games_played for multiple players at once
CREATE OR REPLACE FUNCTION increment_games_played(player_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET games_played = games_played + 1
  WHERE id = ANY(player_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment games_won for winners
CREATE OR REPLACE FUNCTION increment_games_won(player_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET games_won = games_won + 1
  WHERE id = ANY(player_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
