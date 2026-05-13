import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-gray-500">Configure Supabase em .env.local.</p>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'admin') redirect('/')

  // Counters para o dashboard
  const [
    { count: pendingProviders },
    { count: openDisputes },
    { count: awaitingAdminDisputes },
    { count: pendingPayouts },
    { count: activeRequests },
  ] = await Promise.all([
    admin.from('provider_profiles').select('id', { count: 'exact', head: true }).eq('approved', false),
    admin.from('disputes').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    admin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_admin'),
    admin.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'eligible'),
    admin
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['requested', 'quoted', 'quote_accepted', 'awaiting_payment', 'payment_confirmed', 'checked_in', 'in_progress']),
  ])

  const CARDS = [
    {
      label: 'Prestadores pendentes',
      href: '/admin/prestadores',
      count: pendingProviders as number | null,
      urgent: (pendingProviders as number) > 0,
      implemented: false,
    },
    {
      label: 'Pedidos ativos',
      href: '/admin/pedidos',
      count: activeRequests as number | null,
      urgent: false,
      implemented: false,
    },
    {
      label: 'Disputas',
      href: '/admin/disputas',
      count: openDisputes as number | null,
      urgent: (awaitingAdminDisputes as number) > 0,
      implemented: true,
    },
    {
      label: 'Repasses pendentes',
      href: '/admin/repasses',
      count: pendingPayouts as number | null,
      urgent: (pendingPayouts as number) > 0,
      implemented: true,
    },
    {
      label: 'Usuários',
      href: '/admin/usuarios',
      count: null,
      urgent: false,
      implemented: false,
    },
    {
      label: 'Categorias',
      href: '/admin/categorias',
      count: null,
      urgent: false,
      implemented: false,
    },
    {
      label: 'Comissão',
      href: '/admin/comissao',
      count: null,
      urgent: false,
      implemented: false,
    },
    {
      label: 'Métricas',
      href: '/admin/metricas',
      count: null,
      urgent: false,
      implemented: true,
    },
    {
      label: 'Auditoria',
      href: '/admin/auditoria',
      count: null,
      urgent: false,
      implemented: false,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Admin</h1>

      {(awaitingAdminDisputes as number) > 0 && (
        <div className="mb-6 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {awaitingAdminDisputes} disputa{(awaitingAdminDisputes as number) > 1 ? 's' : ''}{' '}
          aguardando decisão.{' '}
          <Link href="/admin/disputas" className="font-semibold underline">
            Revisar agora →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARDS.map((card) =>
          card.implemented ? (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-lg border p-4 transition hover:shadow-sm ${
                card.urgent
                  ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <p className={`text-sm font-medium ${card.urgent ? 'text-blue-700' : 'text-gray-700'}`}>
                {card.label}
              </p>
              {card.count != null && (
                <p className={`mt-1 text-2xl font-bold ${card.urgent ? 'text-blue-700' : 'text-gray-900'}`}>
                  {card.count}
                </p>
              )}
            </Link>
          ) : (
            <div
              key={card.label}
              title="Não implementado ainda"
              className="cursor-not-allowed rounded-lg border border-gray-200 p-4"
            >
              <p className="text-sm font-medium text-gray-400">{card.label}</p>
              {card.count != null && (
                <p className="mt-1 text-2xl font-bold text-gray-300">{card.count}</p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
