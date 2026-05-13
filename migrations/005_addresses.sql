-- 005_addresses.sql
-- Tabela de endereços do cliente.
-- user_id referencia profiles.id (não auth.users diretamente).
-- Denormalizada em service_requests para queries mais simples no feed.

CREATE TABLE IF NOT EXISTS addresses (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label        text,                             -- Casa, Trabalho, etc.
  street       text        NOT NULL,
  number       text        NOT NULL,
  complement   text,
  neighborhood text        NOT NULL,
  city         text        NOT NULL DEFAULT 'Vitória',
  state        text        NOT NULL DEFAULT 'ES',
  cep          text,
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses(user_id);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addresses_select_own" ON addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "addresses_insert_own" ON addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses_update_own" ON addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses_delete_own" ON addresses
  FOR DELETE USING (auth.uid() = user_id);
