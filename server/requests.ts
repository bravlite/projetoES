'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createAsaasCustomer, createPixPayment } from '@/lib/asaas'

// -----------------------------------------------------------------------
// createServiceRequest
// Cliente cria pedido. Admin client usado para inserção + log de evento.
// -----------------------------------------------------------------------
export async function createServiceRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const categorySlug = (formData.get('category_slug') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const neighborhood = (formData.get('neighborhood') as string)?.trim()

  if (!categorySlug || !description || !neighborhood) {
    return { error: 'Categoria, descrição e bairro são obrigatórios.' }
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: req, error } = await (admin as any)
    .from('service_requests')
    .insert({
      customer_id: user.id,
      category_slug: categorySlug,
      description,
      neighborhood,
      city: (formData.get('city') as string) || 'Vitória',
      street: (formData.get('street') as string) || null,
      number: (formData.get('number') as string) || null,
      complement: (formData.get('complement') as string) || null,
      desired_date: (formData.get('desired_date') as string) || null,
      desired_period: (formData.get('desired_period') as string) || 'anytime',
      urgency: (formData.get('urgency') as string) || 'flexible',
      status: 'requested',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('service_order_events').insert({
    request_id: req.id,
    from_status: null,
    to_status: 'requested',
    actor_id: user.id,
    actor_role: 'customer',
    payload: { category_slug: categorySlug },
  })

  redirect(`/pedidos/${req.id}`)
}

// -----------------------------------------------------------------------
// submitQuote
// Prestador envia orçamento. Avança status do pedido para 'quoted'.
// -----------------------------------------------------------------------
export async function submitQuote(
  requestId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const admin = createAdminClient()

  // Busca provider_profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pp } = await (admin as any)
    .from('provider_profiles')
    .select('id, approved')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as { id: string; approved: boolean } | null
  if (!providerProfile?.approved) {
    return { error: 'Perfil não aprovado. Aguarde a aprovação do admin.' }
  }

  const valueStr = (formData.get('value') as string)?.trim()
  const valueCents = Math.round(parseFloat(valueStr) * 100)
  if (!valueStr || isNaN(valueCents) || valueCents <= 0) {
    return { error: 'Valor inválido. Informe um valor maior que zero.' }
  }

  const estimatedMinutesStr = formData.get('estimated_minutes') as string
  const estimatedMinutes =
    estimatedMinutesStr ? parseInt(estimatedMinutesStr, 10) : null
  const notes = (formData.get('notes') as string) || null

  // Verifica que o pedido está disponível
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sr } = await (admin as any)
    .from('service_requests')
    .select('id, status')
    .eq('id', requestId)
    .single()
  const serviceRequest = sr as { id: string; status: string } | null
  if (!serviceRequest) return { error: 'Pedido não encontrado.' }
  if (serviceRequest.status !== 'requested' && serviceRequest.status !== 'quoted') {
    return { error: 'Este pedido não está disponível para orçamento.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: quoteErr } = await (admin as any).from('service_quotes').insert({
    request_id: requestId,
    provider_id: providerProfile.id,
    value_cents: valueCents,
    estimated_minutes: estimatedMinutes,
    notes,
    status: 'pending',
  })

  if (quoteErr) {
    if (quoteErr.code === '23505') {
      return { error: 'Você já enviou um orçamento para este pedido.' }
    }
    return { error: quoteErr.message }
  }

  // Avança status para 'quoted' se ainda estava em 'requested'
  if (serviceRequest.status === 'requested') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('service_requests')
      .update({ status: 'quoted' })
      .eq('id', requestId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('service_order_events').insert({
      request_id: requestId,
      from_status: 'requested',
      to_status: 'quoted',
      actor_id: user.id,
      actor_role: 'provider',
      payload: { provider_id: providerProfile.id, value_cents: valueCents },
    })
  }

  redirect(`/pedidos/${requestId}`)
}

// -----------------------------------------------------------------------
// acceptQuote
// Cliente aceita um orçamento. Rejeita os demais. Avança para quote_accepted.
// Sempre chama redirect() — nunca retorna normalmente.
// -----------------------------------------------------------------------
export async function acceptQuote(quoteId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: q } = await (admin as any)
    .from('service_quotes')
    .select('id, request_id, provider_id, value_cents, status')
    .eq('id', quoteId)
    .single()
  const quote = q as {
    id: string
    request_id: string
    provider_id: string
    value_cents: number
    status: string
  } | null

  if (!quote || quote.status !== 'pending') {
    // Redireciona de volta com erro no query param
    redirect(`/pedidos?error=Orçamento inválido ou já processado.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: r } = await (admin as any)
    .from('service_requests')
    .select('id, status, customer_id')
    .eq('id', quote.request_id)
    .single()
  const req = r as { id: string; status: string; customer_id: string } | null

  if (!req || req.customer_id !== user.id) {
    redirect(`/pedidos?error=Sem permissão.`)
  }

  // Aceita este orçamento
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('service_quotes').update({ status: 'accepted' }).eq('id', quoteId)

  // Rejeita os demais
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('service_quotes')
    .update({ status: 'rejected' })
    .eq('request_id', quote.request_id)
    .neq('id', quoteId)
    .eq('status', 'pending')

  // Atualiza o pedido
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('service_requests').update({
    status: 'quote_accepted',
    accepted_quote_id: quoteId,
    current_provider_id: quote.provider_id,
    final_value_cents: quote.value_cents,
  }).eq('id', quote.request_id)

  // Log de evento: quote_accepted
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('service_order_events').insert({
    request_id: quote.request_id,
    from_status: req.status,
    to_status: 'quote_accepted',
    actor_id: user.id,
    actor_role: 'customer',
    payload: { accepted_quote_id: quoteId, value_cents: quote.value_cents },
  })

  // ── Gera cobrança Pix ──────────────────────────────────────────────────────
  try {
    // Busca perfil do cliente para obter nome e asaas_customer_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cp } = await (admin as any)
      .from('customer_profiles')
      .select('full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .single()
    const customerProfile = cp as { full_name: string | null; asaas_customer_id: string | null } | null

    // Cria ou reutiliza cliente Asaas
    let asaasCustomerId = customerProfile?.asaas_customer_id ?? null
    if (!asaasCustomerId) {
      asaasCustomerId = await createAsaasCustomer({
        name: customerProfile?.full_name ?? 'Cliente',
        email: user.email ?? '',
        externalReference: user.id,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('customer_profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('user_id', user.id)
    }

    // Gera cobrança Pix
    const pix = await createPixPayment({
      asaasCustomerId,
      valueCents: quote.value_cents,
      description: `Serviço #${quote.request_id.slice(0, 8).toUpperCase()}`,
      externalReference: quote.request_id,
    })

    // Insere registro de pagamento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('payments').insert({
      order_id: quote.request_id,
      customer_id: user.id,
      amount_cents: quote.value_cents,
      psp_provider: 'asaas',
      psp_charge_id: pix.chargeId,
      psp_pix_qr: pix.pixQrBase64 || null,
      psp_pix_copy_paste: pix.pixPayload,
      status: 'pending',
      expires_at: pix.expiresAt.toISOString(),
    })

    // Avança pedido para awaiting_payment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('service_requests')
      .update({ status: 'awaiting_payment' })
      .eq('id', quote.request_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('service_order_events').insert({
      request_id: quote.request_id,
      from_status: 'quote_accepted',
      to_status: 'awaiting_payment',
      actor_id: null,
      actor_role: 'system',
      payload: { psp_charge_id: pix.chargeId, is_mock: pix.isMock },
    })

    redirect(`/pedidos/${quote.request_id}/pagamento`)
  } catch {
    // Falha ao gerar Pix: pedido fica em quote_accepted, cliente pode tentar novamente
    redirect(`/pedidos/${quote.request_id}`)
  }
}

