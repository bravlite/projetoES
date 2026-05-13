-- Migration 009: Disputes, dispute_messages, admin_actions
-- Refs: PRD seção 9 (Fluxo de disputa), seção 6 (Estados)

-- ------------------------------------------------------------
-- Adiciona strikes a profiles de prestadores e clientes
-- ------------------------------------------------------------
ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS strikes INT NOT NULL DEFAULT 0;

ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS strikes INT NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- disputes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
  opened_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_id     UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  reason_code     TEXT NOT NULL CHECK (reason_code IN (
                    'service_incomplete',
                    'quality_issue',
                    'no_show',
                    'overcharge',
                    'damage',
                    'other'
                  )),
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                    'open',
                    'awaiting_provider',
                    'awaiting_admin',
                    'resolved'
                  )),
  decision        TEXT CHECK (decision IN (
                    'release_full',
                    'release_partial',
                    'refund_full',
                    'refund_partial'
                  )),
  resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT one_dispute_per_order UNIQUE (order_id)
);

-- Índices úteis para a fila admin
CREATE INDEX IF NOT EXISTS disputes_status_idx       ON disputes (status);
CREATE INDEX IF NOT EXISTS disputes_order_id_idx     ON disputes (order_id);
CREATE INDEX IF NOT EXISTS disputes_opened_by_idx    ON disputes (opened_by);
CREATE INDEX IF NOT EXISTS disputes_provider_id_idx  ON disputes (provider_id);

-- ------------------------------------------------------------
-- dispute_messages  (imutáveis — sem UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispute_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  author_role TEXT NOT NULL CHECK (author_role IN ('customer', 'provider', 'admin')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispute_messages_dispute_idx ON dispute_messages (dispute_id, created_at);

-- ------------------------------------------------------------
-- admin_actions  (audit trail)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL,  -- resolve_dispute, approve_provider, suspend_user, release_payout, …
  target_type TEXT NOT NULL,  -- request | user | dispute | payout | provider
  target_id   UUID NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_actions_actor_idx       ON admin_actions (actor_id);
CREATE INDEX IF NOT EXISTS admin_actions_target_idx      ON admin_actions (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_actions_action_type_idx ON admin_actions (action_type);

-- ------------------------------------------------------------
-- updated_at trigger para disputes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disputes_updated_at ON disputes;
CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE disputes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions     ENABLE ROW LEVEL SECURITY;

-- disputes: cliente dono ou prestador do pedido ou admin podem ler
CREATE POLICY "disputes_select" ON disputes FOR SELECT
  USING (
    opened_by = auth.uid()
    OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- disputes: apenas cliente dono do pedido pode criar (INSERT via server action)
CREATE POLICY "disputes_insert" ON disputes FOR INSERT
  WITH CHECK (opened_by = auth.uid());

-- disputes: apenas admin pode atualizar (status, decision, resolved_by, resolved_at)
CREATE POLICY "disputes_update" ON disputes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- dispute_messages: partes do pedido ou admin podem ler
CREATE POLICY "dispute_messages_select" ON dispute_messages FOR SELECT
  USING (
    dispute_id IN (
      SELECT id FROM disputes
      WHERE opened_by = auth.uid()
         OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- dispute_messages: partes ou admin podem inserir
CREATE POLICY "dispute_messages_insert" ON dispute_messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      dispute_id IN (
        SELECT id FROM disputes
        WHERE opened_by = auth.uid()
           OR provider_id IN (SELECT id FROM provider_profiles WHERE user_id = auth.uid())
      )
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- admin_actions: somente admin lê/insere
CREATE POLICY "admin_actions_select" ON admin_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_actions_insert" ON admin_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
