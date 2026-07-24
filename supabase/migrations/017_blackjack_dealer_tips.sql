-- Persistent blackjack dealer support totals.

CREATE TABLE IF NOT EXISTS public.blackjack_dealer_tips (
  dealer_id TEXT PRIMARY KEY CHECK (dealer_id ~ '^[a-z0-9_-]{1,40}$'),
  dealer_name TEXT NOT NULL,
  total_tips BIGINT NOT NULL DEFAULT 0 CHECK (total_tips >= 0),
  tip_count INTEGER NOT NULL DEFAULT 0 CHECK (tip_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blackjack_dealer_tips ENABLE ROW LEVEL SECURITY;

INSERT INTO public.blackjack_dealer_tips (dealer_id, dealer_name)
VALUES
  ('chloe', 'Chloe'),
  ('eunice', 'Eunice')
ON CONFLICT (dealer_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_blackjack_dealer_tip(
  p_dealer_id TEXT,
  p_dealer_name TEXT,
  p_amount INTEGER
)
RETURNS TABLE(dealer_id TEXT, dealer_name TEXT, total_tips BIGINT, tip_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id TEXT := lower(regexp_replace(coalesce(p_dealer_id, ''), '[^a-z0-9_-]', '', 'g'));
  v_dealer_name TEXT := nullif(trim(coalesce(p_dealer_name, '')), '');
  v_amount INTEGER := coalesce(p_amount, 0);
BEGIN
  IF v_dealer_id = '' THEN
    RAISE EXCEPTION 'Dealer id is required';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Tip amount must be positive';
  END IF;

  INSERT INTO public.blackjack_dealer_tips (dealer_id, dealer_name, total_tips, tip_count, updated_at)
  VALUES (
    v_dealer_id,
    coalesce(v_dealer_name, initcap(replace(v_dealer_id, '_', ' '))),
    v_amount,
    1,
    now()
  )
  ON CONFLICT (dealer_id) DO UPDATE
  SET dealer_name = coalesce(v_dealer_name, public.blackjack_dealer_tips.dealer_name),
      total_tips = public.blackjack_dealer_tips.total_tips + EXCLUDED.total_tips,
      tip_count = public.blackjack_dealer_tips.tip_count + 1,
      updated_at = now();

  RETURN QUERY
  SELECT bdt.dealer_id, bdt.dealer_name, bdt.total_tips, bdt.tip_count
  FROM public.blackjack_dealer_tips bdt
  ORDER BY bdt.total_tips DESC, bdt.dealer_name ASC;
END;
$$;
