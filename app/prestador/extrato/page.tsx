import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import type { ProviderProfile, Payout } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  holding: 'Em espera',
  eligible: 'Aguardando repasse',
  paid: 'Pago',
  blocked: 'Bloqueado (disputa)',
  refunded_to_customer: 'Reembolsado ao cliente',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  holding: 'bg-yellow-100 text-yellow-700',
  eligible: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  refunded_to_customer: 'bg-gray-100 text-gray-500',
}

export default async function ExtratoPrestadorPage() {
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

  const { data: rawPP } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  const pp = rawPP as ProviderProfile | null
  if (!pp) redirect('/prestador')

  const admin = createAdminClient() as any

  // Busca todos os payouts do prestador
  const { data: rawPayouts } = await admin
    .from('payouts')
    .select('id, order_id, gross_cents, commission_cents, net_cents, commission_rate, status, eligible_at, paid_at, method, confirmation_id, created_at')
    .eq('provider_id', pp.id)
    .order('created_at', { ascending: false })

  type PayoutRow = Payout & { order_category?: string }
  const payouts = (rawPayouts as Payout[]) ?? []

  // Enriquece com categoria do pedido
  const payoutsEnriched = await Promise.all(
    payouts.map(async (p) => {
      const { data: r } = await admin
        .from('service_requests')
        .select('category_slug')
        .eq('id', p.order_id)
        .single()
      return {
        ...p,
        category_slug: (r as { category_slug: string } | null)?.category_slug ?? null,
      }
    })
  )

  // Totais
  const totalPaid = payoutsEnriched
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.net_cents, 0)
  const totalEligible = payoutsEnriched
    .filter((p) => p.status === 'eligible')
    .reduce((sum, p) => sum + p.net_cents, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6">
        <Link href="/prestador" className="text-sm text-gray-400 hover:text-gray-600">
          ← Meu perfil
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Extrato financeiro</h1>
      </div>

      {/* Resumo */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            Total recebido
          </p>
          <p className="mt-1 text-2xl font-bold text-green-800">
            R$ {(totalPaid / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            A receber
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-800">
            R$ {(totalEligible / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Lista */}
      {payoutsEnriched.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">Nenhum repasse registrado ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                <th className="px-4 py-3 text-right">Comissão</th>
                <th className="px-4 py-3 text-right">Líquido</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payoutsEnriched.map((p) => {
                const cat = SERVICE_CATEGORIES.find((c) => c.slug === p.category_slug)
                const date = p.paid_at ?? p.eligible_at ?? p.created_at
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {cat?.label ?? p.category_slug ?? 'Serviço'}
                      </p>
                      <Link
                        href={`/pedidos/${p.order_id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Ver pedido →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      R$ {(p.gross_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500">
                      −R$ {(p.commission_cents / 100).toFixed(2)}
                      <span className="ml-1 text-xs text-gray-400">
                        ({(Number(p.commission_rate) * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      R$ {(p.net_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      {p.confirmation_id && (
                        <p className="mt-0.5 font-mono text-xs text-gray-400">
                          {p.confirmation_id}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(date).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
