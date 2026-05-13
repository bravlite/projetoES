-- Migration 010: Avaliações pós-serviço
-- Refs: PRD Milestone 8 — Reputação / avaliações

-- ------------------------------------------------------------
-- service_reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 1 avaliação por pedido
  CONSTRAINT one_review_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS reviews_provider_id_idx ON service_reviews (provider_id);
CREATE INDEX IF NOT EXISTS reviews_reviewer_id_idx ON service_reviews (reviewer_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler (para exibir rating público)
CREATE POLICY "reviews_select" ON service_reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Só o autor insere
CREATE POLICY "reviews_insert" ON service_reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

-- Imutável — sem UPDATE/DELETE
