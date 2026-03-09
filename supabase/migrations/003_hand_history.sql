-- Immutable record of every hand played
CREATE TABLE IF NOT EXISTS hand_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID REFERENCES tables(id) ON DELETE SET NULL,
  hand_number   INT NOT NULL,
  community     TEXT[] NOT NULL,          -- e.g., ['Ah','Kd','Qc','Js','Tc']
  pot_total     INT NOT NULL,
  winners       JSONB NOT NULL,           -- [{player_id, username, amount, hand_rank}]
  players       JSONB NOT NULL,           -- snapshot: [{player_id, username, hole_cards, stack_before, stack_after}]
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast profile history lookups
CREATE INDEX IF NOT EXISTS hand_history_table_idx ON hand_history(table_id);
CREATE INDEX IF NOT EXISTS hand_history_ended_at_idx ON hand_history(ended_at DESC);

-- Row Level Security
ALTER TABLE hand_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hand history viewable by authenticated users"
  ON hand_history FOR SELECT
  TO authenticated
  USING (true);
