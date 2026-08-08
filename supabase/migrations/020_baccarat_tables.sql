-- Let Baccarat appear in the shared ASL Gaming Casino table registry.
ALTER TABLE tables
  DROP CONSTRAINT IF EXISTS tables_game_type_check;

ALTER TABLE tables
  ADD CONSTRAINT tables_game_type_check
  CHECK (game_type IN ('poker', 'blackjack', 'baccarat'));
