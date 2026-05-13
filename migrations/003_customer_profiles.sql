-- =============================================================
-- 003_customer_profiles.sql
-- Dados de perfil do cliente.
-- Campos sensíveis (CPF, birth_date) — adicionados em lote futuro
-- com criptografia pgcrypto antes de ir para produção.
-- Aplicar APÓS 002_profiles.sql.
-- =============================================================

-- ------------------------------------------------------------
-- Tabela
-- ------------------------------------------------------------
CREATE TABLE public.customer_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name    TEXT,
  phone        TEXT,
  neighborhood TEXT,
  city         TEXT        DEFAULT 'Vitória',
  -- TODO (lote futuro, antes do beta público):
  --   cpf TEXT  — criptografar com pgcrypto (pg_encrypt) em repouso
  --   birth_date DATE
  --   default_address_id UUID REFERENCES public.addresses(id)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- RLS — cliente só vê e edita o próprio perfil
-- ------------------------------------------------------------
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_profiles_select_own"
  ON public.customer_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "customer_profiles_insert_own"
  ON public.customer_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customer_profiles_update_own"
  ON public.customer_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
