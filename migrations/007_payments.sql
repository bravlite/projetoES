-- migration 007: payments, payouts, commissions, financial_events
-- Depende de: 002 (profiles), 003 (customer_profiles), 004 (provider_profiles), 006 (service_requests)

-- ─── customer_profiles: coluna para cache do cliente Asaas ──────────────────
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- ─── payments ────────────────────────────────────────────────────────────────
-- Registra cada cobrança Pix gerada pelo PSP.
CREATE TABLE IF NOT EXISTS payments (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID         NOT NULL REFERENCES service_requests(id),
  customer_id        UUID         NOT NULL REFERENCES profiles(id),
  amount_cents       INT          NOT NULL CHECK (amount_cents > 0),
  psp_provider       TEXT         NOT NULL DEFAULT 'asaas',
  psp_charge_id      TEXT         UNIQUE,                       -- ID da cobrança no PSP (idempotência)
  psp_pix_qr         TEXT,                                      -- base64 do QR Code
  psp_pix_copy_paste TEXT,                                      -- copia-e-cola Pix
  status             TEXT         NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'expired', 'refunded')),
  paid_at            TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  webhook_payload    JSONB,                                      -- último payload recebido do PSP
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx    ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON payments (customer_id);
CREATE INDEX IF NOT EXISTS payments_status_idx      ON payments (status);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Clientes veem apenas seus próprios pagamentos
CREATE POLICY payments_select_customer ON payments
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- ─── payouts ─────────────────────────────────────────────────────────────────
-- Controla o repasse a ser feito para o prestador após conclusão do serviço.
CREATE TABLE IF NOT EXISTS payouts (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID          NOT NULL REFERENCES service_requests(id),
  provider_id          UUID          NOT NULL REFERENCES provider_profiles(id),
  payment_id           UUID          NOT NULL REFERENCES payments(id),
  gross_cents          INT           NOT NULL CHECK (gross_cents > 0),
  commission_cents     INT           NOT NULL CHECK (commission_cents >= 0),
  net_cents            INT           NOT NULL CHECK (net_cents >= 0),
  commission_rate      NUMERIC(5,4)  NOT NULL,
  min_commission_cents INT           NOT NULL DEFAULT 1000,
  status               TEXT          NOT NULL DEFAULT 'pending'
                         CHECK (status IN (
                           'pending', 'holding', 'eligible', 'paid',
                           'blocked', 'refunded_to_customer'
                         )),
  eligible_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  method               TEXT          CHECK (method IN ('manual_pix', 'split_pix')),
  confirmation_id      TEXT,                                       -- ID do Pix de saída
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payouts_order_id_idx    ON payouts (order_id);
CREATE INDEX IF NOT EXISTS payouts_provider_id_idx ON payouts (provider_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx      ON payouts (status);
CREATE INDEX IF NOT EXISTS payouts_payment_id_idx  ON payouts (payment_id);

CREATE TRIGGER payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Prestadores veem apenas seus próprios payouts
CREATE POLICY payouts_select_provider ON payouts
  FOR SELECT TO authenticated
  USING (
    provider_id IN (
      SELECT id FROM provider_profiles WHERE user_id = auth.uid()
    )
  );

-- ─── commissions ─────────────────────────────────────────────────────────────
-- Configuração histórica de comissão. Nova linha por mudança de taxa.
-- NULL em category_slug = padrão para todas as categorias.
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug   TEXT,
  rate            NUMERIC(5,4)  NOT NULL DEFAULT 0.15,
  min_cents       INT           NOT NULL DEFAULT 1000,  -- comissão mínima (R$10)
  effective_from  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler a comissão vigente
CREATE POLICY commissions_select_all ON commissions
  FOR SELECT TO authenticated USING (true);

-- Taxa padrão: 15%, mínimo R$10
INSERT INTO commissions (rate, min_cents)
  SELECT 0.15, 1000
  WHERE NOT EXISTS (SELECT 1 FROM commissions);

-- ─── financial_events ────────────────────────────────────────────────────────
-- Audit trail imutável de todos os eventos financeiros. Nunca deletar.
CREATE TABLE IF NOT EXISTS financial_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT         NOT NULL,
  order_id     UUID         REFERENCES service_requests(id),
  payment_id   UUID         REFERENCES payments(id),
  payout_id    UUID         REFERENCES payouts(id),
  actor_id     UUID         REFERENCES profiles(id),
  amount_cents INT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_events_order_id_idx   ON financial_events (order_id);
CREATE INDEX IF NOT EXISTS financial_events_payment_id_idx ON financial_events (payment_id);
CREATE INDEX IF NOT EXISTS financial_events_type_idx       ON financial_events (event_type);
CREATE INDEX IF NOT EXISTS financial_events_created_idx    ON financial_events (created_at DESC);

ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;
-- financial_events: sem policy pública — acesso somente via service_role (admin/webhook)
