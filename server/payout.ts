'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'

// ------------------------------------------------------------
// markPayoutPaid — admin executa repasse manual
// ------------------------------------------------------------
export async function markPayoutPaid(
  payoutId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Só admin
  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'admin') return { error: 'Acesso restrito ao administrador.' }

  const confirmationId = (formData.get('confirmation_id') as string | null)?.trim() ?? ''
  const notes = (formData.get('notes') as string | null)?.trim() || null

  if (!confirmationId) return { error: 'Informe o ID de confirmação do Pix.' }

  // Busca payout
  const { data: rawPayout } = await admin
    .from('payouts')
    .select('id, order_id, provider_id, payment_id, net_cents, status')
    .eq('id', payoutId)
    .single()
  const payout = rawPayout as {
    id: string
    order_id: string
    provider_id: string
    payment_id: string
    net_cents: number
    status: string
  } | null

  if (!payout) return { error: 'Repasse não encontrado.' }
  if (payout.status !== 'eligible') return { error: `Status inválido: ${payout.status}. Apenas repasses elegíveis podem ser pagos.` }

  const now = new Date().toISOString()

  // Marca payout como pago
  const { error: updateErr } = await admin
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: now,
      method: 'manual_pix',
      confirmation_id: confirmationId,
      notes,
    })
    .eq('id', payoutId)
    .eq('status', 'eligible') // guard contra race condition

  if (updateErr) return { error: 'Erro ao atualizar repasse. Tente novamente.' }

  // Atualiza pedido para payout_released
  await admin
    .from('service_requests')
    .update({ status: 'payout_released' })
    .eq('id', payout.order_id)
    .in('status', ['accepted_by_customer', 'auto_accepted'])

  // Audit trail
  await admin.from('financial_events').insert({
    event_type: 'payout_paid',
    order_id: payout.order_id,
    payment_id: payout.payment_id,
    payout_id: payoutId,
    actor_id: user.id,
    amount_cents: payout.net_cents,
    metadata: {
      confirmation_id: confirmationId,
      method: 'manual_pix',
      paid_at: now,
      notes,
    },
  })

  await admin.from('admin_actions').insert({
    actor_id: user.id,
    action_type: 'release_payout',
    target_type: 'payout',
    target_id: payoutId,
    payload: {
      confirmation_id: confirmationId,
      net_cents: payout.net_cents,
      order_id: payout.order_id,
      notes,
    },
  })

  redirect(`/admin/repasses/${payoutId}?paid=1`)
}
