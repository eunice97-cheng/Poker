CREATE OR REPLACE FUNCTION recover_abandoned_tables()
RETURNS TABLE(recovered_tables INTEGER, refunded_players INTEGER, refunded_chips BIGINT) AS $$
DECLARE
  v_recovered_tables INTEGER := 0;
  v_refunded_players INTEGER := 0;
  v_refunded_chips BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO v_recovered_tables FROM tables;

  WITH table_refunds AS (
    SELECT
      tp.player_id,
      tp.table_id,
      SUM(tp.stack)::BIGINT AS refund_amount
    FROM table_players tp
    WHERE tp.stack > 0
    GROUP BY tp.player_id, tp.table_id
  ),
  refunded AS (
    UPDATE profiles p
    SET chip_balance = p.chip_balance + tr.refund_amount,
        broke_at = NULL
    FROM table_refunds tr
    WHERE p.id = tr.player_id
    RETURNING tr.player_id, tr.table_id, tr.refund_amount, p.chip_balance
  ),
  inserted AS (
    INSERT INTO transactions (player_id, table_id, type, amount, balance_after, note)
    SELECT player_id, table_id, 'refund', refund_amount, chip_balance, 'abandoned_table_recovery'
    FROM refunded
    RETURNING amount
  )
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_refunded_players, v_refunded_chips
  FROM inserted;

  DELETE FROM tables;

  RETURN QUERY
  SELECT v_recovered_tables, v_refunded_players, v_refunded_chips;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
