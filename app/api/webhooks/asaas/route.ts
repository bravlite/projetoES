// app/api/webhooks/asaas/route.ts
// Recebe eventos de pagamento do PSP Asaas.
// Autenticação via header asaas-access-token comparado ao ASAAS_WEBHOOK_TOKEN.
// Idempotência garantida por psp_charge_id.

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN
  if (webhookToken) {
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

  // ── Busca pagamento por psp_charge_id (idempotência) ─────────────────────
  const { data: existingPayment } = await admin
    .from('payments')
    .select('id, status, order_id, customer_id')
    .eq('psp_charge_id', payment.id)
    .single()

  if (!existingPayment) {
    // Pagamento não encontrado — pode ser de outro ambiente (sandbox vs prod)
    return Response.json({ error: 'Payment not found' }, { status: 404 })
  }

  // Já processado — responde OK (idempotência)
  if (existingPayment.status === 'paid') {
    return Response.json({ ok: true, idempotent: true })
  }

  const orderId: string = existingPayment.order_id
  const now = new Date().toISOString()
  const grossCents = Math.round(payment.value * 100)

  // ── Busca estado atual do pedido ─────────────────────────────────────────
  const { data: sr } = await admin
    .from('service_requests')
    .select('status, current_provider_id, final_value_cents')
    .eq('id', orderId)
    .single()

  if (!sr) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Gera código de check-in: 6 dígitos entre 100000-999999
  const checkInCode = (Math.floor(100000 + Math.random() * 900000)).toString()

  // ── Comissão: 15%, mínimo R$10 ───────────────────────────────────────────
  const commissionRate = 0.15
  const minCommissionCents = 1000
  const commissionCents = Math.max(Math.round(grossCents * commissionRate), minCommissionCents)
  const netCents = grossCents - commissionCents

  // ── Atualiza payment ──────────────────────────────────────────────────────
  await admin
    .from('payments')
    .update({
      status: 'paid',
      paid_at: now,
      webhook_payload: body,
    })
    .eq('id', existingPayment.id)

  // ── Atualiza service_request ──────────────────────────────────────────────
  await admin
    .from('service_requests')
    .update({
      status: 'payment_confirmed',
      check_in_code: checkInCode,
    })
    .eq('id', orderId)

  // ── Cria payout (status=pending — elegível após conclusão) ────────────────
  if (sr.current_provider_id) {
    await admin.from('payouts').insert({
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
