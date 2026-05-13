import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  awaiting_provider: 'Aguard. prestador',
  awaiting_admin: 'Aguard. admin',
  resolved: 'Resolvida',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  awaiting_provider: 'bg-yellow-100 text-yellow-700',
  awaiting_admin: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

const REASON_LABELS: Record<string, string> = {
  service_incomplete: 'Serviço incompleto',
  quality_issue: 'Qualidade insatisfatória',
  no_show: 'Não compareceu',
  overcharge: 'Cobrança indevida',
  damage: 'Dano',
  other: 'Outro',
}

export default async function AdminDisputasPage() {
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

  // Busca disputas abertas ordenadas por urgência (valor desc, abertura asc)
  const { data: rawDisputes } = await admin
    .from('disputes')
    .select(`
      id,
      order_id,
      reason_code,
      status,
      created_at,
      service_requests!order_id (
        category_slug,
        final_value_cents
      )
    `)
    .neq('status', 'resolved')
    .order('created_at', { ascending: true })

  type DisputeRow = {
    id: string
    order_id: string
    reason_code: string
    status: string
    created_at: string
    service_requests: { category_slug: string; final_value_cents: number | null } | null
  }

  const disputes = ((rawDisputes as DisputeRow[]) ?? []).sort((a, b) => {
    const va = a.service_requests?.final_value_cents ?? 0
    const vb = b.service_requests?.final_value_cents ?? 0
    return vb - va // valor desc
  })

  // Busca totais para o cabeçalho
  const { data: rawAll } = await admin
    .from('disputes')
    .select('id, status')
  const allDisputes = (rawAll as { id: string; status: string }[]) ?? []
  const openCount = allDisputes.filter((d) => d.status !== 'resolved').length
  const awaitingAdmin = allDisputes.filter((d) => d.status === 'awaiting_admin').length

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Disputas</h1>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{openCount}</p>
            <p className="text-xs text-gray-500">abertas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{awaitingAdmin}</p>
            <p className="text-xs text-gray-500">aguard. admin</p>
          </div>
        </div>
      </div>

      {disputes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhuma disputa aberta.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Pedido</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Aberta em</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {disputes.map((d) => {
                const cat = SERVICE_CATEGORIES.find(
                  (c) => c.slug === d.service_requests?.category_slug
                )
                const valueCents = d.service_requests?.final_value_cents
                const hoursOpen = Math.floor(
                  (Date.now() - new Date(d.created_at).getTime()) / 3_600_000
                )
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {cat?.label ?? d.service_requests?.category_slug ?? '—'}
                      </p>
                      <p className="font-mono text-xs text-gray-400">
                        {d.order_id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {REASON_LABELS[d.reason_code] ?? d.reason_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {valueCents != null
                        ? `R$ ${(valueCents / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {hoursOpen < 24
                        ? `${hoursOpen}h atrás`
                        : `${Math.floor(hoursOpen / 24)}d atrás`}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/disputas/${d.id}`}
                        className="font-medium text-brand-600 hover:text-brand-800"
                      >
                        Revisar →
                      </Link>
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
