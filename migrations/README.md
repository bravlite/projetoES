# Migrations

Aplicar na ordem numérica. Cada arquivo é idempotente onde possível.

## Como aplicar (Supabase Dashboard)

1. Acesse **SQL Editor** no Supabase Dashboard do projeto.
2. Cole e execute cada arquivo na ordem:

```
001_helpers.sql
002_profiles.sql
003_customer_profiles.sql
004_provider_profiles.sql
005_addresses.sql
006_service_requests.sql
```

3. Verifique sem erro antes de passar para o próximo.

## Como aplicar (Supabase CLI)

```bash
# Instalar CLI (se necessário)
npm install -g supabase

# Linkar com o projeto
supabase link --project-ref SEU_PROJECT_REF

# Aplicar migrations manualmente via CLI (db push)
supabase db push
```

> **Nota:** Este projeto não usa Supabase migrations automáticas por enquanto.
> Os arquivos em `migrations/` são SQL puro para aplicar manualmente.
> Migração para `supabase/migrations/` com numeração automática — lote futuro.

## Ordem de dependências

```
001_helpers.sql
  └── 002_profiles.sql                  (usa update_updated_at(), referencia auth.users)
        ├── 003_customer_profiles.sql   (referencia profiles.id)
        ├── 004_provider_profiles.sql   (referencia profiles.id)
        └── 005_addresses.sql           (referencia profiles.id)
              └── 006_service_requests.sql  (referencia profiles, provider_profiles; FK circular via ALTER TABLE)
```

## Estado atual

| Migration | Tabelas | Status |
|---|---|---|
| 001 | `update_updated_at()` function | Fundação |
| 002 | `profiles` + trigger auto-criação + RLS | MVP |
| 003 | `customer_profiles` + RLS | MVP |
| 004 | `provider_profiles` + RLS + índices GIN | MVP |
| 005 | `addresses` + RLS + índices | MVP |
| 006 | `service_requests` + `service_quotes` + `service_order_events` + RLS | MVP (M4) |

## Débito técnico documentado

- `customer_profiles`: `cpf`, `birth_date`, `default_address_id` ausentes — adicionar antes do beta com `pgcrypto` para CPF.
- `provider_profiles`: `approved` é simplificação de `kyc_status ENUM` — expandir antes do beta com campos KYC completos, `pix_key` (criptografada), `rating_avg`, `strikes`.
- `service_requests`: endereço desnormalizado (street, number, complement, neighborhood, city) — sem FK para `addresses`. Simplificação MVP; migrar para FK antes do beta.
- Admin bypass de RLS: implementar via `service_role` no server — não via policy por enquanto.
- Tipos Supabase: remover `<Database>` genérico dos clientes e regenerar tipos via `supabase gen types typescript` antes do beta.
