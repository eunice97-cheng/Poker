-- Chip redemption codes (generated server-side when a Ko-fi payment is received)
CREATE TABLE IF NOT EXISTS chip_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,          -- e.g. "CHIP-A1B2-C3D4"
  chips_amount  INTEGER NOT NULL,
  usd_amount    NUMERIC(10,2) NOT NULL,
  buyer_email   TEXT,                          -- Ko-fi buyer email
  is_redeemed   BOOLEAN NOT NULL DEFAULT FALSE,
  redeemed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the server (service key) can insert/update codes — players can only redeem via API
ALTER TABLE chip_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access; all operations go through the server with service key
CREATE POLICY "No client access" ON chip_codes FOR ALL USING (false);
