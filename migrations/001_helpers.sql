-- =============================================================
-- 001_helpers.sql
-- Funções utilitárias compartilhadas por todas as tabelas.
-- Aplicar PRIMEIRO.
-- =============================================================

-- Atualiza updated_at automaticamente antes de cada UPDATE.
-- Referenciada por triggers em todas as tabelas.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
