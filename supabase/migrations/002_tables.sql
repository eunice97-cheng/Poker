-- Game tables (rooms players can join)
CREATE TABLE IF NOT EXISTS tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  host_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_players   INT NOT NULL DEFAULT 6 CHECK (max_players BETWEEN 2 AND 9),
  small_blind   INT NOT NULL DEFAULT 10,
  big_blind     INT NOT NULL DEFAULT 20,
  min_buyin     INT NOT NULL DEFAULT 500,
  max_buyin     INT NOT NULL DEFAULT 2000,
  status        TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  player_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Which players are sitting at which table
CREATE TABLE IF NOT EXISTS table_players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID REFERENCES tables(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  seat        INT NOT NULL CHECK (seat BETWEEN 0 AND 8),
  stack       INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sitting_out', 'busted')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(table_id, player_id),
  UNIQUE(table_id, seat)
);

-- Row Level Security
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tables are viewable by authenticated users"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Table players are viewable by authenticated users"
  ON table_players FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (game server) can write to these tables
-- The game server uses SUPABASE_SERVICE_KEY to bypass RLS
