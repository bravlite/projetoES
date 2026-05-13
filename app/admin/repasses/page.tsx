import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminRepassesPage() {
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

  // Busca payouts elegíveis (prontos para pagar) + informações do pedido e prestador
  const { data: rawPayouts } = await admin
    .from('payouts')
    .select('id, order_id, provider_id, net_cents, gross_cents, commission_cents, eligible_at, created_at')
    .eq('status', 'eligible')
    .order('net_cents', { ascending: false })

  type PayoutRow = {
    id: string
    order_id: string
    provider_id: string
    net_cents: number
    gross_cents: number
    commission_cents: number
    eligible_at: string | null
    created_at: string
    provider_name?: string
    category_slug?: string
  }

  const payouts = (rawPayouts as PayoutRow[]) ?? []

  // Enriquece com nome do prestador e categoria
  const enriched = await Promise.all(
    payouts.map(async (p) => {
      const [{ data: pp }, { data: req }] = await Promise.all([
        admin.from('provider_profiles').select('display_name').eq('id', p.provider_id).single(),
        admin.from('service_requests').select('category_slug').eq('id', p.order_id).single(),
      ])
      return {
        ...p,
        provider_name: (pp as { display_name: string | null } | null)?.display_name ?? 'Prestador',
        category_slug: (req as { category_slug: string } | null)?.category_slug ?? null,
      }
    })
  )

  const totalEligible = enriched.reduce((sum, p) => sum + p.net_cents, 0)

  // Histórico recente (últimos 10 pagos)
  const { data: rawRecent } = await admin
    .from('payouts')
    .select('id, order_id, provider_id, net_cents, paid_at, confirmation_id')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(10)

  const recent = (rawRecent as {
    id: string
    order_id: string
    provider_id: string
    net_cents: number
    paid_at: string | null
    confirmation_id: string | null
  }[]) ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Repasses pendentes</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-700">
            R$ {(totalEligible / 100).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">{enriched.length} repasse{enriched.length !== 1 ? 's' : ''} a executar</p>
        </div>
      </div>

      {/* Fila elegível */}
      {enriched.length === 0 ? (
        <div className="mb-8 rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhum repasse pendente.</p>
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Prestador</th>
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-right">Líquido</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                <th className="px-4 py-3 text-left">Elegível em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enriched.map((p) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.slug === p.category_slug)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.provider_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {cat?.label ?? p.category_slug ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      R$ {(p.net_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      R$ {(p.gross_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.eligible_at
                        ? new Date(p.eligible_at).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/repasses/${p.id}`}
                        className="font-medium text-brand-600 hover:text-brand-800"
                      >
                        Executar →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico recente */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Últimos pagos
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-right">Valor líquido</th>
                  <th className="px-4 py-3 text-left">Confirmação</th>
                  <th className="px-4 py-3 text-left">Pago em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((r) => (
                  <tr key={r.id} className="text-gray-600 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{r.order_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      R$ {(r.net_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {r.confirmation_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.paid_at ? new Date(r.paid_at).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
