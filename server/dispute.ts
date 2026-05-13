'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile, ProviderProfile, DisputeReasonCode, DisputeDecision } from '@/types/database'

// ------------------------------------------------------------
// openDispute — cliente abre disputa em pedido completed_by_provider
// ------------------------------------------------------------
export async function openDispute(requestId: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Verifica perfil do cliente
  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'customer') {
    return { error: 'Ação permitida apenas para clientes.' }
  }

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, customer_id, current_provider_id, final_value_cents')
    .eq('id', requestId)
    .single()
  const req = r as {
    id: string
    status: string
    customer_id: string
    current_provider_id: string | null
    final_value_cents: number | null
  } | null

  if (!req) return { error: 'Pedido não encontrado.' }
  if (req.customer_id !== user.id) return { error: 'Acesso negado.' }
  if (!['completed_by_provider', 'in_progress'].includes(req.status)) {
    return { error: 'Disputa só pode ser aberta quando o serviço estiver em andamento ou aguardando confirmação.' }
  }
  if (!req.current_provider_id) return { error: 'Pedido sem prestador atribuído.' }

  // Impede disputa duplicada
  const { data: existing } = await admin
    .from('disputes')
    .select('id')
    .eq('order_id', requestId)
    .maybeSingle()
  if (existing) return { error: 'Já existe uma disputa aberta para este pedido.' }

  const reason_code = formData.get('reason_code') as DisputeReasonCode | null
  const description = (formData.get('description') as string | null)?.trim() ?? ''

  const validReasons: DisputeReasonCode[] = [
    'service_incomplete', 'quality_issue', 'no_show', 'overcharge', 'damage', 'other',
  ]
  if (!reason_code || !validReasons.includes(reason_code)) {
    return { error: 'Selecione um motivo válido.' }
  }
  if (description.length < 20) {
    return { error: 'Descreva o problema em pelo menos 20 caracteres.' }
  }

  const now = new Date().toISOString()

  // Cria disputa
  const { data: newDispute, error: insertErr } = await admin
    .from('disputes')
    .insert({
      order_id: requestId,
      opened_by: user.id,
      provider_id: req.current_provider_id,
      reason_code,
      description,
      status: 'awaiting_provider',
    })
    .select('id')
    .single()

  if (insertErr || !newDispute) {
    return { error: 'Erro ao abrir disputa. Tente novamente.' }
  }
  const disputeId = (newDispute as { id: string }).id

  // Mensagem inicial automática
  await admin.from('dispute_messages').insert({
    dispute_id: disputeId,
    author_id: user.id,
    author_role: 'customer',
    body: description,
  })

  // Atualiza status do pedido
  await admin
    .from('service_requests')
    .update({ status: 'disputed' })
    .eq('id', requestId)

  // Congela payout
  await admin
    .from('payouts')
    .update({ status: 'blocked' })
    .eq('order_id', requestId)
    .in('status', ['pending', 'holding', 'eligible'])

  // Audit trail
  await admin.from('service_order_events').insert({
    request_id: requestId,
    from_status: req.status,
    to_status: 'disputed',
    actor_id: user.id,
    actor_role: 'customer',
    payload: { dispute_id: disputeId, reason_code },
  })

  await admin.from('financial_events').insert({
    event_type: 'dispute_freeze',
    order_id: requestId,
    metadata: {
      dispute_id: disputeId,
      reason_code,
      frozen_at: now,
    },
  })

  redirect(`/pedidos/${requestId}/disputa/${disputeId}`)
}

