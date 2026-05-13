-- =============================================================
-- 004_provider_profiles.sql
-- Dados de perfil do prestador de serviços.
-- Campos sensíveis (doc_number, pix_key) — adicionados em lote
-- futuro com criptografia antes de ir para produção.
-- Aplicar APÓS 003_customer_profiles.sql.
-- =============================================================

-- ------------------------------------------------------------
-- Tabela
-- ------------------------------------------------------------
CREATE TABLE public.provider_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name  TEXT,
  phone         TEXT,
  bio           TEXT,
  -- Arrays de slugs e bairros. Normalizado via tabelas relacionais em lotes futuros
  -- (provider_category_links, provider_service_areas) — estes arrays são atalho para MVP.
  categories    TEXT[]      NOT NULL DEFAULT '{}',
  neighborhoods TEXT[]      NOT NULL DEFAULT '{}',
  -- Simplificado: approved = kyc_status em dois estados.
  -- TODO (lote futuro): substituir por kyc_status ENUM(pending, approved, rejected, under_review)
  --   e adicionar: legal_name, doc_type, doc_number (encrypted), pix_key (encrypted),
  --   pix_key_type, photo_url, rating_avg, rating_count, completed_jobs, strikes,
  --   kyc_reviewed_by, kyc_reviewed_at.
  approved      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_profiles_approved   ON public.provider_profiles (approved);
CREATE INDEX idx_provider_profiles_categories ON public.provider_profiles USING GIN (categories);
CREATE INDEX idx_provider_profiles_neighborhoods ON public.provider_profiles USING GIN (neighborhoods);

CREATE TRIGGER provider_profiles_updated_at
  BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

-- Prestador lê e edita o próprio perfil
CREATE POLICY "provider_profiles_select_own"
  ON public.provider_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "provider_profiles_insert_own"
  ON public.provider_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "provider_profiles_update_own"
  ON public.provider_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prestadores aprovados são visíveis para qualquer usuário autenticado.
-- Clientes precisam ver o perfil público (nome, bio, categorias, bairros) ao
-- receber orçamentos e confirmar serviços.
-- Nota: phone só fica visível após pagamento confirmado — tratar na camada de API,
-- não expor em queries de listagem.
CREATE POLICY "provider_profiles_select_approved"
  ON public.provider_profiles
  FOR SELECT
  USING (approved = TRUE AND auth.uid() IS NOT NULL);
