# Como subir o Concluído pra produção

## TL;DR — stack recomendada para MVP

| Serviço | O que faz | Plano inicial |
|---|---|---|
| **Vercel** | Roda o Next.js | Hobby (grátis) ou Pro ($20/mês) |
| **Supabase** | Banco de dados + Auth | Free (grátis até 500 MB) |
| **Cloudflare R2** | Fotos de evidência | Free (10 GB grátis/mês) |
| **Asaas** | Pagamentos Pix | Sem mensalidade, cobra % por transação |

> Cloudflare Pages **não funciona** com este projeto — Next.js App Router usa Node.js no servidor, e o Pages só suporta Edge Runtime. Use Vercel.

---

## Passo a passo

### 1. Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha região **South America (São Paulo)**
3. Anote as 3 chaves:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca expor no frontend
4. Vá em **SQL Editor** e rode cada arquivo de migração em ordem:
   ```
   migrations/001_schema.sql
   migrations/002_*.sql
   ...
   migrations/011_lgpd.sql
   ```
5. Em **Authentication → URL Configuration**, adicione:
   - Site URL: `https://seu-dominio.vercel.app`
   - Redirect URL: `https://seu-dominio.vercel.app/auth/callback`

---

### 2. Cloudflare R2 (fotos de evidência)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → **Create bucket**
2. Nome do bucket: `concluido-uploads`
3. Em **Settings → Public Access**: habilite acesso público (para servir as fotos)
4. Em **Manage R2 API Tokens**: crie um token com permissão `Object Read & Write`
5. Anote:
   - Account ID → `R2_ACCOUNT_ID`
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`
   - Public URL → `R2_PUBLIC_URL` (ex: `https://pub-abc123.r2.dev`)

---

### 3. Asaas (pagamentos Pix)

1. Acesse [asaas.com](https://www.asaas.com) → crie conta **Sandbox** primeiro para testar
2. Em **Configurações → Integrações → API**: gere sua API key
3. Configure o webhook para receber notificações de pagamento:
   - URL: `https://seu-dominio.vercel.app/api/webhooks/asaas`
   - Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`
   - Copie o token gerado → `ASAAS_WEBHOOK_TOKEN`
4. Quando pronto para produção: mude `ASAAS_ENVIRONMENT=production`

---

### 4. Vercel (hospedagem do Next.js)

#### Opção A — via GitHub (recomendado)

1. Suba o código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório
3. Vercel detecta Next.js automaticamente — não mude nada no build settings
4. Adicione todas as variáveis de ambiente em **Settings → Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ASAAS_API_KEY=$aact_...
ASAAS_WEBHOOK_TOKEN=seu-token-secreto
ASAAS_ENVIRONMENT=production

R2_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=seu-key-id
R2_SECRET_ACCESS_KEY=seu-secret
R2_BUCKET_NAME=concluido-uploads
R2_PUBLIC_URL=https://pub-abc123.r2.dev

NEXT_PUBLIC_APP_URL=https://seu-dominio.vercel.app
```

5. Clique **Deploy** — pronto.

#### Opção B — via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

### 5. Cron job (auto-aceite de pedidos)

O endpoint `/api/cron/auto-accept` precisa rodar periodicamente (a cada hora).

Em `vercel.json` na raiz do projeto:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-accept",
      "schedule": "0 * * * *"
    }
  ]
}
```

> Crons no Vercel requerem plano **Pro** ($20/mês). Alternativa gratuita: use [cron-job.org](https://cron-job.org) para fazer GET no endpoint com um header de autenticação.

---

## Render (alternativa ao Vercel)

Use se quiser custo fixo previsível e mais controle. Sem surpresas de billing por uso.

### 4.1 Criar o Web Service

1. Acesse [render.com](https://render.com) → faça login → **New +** → **Web Service**
2. Conecte sua conta GitHub e selecione o repositório do projeto
3. Configure:
   - **Name:** `concluido-app` (ou qualquer nome)
   - **Region:** `Ohio (US East)` — mais próximo do Brasil com latência aceitável
   - **Branch:** `master` (ou `main`)
   - **Runtime:** `Node`
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** `Starter` ($7/mês) — suficiente para MVP

4. Clique em **Advanced** e adicione todas as variáveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

ASAAS_API_KEY=$aact_...
ASAAS_WEBHOOK_TOKEN=seu-token-secreto
ASAAS_ENVIRONMENT=production

R2_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=seu-key-id
R2_SECRET_ACCESS_KEY=seu-secret
R2_BUCKET_NAME=concluido-uploads
R2_PUBLIC_URL=https://pub-abc123.r2.dev

NEXT_PUBLIC_APP_URL=https://concluido-app.onrender.com
NODE_ENV=production
```

