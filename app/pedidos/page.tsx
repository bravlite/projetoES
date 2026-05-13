import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Profile, ServiceRequest, ServiceQuote } from '@/types/database'
import { SERVICE_CATEGORIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  requested: 'Aguardando orçamentos',
  quoted: 'Orçamentos recebidos',
  quote_accepted: 'Orçamento aprovado',
  awaiting_payment: 'Aguardando pagamento',
  payment_confirmed: 'Pagamento confirmado',
  checked_in: 'Prestador chegou',
  in_progress: 'Em execução',
  completed_by_provider: 'Aguardando confirmação',
  accepted_by_customer: 'Concluído',
  auto_accepted: 'Concluído (auto-aceite)',
  disputed: 'Em disputa',
  payout_released: 'Finalizado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  expired: 'Expirado',
}

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-blue-50 text-blue-700',
  quoted: 'bg-yellow-50 text-yellow-700',
  quote_accepted: 'bg-brand-50 text-brand-700',
  payment_confirmed: 'bg-brand-50 text-brand-700',
  completed_by_provider: 'bg-orange-50 text-orange-700',
  accepted_by_customer: 'bg-brand-100 text-brand-800',
  auto_accepted: 'bg-brand-100 text-brand-800',
  disputed: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { error?: string }
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

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as Profile | null
  if (!profile) redirect('/login')

  // ---- Customer: lista os próprios pedidos ----
  if (profile.role === 'customer') {
    const { data: rawRequests } = await supabase
      .from('service_requests')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    const requests = (rawRequests as ServiceRequest[]) ?? []

    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Meus pedidos</h1>
          <Link
            href="/pedidos/novo"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Novo pedido
          </Link>
        </div>

        {searchParams.error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {searchParams.error}
          </p>
        )}

        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">Nenhum pedido ainda.</p>
            <Link
              href="/pedidos/novo"
              className="mt-4 inline-block text-sm text-brand-600 hover:underline"
            >
              Criar primeiro pedido →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((req) => {
              const cat = SERVICE_CATEGORIES.find((c) => c.slug === req.category_slug)
              const statusLabel = STATUS_LABELS[req.status] ?? req.status
              const statusColor = STATUS_COLORS[req.status] ?? 'bg-gray-100 text-gray-600'
              return (
                <li key={req.id}>
                  <Link
                    href={`/pedidos/${req.id}`}
                    className="flex items-start justify-between rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {cat?.label ?? req.category_slug}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                        {req.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {req.neighborhood} · {new Date(req.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span
                      className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  // ---- Provider: lista orçamentos enviados ----
  if (profile.role === 'provider') {
    const { data: rawPP } = await supabase
      .from('provider_profiles')
      .select('id, approved')
      .eq('user_id', user.id)
      .single()
    const pp = rawPP as { id: string; approved: boolean } | null

    if (!pp?.approved) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-yellow-700">
            Seu perfil ainda está aguardando aprovação. Após aprovado, você poderá visualizar
            pedidos disponíveis.
          </p>
        </div>
      )
    }

    // Orçamentos enviados pelo prestador
    const { data: rawQuotes } = await supabase
      .from('service_quotes')
      .select('*')
      .eq('provider_id', pp.id)
      .order('created_at', { ascending: false })

    const quotes = (rawQuotes as ServiceQuote[]) ?? []

    // Para cada quote, busca o service_request correspondente
    const requestIds = quotes.map((q) => q.request_id)
    let requests: ServiceRequest[] = []
    if (requestIds.length > 0) {
      const { data: rawReqs } = await supabase
        .from('service_requests')
        .select('*')
        .in('id', requestIds)
      requests = (rawReqs as ServiceRequest[]) ?? []
    }

    const requestMap = new Map(requests.map((r) => [r.id, r]))

    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Meus orçamentos</h1>
          <Link
            href="/feed"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Ver pedidos disponíveis
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">Nenhum orçamento enviado ainda.</p>
            <Link
              href="/feed"
              className="mt-4 inline-block text-sm text-brand-600 hover:underline"
            >
              Ver pedidos disponíveis →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {quotes.map((quote) => {
              const req = requestMap.get(quote.request_id)
              const cat = req
                ? SERVICE_CATEGORIES.find((c) => c.slug === req.category_slug)
                : null
              const reqStatus = req ? STATUS_LABELS[req.status] ?? req.status : '—'
              const quoteStatusColor =
                quote.status === 'accepted'
                  ? 'bg-brand-50 text-brand-700'
                  : quote.status === 'rejected'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-yellow-50 text-yellow-700'
              const quoteStatusLabel =
                quote.status === 'accepted'
                  ? 'Aceito'
                  : quote.status === 'rejected'
                  ? 'Recusado'
                  : 'Aguardando'

              return (
                <li key={quote.id}>
                  <Link
                    href={`/pedidos/${quote.request_id}`}
                    className="flex items-start justify-between rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {cat?.label ?? req?.category_slug ?? '—'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Seu orçamento:{' '}
                        <strong>R$ {(quote.value_cents / 100).toFixed(2)}</strong>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Pedido: {reqStatus} ·{' '}
                        {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span
                      className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${quoteStatusColor}`}
                    >
                      {quoteStatusLabel}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  // Admin
  redirect('/admin')
}
