'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Lockout: 5 tentativas erradas em 15 minutos
const MAX_CHECKIN_ATTEMPTS = 5
const CHECKIN_WINDOW_MS = 15 * 60 * 1000

// -----------------------------------------------------------------------
// submitCheckIn
// Prestador digita o código de 6 dígitos fornecido pelo cliente.
// Rate limit: 5 tentativas incorretas em 15 min bloqueia por 15 min.
// -----------------------------------------------------------------------
export async function submitCheckIn(
  requestId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const code = ((formData.get('code') as string) ?? '').trim()
  if (!code) return { error: 'Informe o código.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // Busca provider_profile
  const { data: pp } = await admin
    .from('provider_profiles')
    .select('id, approved')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as { id: string; approved: boolean } | null
  if (!providerProfile?.approved) return { error: 'Perfil não aprovado.' }

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, check_in_code, current_provider_id')
    .eq('id', requestId)
    .single()
  const req = r as {
    id: string
    status: string
    check_in_code: string | null
    current_provider_id: string | null
  } | null

  if (!req) return { error: 'Pedido não encontrado.' }
  if (req.current_provider_id !== providerProfile.id) {
    return { error: 'Você não está atribuído a este pedido.' }
  }
  if (req.status !== 'payment_confirmed') {
    return { error: 'Check-in não está disponível para este pedido no momento.' }
  }

  // Rate limit: conta tentativas erradas nos últimos 15 min
  const windowStart = new Date(Date.now() - CHECKIN_WINDOW_MS).toISOString()
  const { count: failedCount } = await admin
    .from('check_in_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId)
    .eq('provider_id', providerProfile.id)
    .eq('success', false)
    .gte('attempted_at', windowStart)

  if ((failedCount ?? 0) >= MAX_CHECKIN_ATTEMPTS) {
    return { error: 'Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente.' }
  }

  const isCorrect = req.check_in_code === code

  // Registra tentativa (antes de validar para contar a tentativa atual)
  await admin.from('check_in_attempts').insert({
    request_id: requestId,
    provider_id: providerProfile.id,
    success: isCorrect,
  })

  if (!isCorrect) {
    const remaining = MAX_CHECKIN_ATTEMPTS - (failedCount ?? 0) - 1
    return {
      error:
        remaining > 0
          ? `Código incorreto. ${remaining} tentativa(s) restante(s).`
          : 'Código incorreto. Você foi bloqueado por 15 minutos.',
    }
  }

  // Avança para checked_in
  const now = new Date().toISOString()
  await admin
    .from('service_requests')
    .update({ status: 'checked_in', check_in_code_used_at: now })
    .eq('id', requestId)

  await admin.from('service_order_events').insert({
    request_id: requestId,
    from_status: 'payment_confirmed',
    to_status: 'checked_in',
    actor_id: user.id,
    actor_role: 'provider',
    payload: { provider_id: providerProfile.id },
  })

  redirect(`/pedidos/${requestId}/evidencias`)
}

// -----------------------------------------------------------------------
// startService
// Prestador clica "Iniciar serviço". checked_in → in_progress.
// -----------------------------------------------------------------------
export async function startService(requestId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pp } = await admin
    .from('provider_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as { id: string } | null
  if (!providerProfile) redirect('/login')

  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, current_provider_id')
    .eq('id', requestId)
    .single()
  const req = r as { id: string; status: string; current_provider_id: string | null } | null

  if (!req || req.current_provider_id !== providerProfile.id || req.status !== 'checked_in') {
    redirect(`/pedidos/${requestId}`)
  }

  await admin.from('service_requests').update({ status: 'in_progress' }).eq('id', requestId)

  await admin.from('service_order_events').insert({
    request_id: requestId,
    from_status: 'checked_in',
    to_status: 'in_progress',
    actor_id: user.id,
    actor_role: 'provider',
    payload: {},
  })

  redirect(`/pedidos/${requestId}/evidencias`)
}

// -----------------------------------------------------------------------
// addEvidence
// Prestador faz upload de foto (before/during/after) via server action.
// O arquivo passa pelo servidor Next.js antes de ir para o Storage.
// Máximo 5MB por arquivo.
// -----------------------------------------------------------------------
export async function addEvidence(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const requestId = ((formData.get('request_id') as string) ?? '').trim()
  const kind = ((formData.get('kind') as string) ?? '').trim() as 'before' | 'during' | 'after'
  const notes = (formData.get('notes') as string) || null
  const file = formData.get('file') as File | null

  if (!requestId || !kind) return { error: 'Dados inválidos.' }
  if (!['before', 'during', 'after'].includes(kind)) return { error: 'Tipo de foto inválido.' }
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Arquivo muito grande. Máximo 5MB.' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Formato não suportado. Use JPEG, PNG ou WebP.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pp } = await admin
    .from('provider_profiles')
    .select('id, approved')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as { id: string; approved: boolean } | null
  if (!providerProfile?.approved) return { error: 'Perfil não aprovado.' }

  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, current_provider_id')
    .eq('id', requestId)
    .single()
  const req = r as { id: string; status: string; current_provider_id: string | null } | null

  if (!req || req.current_provider_id !== providerProfile.id) {
    return { error: 'Sem permissão para este pedido.' }
  }
  if (!['checked_in', 'in_progress'].includes(req.status)) {
    return { error: 'Status inválido para upload de evidência.' }
  }

  // Upload para Supabase Storage (bucket 'evidence')
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const filePath = `${requestId}/${providerProfile.id}/${kind}_${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('evidence')
    .upload(filePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return { error: `Erro no upload: ${uploadError.message}` }
  }

  // Captura IP para audit (best-effort)
  const headersList = headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
    headersList.get('x-real-ip') ??
    null

  await admin.from('service_evidence').insert({
    request_id: requestId,
    provider_id: providerProfile.id,
    kind,
    file_path: filePath,
    notes,
    client_ip: ip,
  })

  return {}
}

// -----------------------------------------------------------------------
// markCompleted
// Prestador marca o serviço como concluído.
// Exige pelo menos 1 evidência 'after'. in_progress → completed_by_provider.
// -----------------------------------------------------------------------
export async function markCompleted(requestId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: pp } = await admin
    .from('provider_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as { id: string } | null
  if (!providerProfile) redirect('/login')

  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, current_provider_id')
    .eq('id', requestId)
    .single()
  const req = r as { id: string; status: string; current_provider_id: string | null } | null

  if (!req || req.current_provider_id !== providerProfile.id) {
    redirect(`/pedidos/${requestId}`)
  }
  if (req.status !== 'in_progress') {
    redirect(`/pedidos/${requestId}/evidencias`)
  }

  // Verifica que existe pelo menos 1 evidência 'after'
  const { count: afterCount } = await admin
    .from('service_evidence')
    .select('*', { count: 'exact', head: true })
    .eq('request_id', requestId)
    .eq('provider_id', providerProfile.id)
    .eq('kind', 'after')

  if (!afterCount || afterCount === 0) {
    redirect(`/pedidos/${requestId}/evidencias?missing=after`)
  }

  await admin
    .from('service_requests')
    .update({ status: 'completed_by_provider' })
    .eq('id', requestId)

  await admin.from('service_order_events').insert({
    request_id: requestId,
    from_status: 'in_progress',
    to_status: 'completed_by_provider',
    actor_id: user.id,
    actor_role: 'provider',
    payload: { after_evidence_count: afterCount },
  })

  redirect(`/pedidos/${requestId}`)
}

// -----------------------------------------------------------------------
// confirmCompletion
// Cliente aprova conclusão do serviço.
// completed_by_provider → accepted_by_customer. Payout vira eligible.
// -----------------------------------------------------------------------
export async function confirmCompletion(requestId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, customer_id')
    .eq('id', requestId)
    .single()
  const req = r as { id: string; status: string; customer_id: string } | null

  if (!req || req.customer_id !== user.id) redirect('/pedidos')
  if (req.status !== 'completed_by_provider') redirect(`/pedidos/${requestId}`)

  const now = new Date().toISOString()

  await admin
    .from('service_requests')
    .update({ status: 'accepted_by_customer' })
    .eq('id', requestId)

  // Payout vira elegível para repasse
  await admin
    .from('payouts')
    .update({ status: 'eligible', eligible_at: now })
    .eq('order_id', requestId)
    .eq('status', 'pending')

  await admin.from('service_order_events').insert({
    request_id: requestId,
    from_status: 'completed_by_provider',
    to_status: 'accepted_by_customer',
    actor_id: user.id,
    actor_role: 'customer',
    payload: {},
  })

  await admin.from('financial_events').insert({
    event_type: 'payout_eligible',
    order_id: requestId,
    metadata: { confirmed_by: 'customer', confirmed_at: now },
  })

  redirect(`/pedidos/${requestId}`)
}
