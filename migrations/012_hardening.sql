-- Migration 012: hardening pós-revisão de código
-- Refs: correções do fluxo de pagamento (jul/2026)
--
-- 1. provider_completed_at — relógio dedicado do auto-aceite (24/48h).
--    Antes o cron usava updated_at, que muda em qualquer UPDATE da linha
--    e resetava o timer silenciosamente.
--
-- 2. UNIQUE em payouts.order_id — webhooks do Asaas são reenviados; dois
--    eventos processados em paralelo podiam criar payout duplicado para o
--    mesmo pedido (prestador receberia duas vezes).

-- ─── 1. service_requests.provider_completed_at ──────────────────────────────
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS provider_completed_at TIMESTAMPTZ;

-- Backfill: pedidos que já estão aguardando confirmação usam updated_at
-- como melhor aproximação disponível.
UPDATE service_requests
  SET provider_completed_at = updated_at
  WHERE status = 'completed_by_provider'
    AND provider_completed_at IS NULL;

-- ─── 2. payouts: no máximo 1 payout por pedido ───────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS payouts_order_id_uniq ON payouts (order_id);

-- ─── 3. Feed: pedido continua visível após o primeiro orçamento ─────────────
-- A policy antiga só liberava status 'requested' — assim que o primeiro
-- prestador orçava (status → 'quoted'), o pedido sumia do feed dos demais
-- e a comparação de orçamentos nunca acontecia.
DROP POLICY IF EXISTS "sr_select_provider_open" ON service_requests;
CREATE POLICY "sr_select_provider_open" ON service_requests
  FOR SELECT USING (
    status IN ('requested', 'quoted')
    AND EXISTS (
      SELECT 1 FROM provider_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.approved = true
    )
  );
