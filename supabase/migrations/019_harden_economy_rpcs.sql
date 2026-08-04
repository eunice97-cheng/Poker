-- Harden economy/stat RPCs so only the trusted game server can execute them.
-- Normal authenticated users must not be able to move chips or mutate stats via direct Supabase RPC.

DROP FUNCTION IF EXISTS public.add_chips(UUID, UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.add_chips(
  p_player_id UUID,
  p_table_id UUID,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'cashout'
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Chip amount must be positive';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('cashout', 'win', 'refund', 'starting_bonus', 'kofi_redeem', 'weekend_loyalty') THEN
    RAISE EXCEPTION 'Invalid chip transaction type';
  END IF;

  UPDATE public.profiles
  SET chip_balance = chip_balance + p_amount,
      broke_at = NULL
  WHERE id = p_player_id
  RETURNING chip_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  INSERT INTO public.transactions (player_id, table_id, type, amount, balance_after)
  VALUES (p_player_id, p_table_id, p_type, p_amount, v_new_balance);

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_chips(
  p_player_id UUID,
  p_table_id UUID,
  p_amount INTEGER
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Chip amount must be positive';
  END IF;

  UPDATE public.profiles
  SET chip_balance = chip_balance - p_amount
  WHERE id = p_player_id
    AND chip_balance >= p_amount
  RETURNING chip_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient chips or player not found';
  END IF;

  INSERT INTO public.transactions (player_id, table_id, type, amount, balance_after)
  VALUES (p_player_id, p_table_id, 'buyin', -p_amount, v_new_balance);

  RETURN v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_games_played(player_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF player_ids IS NULL OR array_length(player_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET games_played = games_played + 1
  WHERE id = ANY(player_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_games_won(player_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF player_ids IS NULL OR array_length(player_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET games_won = games_won + 1
  WHERE id = ANY(player_ids);
END;
$$;

DROP FUNCTION IF EXISTS public.recover_abandoned_tables();

CREATE OR REPLACE FUNCTION public.recover_abandoned_tables(
  p_older_than INTERVAL DEFAULT INTERVAL '6 hours'
) RETURNS TABLE(recovered_tables INTEGER, refunded_players INTEGER, refunded_chips BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovered_tables INTEGER := 0;
BEGIN
  -- This RPC is intentionally limited to empty stale table rows. Without a live-server
  -- heartbeat, the database cannot prove a table with players is truly abandoned.
  WITH stale_tables AS (
    DELETE FROM public.tables
    WHERE player_count = 0
      AND created_at < now() - p_older_than
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_recovered_tables
  FROM stale_tables;

  RETURN QUERY
  SELECT v_recovered_tables, 0::INTEGER, 0::BIGINT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_chips(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_chips(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_games_played(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_games_won(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_player_broke(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_daily_chips() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recover_abandoned_tables(INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_chip_code(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_blackjack_dealer_tip(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_chips(UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_chips(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_games_played(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_games_won(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_player_broke(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_daily_chips() TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_abandoned_tables(INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_chip_code(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_blackjack_dealer_tip(TEXT, TEXT, INTEGER) TO service_role;