// -----------------------------------------------------------------------
// regeneratePixCharge
// Cliente solicita novo Pix quando o anterior expirou.
// Só permitido se pedido está em awaiting_payment.
// -----------------------------------------------------------------------
export async function regeneratePixCharge(orderId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Verifica pedido
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: r } = await (admin as any)
    .from('service_requests')
    .select('id, status, customer_id, final_value_cents, current_provider_id')
    .eq('id', orderId)
    .single()
  const req = r as {
    id: string
    status: string
    customer_id: string
    final_value_cents: number | null
    current_provider_id: string | null
  } | null

  if (!req || req.customer_id !== user.id) redirect('/pedidos')
  if (req.status !== 'awaiting_payment' && req.status !== 'quote_accepted') {
    redirect(`/pedidos/${orderId}`)
  }

  // Expira o pagamento pendente atual
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('payments')
    .update({ status: 'expired' })
    .eq('order_id', orderId)
    .eq('status', 'pending')

  try {
    // Busca perfil do cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cp } = await (admin as any)
      .from('customer_profiles')
      .select('full_name, asaas_customer_id')
      .eq('user_id', user.id)
      .single()
    const customerProfile = cp as { full_name: string | null; asaas_customer_id: string | null } | null

    let asaasCustomerId = customerProfile?.asaas_customer_id ?? null
    if (!asaasCustomerId) {
      asaasCustomerId = await createAsaasCustomer({
        name: customerProfile?.full_name ?? 'Cliente',
        email: user.email ?? '',
        externalReference: user.id,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('customer_profiles')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('user_id', user.id)
    }

    const valueCents = req.final_value_cents ?? 0
    const pix = await createPixPayment({
      asaasCustomerId,
      valueCents,
      description: `Serviço #${orderId.slice(0, 8).toUpperCase()} (renovado)`,
      externalReference: orderId,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('payments').insert({
      order_id: orderId,
      customer_id: user.id,
      amount_cents: valueCents,
      psp_provider: 'asaas',
      psp_charge_id: pix.chargeId,
      psp_pix_qr: pix.pixQrBase64 || null,
      psp_pix_copy_paste: pix.pixPayload,
      status: 'pending',
      expires_at: pix.expiresAt.toISOString(),
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('service_requests')
      .update({ status: 'awaiting_payment' })
      .eq('id', orderId)
  } catch {
    // Falha silenciosa — o status do pedido volta para quote_accepted para tentar de novo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('service_requests')
      .update({ status: 'quote_accepted' })
      .eq('id', orderId)
  }

  redirect(`/pedidos/${orderId}/pagamento`)
}
