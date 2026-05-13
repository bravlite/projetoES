'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'

// ------------------------------------------------------------
// submitReview — cliente avalia o prestador pós-conclusão
// ------------------------------------------------------------
export async function submitReview(
  requestId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Só cliente
  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'customer') return { error: 'Ação permitida apenas para clientes.' }

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, customer_id, current_provider_id')
    .eq('id', requestId)
    .single()
  const req = r as {
    id: string
    status: string
    customer_id: string
    current_provider_id: string | null
  } | null

  if (!req) return { error: 'Pedido não encontrado.' }
  if (req.customer_id !== user.id) return { error: 'Acesso negado.' }
  if (!['accepted_by_customer', 'auto_accepted'].includes(req.status)) {
    return { error: 'Avaliação disponível apenas após conclusão do serviço.' }
  }
  if (!req.current_provider_id) return { error: 'Pedido sem prestador atribuído.' }

  // Impede avaliação duplicada
  const { data: existing } = await admin
    .from('service_reviews')
    .select('id')
    .eq('order_id', requestId)
    .maybeSingle()
  if (existing) return { error: 'Você já avaliou este serviço.' }

  const ratingRaw = parseInt(formData.get('rating') as string, 10)
  if (!ratingRaw || ratingRaw < 1 || ratingRaw > 5) {
    return { error: 'Selecione uma nota de 1 a 5.' }
  }
  const comment = (formData.get('comment') as string | null)?.trim() || null

  const { error: insertErr } = await admin.from('service_reviews').insert({
    order_id: requestId,
    reviewer_id: user.id,
    provider_id: req.current_provider_id,
    rating: ratingRaw,
    comment,
  })

  if (insertErr) return { error: 'Erro ao salvar avaliação. Tente novamente.' }

  redirect(`/pedidos/${requestId}?reviewed=1`)
}
