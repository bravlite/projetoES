// app/api/cron/auto-accept/route.ts
// Job de auto-aceite por timeout.
// Vercel Cron aciona a cada hora (ver vercel.json).
// Segurança: valida CRON_SECRET (injetado automaticamente pelo Vercel em produção).
//
// Regras de timeout (PRD seção 6):
//   final_value_cents ≤ 30000 (R$300): auto-aceite após 24h
//   final_value_cents > 30000 (R$300): auto-aceite após 48h

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Valida autorização (Vercel injeta CRON_SECRET automaticamente)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
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

  // Limites temporais
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // Pedidos de baixo valor (≤ R$300): timeout 24h
  const { data: lowValue } = await admin
    .from('service_requests')
    .select('id, current_provider_id, final_value_cents')
    .eq('status', 'completed_by_provider')
    .lte('final_value_cents', 30000)
    .lte('updated_at', cutoff24h)

  // Pedidos de alto valor (> R$300): timeout 48h
  const { data: highValue } = await admin
    .from('service_requests')
    .select('id, current_provider_id, final_value_cents')
    .eq('status', 'completed_by_provider')
    .gt('final_value_cents', 30000)
    .lte('updated_at', cutoff48h)

  const toProcess = [...(lowValue ?? []), ...(highValue ?? [])]

  let processed = 0
  const errors: string[] = []

  for (const req of toProcess) {
    try {
      // Avança para auto_accepted
      await admin
        .from('service_requests')
        .update({ status: 'auto_accepted' })
        .eq('id', req.id)
        .eq('status', 'completed_by_provider') // guard contra race condition

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

  return Response.json({
    ok: true,
    processed,
    errors: errors.length > 0 ? errors : undefined,
    ran_at: now,
  })
}
