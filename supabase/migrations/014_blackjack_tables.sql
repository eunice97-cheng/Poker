-- Let the shared casino lobby separate poker rooms from blackjack rooms.
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'poker';

ALTER TABLE tables
  DROP CONSTRAINT IF EXISTS tables_game_type_check;

ALTER TABLE tables
  ADD CONSTRAINT tables_game_type_check
  CHECK (game_type IN ('poker', 'blackjack'));

CREATE INDEX IF NOT EXISTS tables_game_type_status_idx
  ON tables(game_type, status, created_at DESC);
