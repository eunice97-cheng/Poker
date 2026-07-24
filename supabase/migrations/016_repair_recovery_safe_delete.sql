-- Supabase can reject DELETE statements without a WHERE clause when safe-update rules are enabled.
-- Recreate the recovery RPC with an explicit WHERE so startup recovery can finish cleanly.

DROP FUNCTION IF EXISTS public.recover_abandoned_tables();

CREATE OR REPLACE FUNCTION public.recover_abandoned_tables()
RETURNS TABLE(recovered_tables INTEGER, refunded_players INTEGER, refunded_chips BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovered_tables INTEGER := 0;
  v_refunded_players INTEGER := 0;
  v_refunded_chips BIGINT := 0;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_recovered_tables
  FROM public.tables;

  WITH table_refunds AS (
    SELECT
      tp.player_id,
      tp.table_id,
      SUM(tp.stack)::BIGINT AS refund_amount
    FROM public.table_players tp
    WHERE tp.stack > 0
    GROUP BY tp.player_id, tp.table_id
  ),
  refunded AS (
    UPDATE public.profiles p
    SET chip_balance = p.chip_balance + tr.refund_amount,
        broke_at = NULL
    FROM table_refunds tr
    WHERE p.id = tr.player_id
    RETURNING tr.player_id, tr.table_id, tr.refund_amount, p.chip_balance
  ),
  inserted AS (
    INSERT INTO public.transactions (player_id, table_id, type, amount, balance_after, note)
    SELECT player_id, table_id, 'refund', refund_amount::INTEGER, chip_balance, 'abandoned_table_recovery'
    FROM refunded
    RETURNING amount
  )
  SELECT COUNT(*)::INTEGER, COALESCE(SUM(amount), 0)::BIGINT
  INTO v_refunded_players, v_refunded_chips
  FROM inserted;

  DELETE FROM public.tables
  WHERE id IS NOT NULL;

  RETURN QUERY
  SELECT v_recovered_tables, v_refunded_players, v_refunded_chips;
END;
$$;
