// app/api/cron/auto-accept/route.ts
// Job horário: auto-aceite por timeout + limpeza de cobranças Pix expiradas.
// Vercel Cron aciona a cada hora (ver vercel.json).
// Segurança: valida CRON_SECRET (injetado automaticamente pelo Vercel em produção).
//
// Regras de timeout (PRD seção 6):
//   final_value_cents ≤ 30000 (R$300): auto-aceite após 24h
//   final_value_cents > 30000 (R$300): auto-aceite após 48h
//
// O relógio usa provider_completed_at (migration 012) — updated_at muda em
// qualquer alteração da linha e resetaria o timer.

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { shouldAutoAccept } from '@/lib/billing'
import {
  shouldPurgeEvidence,
  RETENTION_NO_DISPUTE_DAYS,
  CLOSED_ORDER_STATUSES,
} from '@/lib/retention'

export async function GET(request: NextRequest) {
  // Valida autorização. Em produção o secret é obrigatório (fail closed):
  // sem ele, qualquer um poderia disparar o job.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron/auto-accept] CRON_SECRET não configurado em produção')
      return Response.json({ error: 'Cron not configured' }, { status: 503 })
    }
  } else {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return Response.json({ ok: true, processed: 0, reason: 'no_supabase' })
  }

  const admin = createAdminClient() as any
  const now = new Date().toISOString()
  const nowMs = Date.now()

  // ── 1. Auto-aceite por timeout ─────────────────────────────────────────────
  const { data: candidates } = await admin
    .from('service_requests')
    .select('id, current_provider_id, final_value_cents, provider_completed_at, updated_at')
    .eq('status', 'completed_by_provider')

  const toProcess = ((candidates ?? []) as {
    id: string
    current_provider_id: string | null
    final_value_cents: number | null
    provider_completed_at: string | null
    updated_at: string
  }[]).filter((req) =>
    shouldAutoAccept(req.provider_completed_at ?? req.updated_at, req.final_value_cents, nowMs)
  )

  let processed = 0
  const errors: string[] = []

  for (const req of toProcess) {
    try {
      // Avança para auto_accepted — claim atômico contra race condition
      const { data: claimed } = await admin
        .from('service_requests')
        .update({ status: 'auto_accepted' })
        .eq('id', req.id)
        .eq('status', 'completed_by_provider')
        .select('id')

      if (!claimed || claimed.length === 0) continue

      // Payout vira elegível
      await admin
        .from('payouts')
        .update({ status: 'eligible', eligible_at: now })
        .eq('order_id', req.id)
        .eq('status', 'pending')

      // Audit trail
      await admin.from('service_order_events').insert({
        request_id: req.id,
        from_status: 'completed_by_provider',
        to_status: 'auto_accepted',
        actor_id: null,
        actor_role: 'system',
        payload: {
          reason: 'timeout',
          final_value_cents: req.final_value_cents,
          auto_accepted_at: now,
        },
      })

      await admin.from('financial_events').insert({
        event_type: 'payout_eligible',
        order_id: req.id,
        metadata: {
          confirmed_by: 'auto_accept',
          confirmed_at: now,
          final_value_cents: req.final_value_cents,
        },
      })

      processed++
    } catch (err) {
      errors.push(`${req.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 2. Expira cobranças Pix vencidas ───────────────────────────────────────
  const { data: expiredPayments } = await admin
    .from('payments')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', now)
    .select('id, order_id')

  // Pedidos em awaiting_payment sem nenhuma cobrança pendente voltam para
  // quote_accepted — o cliente pode gerar um novo Pix na tela do pedido.
  let reverted = 0
  for (const p of (expiredPayments ?? []) as { id: string; order_id: string }[]) {
    const { count: pendingCount } = await admin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', p.order_id)
      .eq('status', 'pending')

    if ((pendingCount ?? 0) > 0) continue

    const { data: revertedRows } = await admin
      .from('service_requests')
      .update({ status: 'quote_accepted' })
      .eq('id', p.order_id)
      .eq('status', 'awaiting_payment')
      .select('id')

    if (revertedRows && revertedRows.length > 0) {
      await admin.from('service_order_events').insert({
        request_id: p.order_id,
        from_status: 'awaiting_payment',
        to_status: 'quote_accepted',
        actor_id: null,
        actor_role: 'system',
        payload: { reason: 'pix_expired', payment_id: p.id },
      })
      reverted++
    }
  }

  // ── 3. Expira pedidos zumbis (sem aceite há 30+ dias) ─────────────────────
  const staleCutoff = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: expiredOrders } = await admin
    .from('service_requests')
    .update({ status: 'expired' })
    .in('status', ['requested', 'quoted'])
    .lt('created_at', staleCutoff)
    .select('id, status')

  for (const o of (expiredOrders ?? []) as { id: string }[]) {
    await admin.from('service_order_events').insert({
      request_id: o.id,
      from_status: null,
      to_status: 'expired',
      actor_id: null,
      actor_role: 'system',
      payload: { reason: 'stale_30d' },
    })
  }

  // ── 4. Retenção LGPD: elimina fotos de evidência fora do prazo ─────────────
  // 90 dias após o encerramento (CDC Art. 26, II); 1 ano se houve disputa
  // (LGPD Art. 7º, VI). Regras e fundamentação em lib/retention.ts.
  let purgedPhotos = 0
  try {
    // Candidatos: pedidos encerrados há mais tempo que o prazo mais curto (90d).
    // Processa em lote (200/execução; o cron roda de hora em hora e drena a fila).
    const shortCutoff = new Date(
      nowMs - RETENTION_NO_DISPUTE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    const { data: closed } = await admin
      .from('service_requests')
      .select('id, updated_at')
      .in('status', CLOSED_ORDER_STATUSES as unknown as string[])
      .lt('updated_at', shortCutoff)
      .limit(200)

    const closedOrders = (closed ?? []) as { id: string; updated_at: string }[]
    if (closedOrders.length > 0) {
      const ids = closedOrders.map((o) => o.id)

      // Quais desses tiveram disputa? (prazo estendido para 1 ano)
      const { data: disp } = await admin
        .from('disputes')
        .select('order_id')
        .in('order_id', ids)
      const disputedIds = new Set(
        ((disp as { order_id: string }[]) ?? []).map((d) => d.order_id)
      )

      const purgeIds = closedOrders
        .filter((o) => shouldPurgeEvidence(o.updated_at, disputedIds.has(o.id), nowMs))
        .map((o) => o.id)

      if (purgeIds.length > 0) {
        const { data: evid } = await admin
          .from('service_evidence')
          .select('id, file_path')
          .in('request_id', purgeIds)
        const rows = (evid as { id: string; file_path: string }[]) ?? []

        if (rows.length > 0) {
          const paths = rows.map((e) => e.file_path)
          for (let i = 0; i < paths.length; i += 100) {
            await admin.storage.from('evidence').remove(paths.slice(i, i + 100))
          }
          await admin
            .from('service_evidence')
            .delete()
            .in(
              'id',
              rows.map((e) => e.id)
            )
          purgedPhotos = rows.length
        }
      }
    }
  } catch (err) {
    errors.push(`purge_evidence: ${err instanceof Error ? err.message : String(err)}`)
  }

  return Response.json({
    ok: true,
    processed,
    expired_payments: expiredPayments?.length ?? 0,
    reverted_orders: reverted,
    expired_orders: expiredOrders?.length ?? 0,
    purged_photos: purgedPhotos,
    errors: errors.length > 0 ? errors : undefined,
    ran_at: now,
  })
}
