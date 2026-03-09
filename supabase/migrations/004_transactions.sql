-- Chip movement audit trail
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  table_id       UUID REFERENCES tables(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('buyin', 'cashout', 'win', 'loss', 'refund', 'starting_bonus')),
  amount         INT NOT NULL,        -- positive = chips gained, negative = chips lost
  balance_after  BIGINT NOT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_player_idx ON transactions(player_id, created_at DESC);

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- Useful view: leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.username,
  p.chip_balance,
  p.games_played,
  p.games_won,
  CASE WHEN p.games_played > 0
    THEN ROUND((p.games_won::NUMERIC / p.games_played) * 100, 1)
    ELSE 0
  END AS win_rate
FROM profiles p
ORDER BY p.chip_balance DESC;

GRANT SELECT ON leaderboard TO authenticated;
