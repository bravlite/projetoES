# Concluído — Marketplace de Serviços Locais

Marketplace local de serviços domésticos para Vitória/Vila Velha, ES. Pague só quando o serviço estiver concluído.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (Auth + Postgres + Storage + RLS)
- **PSP:** Asaas (Pix + futuro split)
- **Deploy:** Vercel

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves reais (ver seção abaixo)

# 3. Subir dev server
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Configuração de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL      # URL do projeto no Supabase (console → Settings → API)
NEXT_PUBLIC_SUPABASE_ANON_KEY # Chave anon do Supabase (mesma tela)
SUPABASE_SERVICE_ROLE_KEY     # Chave service_role — usar só em server actions/admin
ASAAS_API_KEY                 # Chave do Asaas (sandbox disponível em asaas.com)
ASAAS_WEBHOOK_TOKEN           # Token para validar webhooks do Asaas
ASAAS_ENVIRONMENT             # "sandbox" em dev, "production" em prod
R2_*                          # Cloudflare R2 para storage (opcional no início)
NEXT_PUBLIC_APP_URL           # URL pública do app (http://localhost:3000 em dev)
```

**O app sobe sem .env.local preenchido.** As funções que dependem dessas vars falham com mensagem clara ao serem chamadas — não em import.

> **`SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para o client bundle.** Está protegida pelo `server-only` em `lib/supabase/admin.ts`.

## Estado atual (Lote 2)

| Camada | Status |
|---|---|
| Estrutura Next.js 14 + Tailwind | ✅ pronto |
| Supabase client / server / admin | ✅ preparado (sem projeto real conectado) |
| Validação de env vars (zod) | ✅ pronto |
| Auth (login/cadastro real) | ⏳ Milestone 3 |
| Banco / migrations / RLS | ⏳ Milestone 2–3 |
| Pix / Asaas | ⏳ Milestone 5 |
| Upload / Storage | ⏳ Milestone 6 |
| Admin real | ⏳ Milestone 8 |

## Scripts

```bash
npm run dev      # dev server
npm run build    # build de produção
npm run start    # servidor de produção
npm run lint     # ESLint
npm run format   # Prettier
```

## Estrutura de pastas

```
app/             # App Router — rotas e layouts
  admin/         # painel admin (placeholder)
  cadastro/      # cadastro cliente e prestador (placeholder)
  cliente/       # área do cliente (placeholder)
  prestador/     # área do prestador (placeholder)
  pedidos/       # pedidos (placeholder)
  login/         # login (placeholder)
components/      # componentes UI reutilizáveis
lib/
  env.ts         # validação de env vars com zod
  supabase/
    client.ts    # browser client (anon key + RLS)
    server.ts    # server client (cookies + RLS)
    admin.ts     # admin client (service_role — server-only)
types/
  database.ts    # tipos do banco (placeholder — gerar via Supabase CLI)
server/          # server actions e jobs (a implementar)
migrations/      # migrations SQL Supabase (a implementar)
```

## Roadmap de implementação

| Milestone | Descrição |
|-----------|-----------|
| M1 | ✅ Landing + estrutura base |
| M2 | Painel manual/admin mínimo |
| M3 | Cadastro cliente / prestador (Supabase Auth) |
| M4 | Pedidos e orçamentos |
| M5 | Pagamento Pix (Asaas) |
| M6 | Validação de conclusão |
| M7 | Disputas |
| M8 | Painel admin completo |
| M9 | Extrato e repasse |
| M10 | Métricas (PostHog) |

Ver [docs/PRD.md](docs/PRD.md) para especificação completa.