// ------------------------------------------------------------
// addDisputeMessage — partes enviam mensagem na disputa
// ------------------------------------------------------------
export async function addDisputeMessage(
  disputeId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  const body = (formData.get('body') as string | null)?.trim() ?? ''
  if (body.length < 5) return { error: 'Mensagem muito curta.' }

  // Verifica acesso à disputa e determina role
  const { data: rawDispute } = await admin
    .from('disputes')
    .select('id, order_id, opened_by, provider_id, status')
    .eq('id', disputeId)
    .single()
  const dispute = rawDispute as {
    id: string
    order_id: string
    opened_by: string
    provider_id: string
    status: string
  } | null
  if (!dispute) return { error: 'Disputa não encontrada.' }
  if (dispute.status === 'resolved') return { error: 'Disputa já encerrada.' }

  const { data: rawProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile) return { error: 'Perfil não encontrado.' }

  let author_role: 'customer' | 'provider' | 'admin'
  if (profile.role === 'admin') {
    author_role = 'admin'
  } else if (dispute.opened_by === user.id) {
    author_role = 'customer'
  } else {
    // Verifica se é o prestador
    const { data: pp } = await admin
      .from('provider_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    const providerProfile = pp as { id: string } | null
    if (!providerProfile || dispute.provider_id !== providerProfile.id) {
      return { error: 'Acesso negado.' }
    }
    author_role = 'provider'
  }

  await admin.from('dispute_messages').insert({
    dispute_id: disputeId,
    author_id: user.id,
    author_role,
    body,
  })

  // Avança status dependendo de quem enviou
  if (author_role === 'provider' && dispute.status === 'awaiting_provider') {
    await admin
      .from('disputes')
      .update({ status: 'awaiting_admin' })
      .eq('id', disputeId)
  }

  return {}
}

// ------------------------------------------------------------
// resolveDispute — admin decide a disputa
// ------------------------------------------------------------
export async function resolveDispute(
  disputeId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Só admin
  const { data: rawProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'admin') {
    return { error: 'Acesso restrito ao administrador.' }
  }

  const decision = formData.get('decision') as DisputeDecision | null
  const justification = (formData.get('justification') as string | null)?.trim() ?? ''

  const validDecisions: DisputeDecision[] = [
    'release_full', 'release_partial', 'refund_full', 'refund_partial',
  ]
  if (!decision || !validDecisions.includes(decision)) {
    return { error: 'Selecione uma decisão válida.' }
  }
  if (justification.length < 10) {
    return { error: 'Forneça uma justificativa (mín. 10 caracteres).' }
  }

  // Busca disputa
  const { data: rawDispute } = await admin
    .from('disputes')
    .select('id, order_id, opened_by, provider_id, status')
    .eq('id', disputeId)
    .single()
  const dispute = rawDispute as {
    id: string
    order_id: string
    opened_by: string
    provider_id: string
    status: string
  } | null
  if (!dispute) return { error: 'Disputa não encontrada.' }
  if (dispute.status === 'resolved') return { error: 'Disputa já resolvida.' }

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, current_provider_id, final_value_cents')
    .eq('id', dispute.order_id)
    .single()
  const req = r as {
    id: string
    current_provider_id: string | null
    final_value_cents: number | null
  } | null
  if (!req) return { error: 'Pedido não encontrado.' }

  const now = new Date().toISOString()
  const isProviderFavored = decision === 'release_full' || decision === 'release_partial'
  const isRefund = decision === 'refund_full' || decision === 'refund_partial'

  // Resolve disputa
  await admin
    .from('disputes')
    .update({
      status: 'resolved',
      decision,
      resolved_by: user.id,
      resolved_at: now,
    })
    .eq('id', disputeId)

  // Atualiza status do pedido
  const newOrderStatus = isRefund ? 'refunded' : 'accepted_by_customer'
  await admin
    .from('service_requests')
    .update({ status: newOrderStatus })
    .eq('id', dispute.order_id)

  // Payout
  if (isProviderFavored) {
    await admin
      .from('payouts')
      .update({ status: 'eligible', eligible_at: now })
      .eq('order_id', dispute.order_id)
      .eq('status', 'blocked')
  } else if (isRefund) {
    await admin
      .from('payouts')
      .update({ status: 'refunded_to_customer' })
      .eq('order_id', dispute.order_id)
      .eq('status', 'blocked')
  }

  // Strike no perdedor (provider ou customer) — fetch + increment manual
  // 3 strikes → suspensão automática
  if (isRefund) {
    const { data: ppRow } = await admin
      .from('provider_profiles')
      .select('strikes, user_id')
      .eq('id', dispute.provider_id)
      .single()
    const ppTyped = ppRow as { strikes: number; user_id: string } | null
    const currentStrikes = ppTyped?.strikes ?? 0
    const newStrikes = currentStrikes + 1
    await admin
      .from('provider_profiles')
      .update({ strikes: newStrikes })
      .eq('id', dispute.provider_id)
    if (newStrikes >= 3 && ppTyped?.user_id) {
      await admin
        .from('profiles')
        .update({ status: 'suspended' })
        .eq('id', ppTyped.user_id)
    }
  } else {
    const { data: cpRow } = await admin
      .from('customer_profiles')
      .select('strikes')
      .eq('user_id', dispute.opened_by)
      .single()
    const currentStrikes = (cpRow as { strikes: number } | null)?.strikes ?? 0
    const newStrikes = currentStrikes + 1
    await admin
      .from('customer_profiles')
      .update({ strikes: newStrikes })
      .eq('user_id', dispute.opened_by)
    if (newStrikes >= 3) {
      await admin
        .from('profiles')
        .update({ status: 'suspended' })
        .eq('id', dispute.opened_by)
    }
  }

  // Mensagem admin na thread
  await admin.from('dispute_messages').insert({
    dispute_id: disputeId,
    author_id: user.id,
    author_role: 'admin',
    body: `✅ Decisão: **${decision}**\n\n${justification}`,
  })

  // Audit trail
  await admin.from('service_order_events').insert({
    request_id: dispute.order_id,
    from_status: 'disputed',
    to_status: newOrderStatus,
    actor_id: user.id,
    actor_role: 'admin',
    payload: { dispute_id: disputeId, decision, justification },
  })

  await admin.from('financial_events').insert({
    event_type: 'dispute_release',
    order_id: dispute.order_id,
    metadata: {
      dispute_id: disputeId,
      decision,
      resolved_by: user.id,
      resolved_at: now,
      final_value_cents: req.final_value_cents,
    },
  })

  await admin.from('admin_actions').insert({
    actor_id: user.id,
    action_type: 'resolve_dispute',
    target_type: 'dispute',
    target_id: disputeId,
    payload: { decision, justification, order_id: dispute.order_id },
  })

  redirect(`/admin/disputas/${disputeId}?resolved=1`)
}
