-- migration 008: evidências de serviço e controle de tentativas de check-in
-- Depende de: 002 (profiles), 004 (provider_profiles), 006 (service_requests)

-- ─── service_evidence ────────────────────────────────────────────────────────
-- Fotos e evidências enviadas pelo prestador durante a execução do serviço.
-- Nunca deletar — disputas dependem desses registros.
CREATE TABLE IF NOT EXISTS service_evidence (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID         NOT NULL REFERENCES service_requests(id),
  provider_id UUID         NOT NULL REFERENCES provider_profiles(id),
  kind        TEXT         NOT NULL CHECK (kind IN ('before', 'during', 'after')),
  file_path   TEXT         NOT NULL,   -- path no Supabase Storage bucket 'evidence'
  notes       TEXT,
  client_ip   INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_request_id_idx  ON service_evidence (request_id);
CREATE INDEX IF NOT EXISTS evidence_provider_id_idx ON service_evidence (provider_id);
CREATE INDEX IF NOT EXISTS evidence_kind_idx        ON service_evidence (request_id, kind);

ALTER TABLE service_evidence ENABLE ROW LEVEL SECURITY;

-- Prestador vê as próprias evidências
CREATE POLICY evidence_select_provider ON service_evidence
  FOR SELECT TO authenticated
  USING (
    provider_id IN (SELECT id FROM provider_profiles WHERE user_id = auth.uid())
  );

-- Cliente vê evidências do seu pedido (para tela de confirmação)
CREATE POLICY evidence_select_customer ON service_evidence
  FOR SELECT TO authenticated
  USING (
    request_id IN (SELECT id FROM service_requests WHERE customer_id = auth.uid())
  );

-- ─── check_in_attempts ────────────────────────────────────────────────────────
-- Controle de rate limiting para tentativas de check-in.
-- Lockout após 5 tentativas erradas em 15 minutos.
CREATE TABLE IF NOT EXISTS check_in_attempts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID         NOT NULL REFERENCES service_requests(id),
  provider_id  UUID         NOT NULL REFERENCES provider_profiles(id),
  success      BOOLEAN      NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS check_in_attempts_lookup_idx
  ON check_in_attempts (request_id, provider_id, attempted_at DESC);

ALTER TABLE check_in_attempts ENABLE ROW LEVEL SECURITY;
-- check_in_attempts: sem policy pública — acesso somente via service_role

-- ─── Notas de infraestrutura ──────────────────────────────────────────────────
-- O bucket 'evidence' precisa ser criado manualmente no Supabase Dashboard:
--   Storage > New bucket > Name: "evidence" > Private: true
-- Ou via Supabase CLI:
--   supabase storage create-bucket evidence --no-public
