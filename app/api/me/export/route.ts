// GET /api/me/export — LGPD: exporta todos os dados do usuário autenticado
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient() as any

  // Coleta todos os dados associados ao usuário
  const [
    { data: profile },
    { data: customerProfile },
    { data: providerProfile },
    { data: addresses },
    { data: requests },
    { data: quotes },
    { data: payments },
    { data: payouts },
    { data: reviews },
    { data: disputes },
    { data: disputeMessages },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('provider_profiles').select('id, display_name, phone, bio, categories, neighborhoods, approved, created_at').eq('user_id', user.id).maybeSingle(),
    admin.from('addresses').select('*').eq('user_id', user.id),
    admin.from('service_requests').select('id, category_slug, description, status, neighborhood, city, final_value_cents, created_at').eq('customer_id', user.id),
    // quotes do prestador (se houver provider profile)
    admin.from('service_quotes').select('*').eq('provider_id',
      (await admin.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    ),
    admin.from('payments').select('id, order_id, amount_cents, status, paid_at, created_at').eq('customer_id', user.id),
    // payouts (via provider_id)
    admin.from('payouts').select('id, order_id, gross_cents, commission_cents, net_cents, status, paid_at').eq('provider_id',
      (await admin.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    ),
    admin.from('service_reviews').select('*').eq('reviewer_id', user.id),
    admin.from('disputes').select('id, order_id, reason_code, status, decision, created_at').eq('opened_by', user.id),
    admin.from('dispute_messages').select('id, dispute_id, body, created_at').eq('author_id', user.id),
  ])

  const export_data = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile,
    customer_profile: customerProfile ?? null,
    provider_profile: providerProfile ?? null,
    addresses: addresses ?? [],
    service_requests: requests ?? [],
    service_quotes: quotes ?? [],
    payments: payments ?? [],
    payouts: payouts ?? [],
    reviews: reviews ?? [],
    disputes: disputes ?? [],
    dispute_messages: disputeMessages ?? [],
  }

  return new Response(JSON.stringify(export_data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
