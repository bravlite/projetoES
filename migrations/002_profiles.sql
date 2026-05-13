-- =============================================================
-- 002_profiles.sql
-- Extensão da tabela auth.users do Supabase.
-- 1 linha por usuário, criada automaticamente no signup.
-- Aplicar APÓS 001_helpers.sql.
-- =============================================================

-- ------------------------------------------------------------
-- Tabela
-- ------------------------------------------------------------
CREATE TABLE public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'customer'
                         CHECK (role IN ('customer', 'provider', 'admin')),
  status     TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'banned', 'pending_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles (role);

-- Trigger updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- Auto-criação no signup
-- Quando Supabase Auth registra um novo usuário em auth.users,
-- este trigger cria a linha correspondente em public.profiles.
-- SECURITY DEFINER: executa com permissões do owner (postgres),
-- necessário para acessar o schema auth.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário lê o próprio profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Usuário atualiza o próprio profile
-- Restrição: não pode alterar o próprio role (feito via server action com service_role)
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT é feito exclusivamente pelo trigger handle_new_user (service role).
-- Nenhuma policy de INSERT para usuários comuns.
