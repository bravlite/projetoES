// app/api/webhooks/asaas/route.ts
// Recebe eventos de pagamento do PSP Asaas.
// Autenticação via header asaas-access-token comparado ao ASAAS_WEBHOOK_TOKEN.
// Idempotência garantida por claim atômico do payment (update condicional)
// + UNIQUE em payouts.order_id (migration 012).

import { randomInt } from 'crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeCommission } from '@/lib/billing'

// Eventos que indicam pagamento confirmado
const CONFIRMED_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

type AsaasEvent = {
  event: string
  payment: {
    id: string
    status: string
    value: number
    netValue: number
    externalReference: string | null
  }
}

export async function POST(request: NextRequest) {
  // ── Validação do token ────────────────────────────────────────────────────
  // Em produção o token é obrigatório: sem ele, qualquer um poderia forjar
  // "pagamento confirmado". Só aceita requests sem token em sandbox/dev.
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (!webhookToken) {
    if (process.env.ASAAS_ENVIRONMENT === 'production') {
      console.error('[webhook/asaas] ASAAS_WEBHOOK_TOKEN não configurado em produção')
      return Response.json({ error: 'Webhook not configured' }, { status: 503 })
    }
  } else {
    const receivedToken = request.headers.get('asaas-access-token')
    if (receivedToken !== webhookToken) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: AsaasEvent
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, payment } = body

  // Ignora eventos que não são de pagamento confirmado
  if (!CONFIRMED_EVENTS.has(event)) {
    return Response.json({ ok: true, skipped: true })
  }

  const admin = createAdminClient() as any

  // ── Busca pagamento por psp_charge_id ─────────────────────────────────────
  const { data: existingPayment } = await admin
    .from('payments')
    .select('id, status, order_id, customer_id, amount_cents')
    .eq('psp_charge_id', payment.id)
    .single()

  if (!existingPayment) {
    // Pagamento não encontrado — pode ser de outro ambiente (sandbox vs prod)
    return Response.json({ error: 'Payment not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // ── Claim atômico (idempotência real) ─────────────────────────────────────
  // O Asaas reenvia eventos (PAYMENT_CONFIRMED + PAYMENT_RECEIVED + retries);
  // só 'pending' pode virar 'paid'. Estados terminais ('paid', 'refunded',
  // 'expired') NÃO são reivindicáveis — senão um segundo evento de confirmação
  // ressuscitaria um pagamento já estornado de volta para 'paid'.
  const { data: claimed } = await admin
    .from('payments')
    .update({
      status: 'paid',
      paid_at: now,
      webhook_payload: body,
    })
    .eq('id', existingPayment.id)
    .eq('status', 'pending')
    .select('id')

  if (!claimed || claimed.length === 0) {
    // Já processado / estornado / expirado — responde OK (idempotência)
    return Response.json({ ok: true, idempotent: true })
  }

  const orderId: string = existingPayment.order_id

  // ── Valor: fonte de verdade é o banco, não o payload do evento ────────────
  const grossCents: number = existingPayment.amount_cents
  const receivedCents = Math.round(payment.value * 100)
  if (receivedCents !== grossCents) {
    console.warn(
      `[webhook/asaas] Divergência de valor no charge ${payment.id}: ` +
        `esperado ${grossCents}, recebido ${receivedCents}`
    )
  }

  // ── Busca estado atual do pedido ─────────────────────────────────────────
  const { data: sr } = await admin
    .from('service_requests')
    .select('status, current_provider_id, final_value_cents')
    .eq('id', orderId)
    .single()

  if (!sr) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Gera código de check-in: 6 dígitos, gerador criptográfico
  const checkInCode = randomInt(100000, 1000000).toString()

  // ── Comissão: 15%, mínimo R$10 (regras em lib/billing.ts) ────────────────
  const { commissionCents, netCents, commissionRate, minCommissionCents } =
    computeCommission(grossCents)

  // ── Atualiza service_request ──────────────────────────────────────────────
  // Só avança de um estado pré-pagamento. Se o pedido já foi cancelado/estornado
  // (ex.: cliente cancelou entre os dois eventos do Asaas), NÃO o ressuscita
  // nem regenera check_in_code. Sem linhas afetadas → não cria payout.
  const { data: advancedOrder } = await admin
    .from('service_requests')
    .update({
      status: 'payment_confirmed',
      check_in_code: checkInCode,
    })
    .eq('id', orderId)
    .in('status', ['awaiting_payment', 'quote_accepted'])
    .select('id')

  if (!advancedOrder || advancedOrder.length === 0) {
    // Pagamento confirmado, mas o pedido não estava aguardando pagamento.
    // Corrida com cancelamento: o dinheiro entrou e precisa ser estornado.
    console.error(
      `[webhook/asaas] Pagamento ${payment.id} confirmado para pedido ${orderId} ` +
        `em estado '${sr.status}' (não aguardava pagamento). Estorno manual necessário.`
    )
    await admin.from('financial_events').insert({
      event_type: 'payment_on_terminal_order',
      order_id: orderId,
      payment_id: existingPayment.id,
      amount_cents: grossCents,
      metadata: {
        psp_charge_id: payment.id,
        order_status: sr.status,
        needs_manual_refund: true,
      },
    })
    return Response.json({ ok: true, order_not_awaiting_payment: true })
  }

  // ── Cria payout (status=pending — elegível após conclusão) ────────────────
  if (sr.current_provider_id) {
    const { error: payoutErr } = await admin.from('payouts').insert({
      order_id: orderId,
      provider_id: sr.current_provider_id,
      payment_id: existingPayment.id,
      gross_cents: grossCents,
      commission_cents: commissionCents,
      net_cents: netCents,
      commission_rate: commissionRate,
      min_commission_cents: minCommissionCents,
      status: 'pending',
    })
    // 23505 = payout já existe para este pedido (UNIQUE payouts.order_id) — ok
    if (payoutErr && payoutErr.code !== '23505') {
      console.error(`[webhook/asaas] Falha ao criar payout do pedido ${orderId}:`, payoutErr)
    }
  }

  // ── Audit trail ───────────────────────────────────────────────────────────
  await admin.from('service_order_events').insert({
    request_id: orderId,
    from_status: sr.status,
    to_status: 'payment_confirmed',
    actor_id: null,
    actor_role: 'system',
    payload: { psp_charge_id: payment.id, gross_cents: grossCents, event },
  })

  await admin.from('financial_events').insert({
    event_type: 'payment_received',
    order_id: orderId,
    payment_id: existingPayment.id,
    amount_cents: grossCents,
    metadata: {
      psp_charge_id: payment.id,
      psp_event: event,
      commission_cents: commissionCents,
      net_cents: netCents,
    },
  })

  return Response.json({ ok: true })
}
