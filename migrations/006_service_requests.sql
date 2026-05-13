-- 006_service_requests.sql
-- Tabelas centrais do fluxo de serviço:
--   service_requests  — o pedido do cliente
--   service_quotes    — orçamentos dos prestadores
--   service_order_events — audit trail imutável
--
-- Status usa TEXT + CHECK (não ENUM) para facilitar migrações futuras.
-- Endereço denormalizado em service_requests (sem FK para addresses MVP).
-- category_slug referencia lib/constants.ts (sem FK — flexível para seed futuro).

-- -----------------------------------------------------------------------
-- service_requests
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_slug         text        NOT NULL,
  description           text        NOT NULL,

  -- Endereço denormalizado (neighborhood sempre preenchido; street/number opcionais no MVP)
  neighborhood          text        NOT NULL,
  city                  text        NOT NULL DEFAULT 'Vitória',
  street                text,
  number                text,
  complement            text,

  desired_date          date,
  desired_period        text        NOT NULL DEFAULT 'anytime'
                          CHECK (desired_period IN ('morning','afternoon','evening','anytime')),
  urgency               text        NOT NULL DEFAULT 'flexible'
                          CHECK (urgency IN ('today','tomorrow','this_week','flexible')),

  status                text        NOT NULL DEFAULT 'requested'
                          CHECK (status IN (
                            'draft','requested','quoted','quote_accepted',
                            'awaiting_payment','payment_confirmed',
                            'checked_in','in_progress','completed_by_provider',
                            'accepted_by_customer','auto_accepted','disputed',
                            'payout_released','cancelled','refunded','expired',
                            'blocked_for_review'
                          )),

  current_provider_id   uuid        REFERENCES provider_profiles(id) ON DELETE SET NULL,
  accepted_quote_id     uuid,                  -- FK adicionada abaixo (circular)
  final_value_cents     integer,
  check_in_code         text,
  check_in_code_used_at timestamptz,
  expires_at            timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER service_requests_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------------
-- service_quotes
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_quotes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        uuid        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_id       uuid        NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  value_cents       integer     NOT NULL CHECK (value_cents > 0),
  estimated_minutes integer,
  notes             text,
  status            text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','rejected','expired')),
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- 1 orçamento por prestador por pedido
  UNIQUE(request_id, provider_id)
);

CREATE TRIGGER service_quotes_updated_at
  BEFORE UPDATE ON service_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK circular service_requests → service_quotes
ALTER TABLE service_requests
  ADD CONSTRAINT IF NOT EXISTS fk_accepted_quote
  FOREIGN KEY (accepted_quote_id) REFERENCES service_quotes(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------
-- service_order_events  (audit trail — nunca deletar)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_order_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  from_status text,
  to_status   text        NOT NULL,
  actor_id    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role  text,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sr_customer_created_idx
  ON service_requests(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sr_status_idx
  ON service_requests(status);

CREATE INDEX IF NOT EXISTS sr_category_status_idx
  ON service_requests(category_slug, status);

CREATE INDEX IF NOT EXISTS sr_neighborhood_category_status_idx
  ON service_requests(neighborhood, category_slug, status);

CREATE INDEX IF NOT EXISTS sq_request_idx
  ON service_quotes(request_id);

CREATE INDEX IF NOT EXISTS sq_provider_idx
  ON service_quotes(provider_id);

CREATE INDEX IF NOT EXISTS soe_request_created_idx
  ON service_order_events(request_id, created_at);

-- -----------------------------------------------------------------------
-- RLS — service_requests
-- -----------------------------------------------------------------------
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Cliente vê seus próprios pedidos
CREATE POLICY "sr_select_customer" ON service_requests
  FOR SELECT USING (auth.uid() = customer_id);

-- Prestador aprovado vê pedidos em status 'requested' (filter área/cat na app)
CREATE POLICY "sr_select_provider_open" ON service_requests
  FOR SELECT USING (
    status = 'requested'
    AND EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.approved = true
    )
  );

-- Prestador vê pedidos onde já está atribuído
CREATE POLICY "sr_select_provider_assigned" ON service_requests
  FOR SELECT USING (
    current_provider_id IN (
      SELECT id FROM provider_profiles WHERE user_id = auth.uid()
    )
  );

-- Prestador vê pedidos onde enviou orçamento (inclui status 'quoted' antes de ser atribuído)
CREATE POLICY "sr_select_provider_quoted" ON service_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM service_quotes sq
      WHERE sq.request_id = service_requests.id
        AND sq.provider_id IN (
          SELECT id FROM provider_profiles WHERE user_id = auth.uid()
        )
    )
  );

-- Admin vê tudo
CREATE POLICY "sr_select_admin" ON service_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cliente cria pedido próprio
CREATE POLICY "sr_insert_customer" ON service_requests
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Cliente atualiza pedido próprio (cancelar, etc.)
CREATE POLICY "sr_update_customer" ON service_requests
  FOR UPDATE USING (auth.uid() = customer_id);

-- Admin atualiza qualquer pedido
CREATE POLICY "sr_update_admin" ON service_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- -----------------------------------------------------------------------
-- RLS — service_quotes
-- -----------------------------------------------------------------------
ALTER TABLE service_quotes ENABLE ROW LEVEL SECURITY;

-- Cliente vê orçamentos dos seus pedidos
CREATE POLICY "sq_select_customer" ON service_quotes
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM service_requests WHERE customer_id = auth.uid()
    )
  );

-- Prestador vê seus próprios orçamentos
CREATE POLICY "sq_select_provider" ON service_quotes
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM provider_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin vê todos
CREATE POLICY "sq_select_admin" ON service_quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Prestador aprovado insere orçamento em pedido 'requested' ou 'quoted'
CREATE POLICY "sq_insert_provider" ON service_quotes
  FOR INSERT WITH CHECK (
    provider_id IN (
      SELECT id FROM provider_profiles WHERE user_id = auth.uid() AND approved = true
    )
    AND request_id IN (
      SELECT id FROM service_requests WHERE status IN ('requested', 'quoted')
    )
  );

-- -----------------------------------------------------------------------
-- RLS — service_order_events
-- -----------------------------------------------------------------------
ALTER TABLE service_order_events ENABLE ROW LEVEL SECURITY;

-- Partes do pedido veem eventos
CREATE POLICY "soe_select" ON service_order_events
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM service_requests WHERE customer_id = auth.uid()
      UNION
      SELECT id FROM service_requests WHERE current_provider_id IN (
        SELECT id FROM provider_profiles WHERE user_id = auth.uid()
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inserção controlada pelo servidor (admin client bypass RLS)
-- Nenhuma política de INSERT aqui — apenas admin client grava eventos
