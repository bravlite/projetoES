import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import MarkPaidForm from './MarkPaidForm'
import type { Profile, Payout } from '@/types/database'

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

export default async function AdminRepasseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { paid?: string }
}) {
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

  // Busca payout
  const { data: rawPayout } = await admin
    .from('payouts')
    .select('*')
    .eq('id', params.id)
    .single()
  const payout = rawPayout as Payout | null
  if (!payout) notFound()

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, category_slug, description, status, final_value_cents')
    .eq('id', payout.order_id)
    .single()
  const req = r as {
    id: string
    category_slug: string
    description: string
    status: string
    final_value_cents: number | null
  } | null

  // Busca prestador
  const { data: pp } = await admin
    .from('provider_profiles')
    .select('display_name, phone')
    .eq('id', payout.provider_id)
    .single()
  const provider = pp as { display_name: string | null; phone: string | null } | null

  const cat = SERVICE_CATEGORIES.find((c) => c.slug === req?.category_slug)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href="/admin/repasses" className="text-sm text-gray-400 hover:text-gray-600">
          ← Repasses
        </Link>
      </div>

      {searchParams.paid === '1' && (
        <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Repasse registrado com sucesso.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Repasse #{params.id.slice(0, 8)}</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_COLORS[payout.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABELS[payout.status] ?? payout.status}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Prestador */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Prestador
          </h2>
          <p className="font-medium text-gray-900">{provider?.display_name ?? '—'}</p>
          {provider?.phone && (
            <p className="mt-1 text-sm text-gray-500">{provider.phone}</p>
          )}
        </div>

        {/* Pedido */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pedido
          </h2>
          <p className="font-medium text-gray-900">{cat?.label ?? req?.category_slug ?? '—'}</p>
          {req && (
            <Link
              href={`/pedidos/${req.id}`}
              className="mt-1 inline-block text-xs text-brand-600 hover:underline"
            >
              Ver pedido →
            </Link>
          )}
        </div>

        {/* Valores */}
        <div className="rounded-lg border border-gray-200 p-4 sm:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Valores
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-gray-900">
                R$ {(payout.gross_cents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Bruto (do cliente)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-500">
                −R$ {(payout.commission_cents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                Comissão ({(Number(payout.commission_rate) * 100).toFixed(0)}%)
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">
                R$ {(payout.net_cents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">Líquido a pagar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Se já pago: mostrar confirmação */}
      {payout.status === 'paid' && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
            Pagamento confirmado
          </h2>
          <p className="font-mono text-sm text-green-800">{payout.confirmation_id}</p>
          <p className="mt-1 text-xs text-green-600">
            {payout.paid_at
              ? new Date(payout.paid_at).toLocaleString('pt-BR')
              : '—'}
            {' · '}
            {payout.method === 'manual_pix' ? 'Pix manual' : payout.method}
          </p>
          {payout.notes && (
            <p className="mt-2 text-sm text-green-700">{payout.notes}</p>
          )}
        </div>
      )}

      {/* Formulário de execução */}
      {payout.status === 'eligible' && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Registrar repasse via Pix manual
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Transfira R$ <strong>{(payout.net_cents / 100).toFixed(2)}</strong> via Pix para o
            prestador, depois cole o ID de confirmação abaixo.
          </p>
          <MarkPaidForm payoutId={params.id} />
        </div>
      )}
    </div>
  )
}
