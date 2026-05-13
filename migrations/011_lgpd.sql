-- Migration 011: LGPD — consentimento e exclusão de conta
-- Adiciona termos aceitos e soft-delete em profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Índice para excluir usuários deletados de queries comuns
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx       ON profiles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_profiles_deleted_idx ON customer_profiles (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_profiles_deleted_idx ON provider_profiles (deleted_at) WHERE deleted_at IS NOT NULL;