5. Clique **Create Web Service** — o primeiro deploy inicia automaticamente
6. Aguarde ~3 minutos. A URL gerada será `https://concluido-app.onrender.com`

---

### 4.2 Cron job no Render (auto-aceite de pedidos)

1. No dashboard do Render → **New +** → **Cron Job**
2. Configure:
   - **Name:** `concluido-auto-accept`
   - **Runtime:** `Node`
   - **Build command:** `echo ok` (sem build)
   - **Command:** `curl -s https://concluido-app.onrender.com/api/cron/auto-accept`
   - **Schedule:** `0 * * * *` (todo hora em ponto)
3. Clique **Create Cron Job**

> ⚠️ Cron Jobs no Render custam $1/mês separado do Web Service.

---

### 4.3 Deploy automático a cada push

Por padrão o Render já monitora a branch configurada. A cada `git push` ele redeploya automaticamente. Para desativar: **Settings → Auto-Deploy → No**.

---

### 4.4 Domínio próprio no Render (opcional)

1. **Settings → Custom Domains** → **Add Custom Domain**
2. Adicione seu domínio (ex: `app.concluido.com.br`)
3. No seu DNS (Cloudflare, GoDaddy, etc.), crie um registro CNAME:
   - **Name:** `app`
   - **Target:** `concluido-app.onrender.com`
4. Aguarde propagação (até 24h). TLS é provisionado automaticamente.

---

### 4.5 Diferenças Render vs Vercel

| | Render | Vercel |
|---|---|---|
| Custo fixo | $7/mês | $0 (Hobby) ou $20 (Pro) |
| Cron job | $1/mês extra | Grátis no Pro, não tem no Hobby |
| Deploy | ~3 min | ~1 min |
| Sleep em inatividade | Não (Starter pago) | Não (Hobby sem sleep) |
| Logs em tempo real | Sim | Sim |
| Domínio grátis | `.onrender.com` | `.vercel.app` |
| Recomendado para | Custo previsível | Simplicidade máxima |

**Recomendação MVP:** Vercel Hobby (grátis) + cron-job.org para o auto-aceite. Migre para Render quando quiser billing fixo.

---

## Checklist antes de ir ao ar

- [ ] Rodou todas as migrations no Supabase de produção
- [ ] `ASAAS_ENVIRONMENT=production` (não sandbox)
- [ ] Webhook do Asaas apontando para o domínio de produção
- [ ] URL de redirect do Supabase Auth atualizada para o domínio de produção
- [ ] Cron job configurado (Vercel Pro ou cron-job.org)
- [ ] Testou cadastro + pedido + pagamento Pix em staging
- [ ] Ícones PWA criados (`public/icons/icon-192.png` e `icon-512.png`)
- [ ] Domínio próprio configurado no Vercel (opcional no MVP)

---

## Custos estimados no MVP beta (< 100 usuários)

| Serviço | Custo |
|---|---|
| Vercel Hobby | R$ 0 |
| Supabase Free | R$ 0 |
| Cloudflare R2 | R$ 0 (até 10 GB) |
| Asaas | R$ 0 fixo + % por transação |
| **Total fixo** | **R$ 0/mês** |

Quando escalar: Vercel Pro ($20/mês) + Supabase Pro ($25/mês) quando o banco passar de 500 MB.
