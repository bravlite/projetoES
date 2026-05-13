import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${highlight ? 'border-brand-200 bg-brand-50' : 'border-gray-200'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${highlight ? 'text-brand-700' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export default async function MetricasPage() {
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

  // Janela de tempo
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const COMPLETED_STATUSES = ['accepted_by_customer', 'auto_accepted', 'payout_released']
  const ACTIVE_STATUSES = [
    'requested', 'quoted', 'quote_accepted', 'awaiting_payment',
    'payment_confirmed', 'checked_in', 'in_progress', 'completed_by_provider',
  ]

  // Busca tudo em paralelo
  const [
    { data: paymentsMonth },
    { data: paymentsLastMonth },
    { count: activeCount },
    { count: disputesOpen },
    { count: pendingProviders },
    { data: eligiblePayouts },
    { data: allDisputes },
    { data: completedMonth },
    { data: completedLastMonth },
    { data: recentEvents },
  ] = await Promise.all([
    // GMV do mês atual
    admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'paid')
      .gte('paid_at', monthStart),
    // GMV mês anterior
    admin
      .from('payments')
      .select('amount_cents')
      .eq('status', 'paid')
      .gte('paid_at', lastMonthStart)
      .lt('paid_at', monthStart),
    // Pedidos ativos agora
    admin
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ACTIVE_STATUSES),
    // Disputas abertas
    admin
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved'),
    // Prestadores pendentes
    admin
      .from('provider_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approved', false),
    // Repasses elegíveis
    admin
      .from('payouts')
      .select('net_cents')
      .eq('status', 'eligible'),
    // Todas disputas (para taxa)
    admin.from('disputes').select('id'),
    // Concluídos no mês — para ticket médio e taxa
    admin
      .from('service_requests')
      .select('final_value_cents, updated_at')
      .in('status', COMPLETED_STATUSES)
      .gte('updated_at', monthStart),
    // Concluídos mês anterior
    admin
      .from('service_requests')
      .select('final_value_cents')
      .in('status', COMPLETED_STATUSES)
      .gte('updated_at', lastMonthStart)
      .lt('updated_at', monthStart),
    // Eventos financeiros recentes
    admin
      .from('financial_events')
      .select('event_type, amount_cents, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // --- Cálculos ---

  const gmvMonth = ((paymentsMonth as { amount_cents: number }[]) ?? [])
    .reduce((s, p) => s + p.amount_cents, 0)
  const gmvLastMonth = ((paymentsLastMonth as { amount_cents: number }[]) ?? [])
    .reduce((s, p) => s + p.amount_cents, 0)
  const gmvDelta = gmvLastMonth > 0
    ? Math.round(((gmvMonth - gmvLastMonth) / gmvLastMonth) * 100)
    : null

  const eligibleTotal = ((eligiblePayouts as { net_cents: number }[]) ?? [])
    .reduce((s, p) => s + p.net_cents, 0)

  const completedMonthList = (completedMonth as { final_value_cents: number | null }[]) ?? []
  const completedLastMonthList = (completedLastMonth as { final_value_cents: number | null }[]) ?? []
  const completedThisMonthCount = completedMonthList.length

  const ticketValues = completedMonthList
    .map((r) => r.final_value_cents)
    .filter((v): v is number => v != null)
  const ticketMedio = ticketValues.length > 0
    ? ticketValues.reduce((s, v) => s + v, 0) / ticketValues.length
    : null

  const totalDisputas = ((allDisputes as { id: string }[]) ?? []).length
  const totalCompleted = completedThisMonthCount + completedLastMonthList.length
  const taxaDisputa = totalCompleted > 0
    ? ((totalDisputas / totalCompleted) * 100).toFixed(1)
    : '—'

  const events = (recentEvents as { event_type: string; amount_cents: number | null; created_at: string }[]) ?? []

  const EVENT_LABELS: Record<string, string> = {
    payment_received: 'Pagamento recebido',
    payout_eligible: 'Repasse liberado',
    payout_paid: 'Repasse executado',
    refund_issued: 'Reembolso emitido',
    dispute_freeze: 'Disputa aberta',
    dispute_release: 'Disputa resolvida',
    commission_calculated: 'Comissão calculada',
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Métricas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Export CSV */}
        <div className="flex flex-col gap-2 text-right">
          <a
            href="/api/admin/export/pedidos"
            className="text-xs text-brand-600 hover:underline"
          >
            ↓ Exportar pedidos CSV
          </a>
          <a
            href="/api/admin/export/repasses"
            className="text-xs text-brand-600 hover:underline"
          >
            ↓ Exportar repasses CSV
          </a>
          <a
            href="/api/admin/export/disputas"
            className="text-xs text-brand-600 hover:underline"
          >
            ↓ Exportar disputas CSV
          </a>
        </div>
      </div>

      {/* 8 métricas principais */}
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="GMV do mês"
          value={`R$ ${(gmvMonth / 100).toFixed(2)}`}
          sub={gmvDelta != null ? `${gmvDelta >= 0 ? '+' : ''}${gmvDelta}% vs mês anterior` : undefined}
          highlight
        />
        <MetricCard
          label="Concluídos no mês"
          value={String(completedThisMonthCount)}
          sub={`mês anterior: ${completedLastMonthList.length}`}
        />
        <MetricCard
          label="Ticket médio"
          value={ticketMedio != null ? `R$ ${(ticketMedio / 100).toFixed(2)}` : '—'}
          sub="pedidos concluídos do mês"
        />
        <MetricCard
          label="Taxa de disputa"
          value={`${taxaDisputa}%`}
          sub={`meta: < 8%`}
        />
        <MetricCard
          label="Pedidos ativos"
          value={String(activeCount ?? 0)}
          sub="em andamento agora"
        />
        <MetricCard
          label="Disputas abertas"
          value={String(disputesOpen ?? 0)}
          sub={disputesOpen ? 'ver fila de disputas' : 'nenhuma pendente'}
        />
        <MetricCard
          label="Repasses a executar"
          value={`R$ ${(eligibleTotal / 100).toFixed(2)}`}
          sub="payouts eligible"
        />
        <MetricCard
          label="Prestadores pendentes"
          value={String(pendingProviders ?? 0)}
          sub="aguardando aprovação"
        />
      </div>

      {/* Feed de eventos financeiros recentes */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Últimos eventos financeiros
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum evento ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Evento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-left">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((ev, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {ev.amount_cents != null
                        ? `R$ ${(ev.amount_cents / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(ev.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
