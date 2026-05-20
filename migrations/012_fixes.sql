-- migration 012: correções de segurança e integridade
-- 1. Bloqueia auto-aprovação de prestador via RLS
-- 2. Garante idempotência do webhook com UNIQUE em payouts(order_id)
-- 3. Storage RLS para bucket evidence

-- ── 1. Fix RLS: impede prestador de alterar próprio campo approved ────────────
DROP POLICY IF EXISTS "provider_profiles_update_own" ON public.provider_profiles;

CREATE POLICY "provider_profiles_update_own"
  ON public.provider_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND approved = (SELECT approved FROM provider_profiles WHERE user_id = auth.uid())
  );

-- ── 2. UNIQUE em payouts(order_id) evita payout duplicado ────────────────────
ALTER TABLE payouts
  ADD CONSTRAINT IF NOT EXISTS payouts_order_id_unique UNIQUE (order_id);

-- ── 3. Storage RLS para bucket evidence (execute após criar o bucket) ─────────
-- Prestadores aprovados podem fazer upload no próprio bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "evidence_insert_provider"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM provider_profiles
      WHERE user_id = auth.uid() AND approved = true
    )
  );

CREATE POLICY IF NOT EXISTS "evidence_select_parties"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'evidence'
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM provider_profiles WHERE user_id = auth.uid() AND approved = true)
    )
  );
