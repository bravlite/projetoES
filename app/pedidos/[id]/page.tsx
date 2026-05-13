import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { acceptQuote } from '@/server/requests'
import type {
  Profile,
  ServiceRequest,
  ServiceQuote,
  ProviderProfile,
} from '@/types/database'
import { SERVICE_CATEGORIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  requested: 'Aguardando orçamentos',
  quoted: 'Orçamentos recebidos',
  quote_accepted: 'Orçamento aprovado',
  awaiting_payment: 'Aguardando pagamento Pix',
  payment_confirmed: 'Pagamento confirmado',
  checked_in: 'Prestador chegou',
  in_progress: 'Em execução',
  completed_by_provider: 'Aguardando sua confirmação',
  accepted_by_customer: 'Concluído',
  auto_accepted: 'Concluído (auto-aceite)',
  disputed: 'Em disputa',
  payout_released: 'Finalizado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  expired: 'Expirado',
}

const URGENCY_LABELS: Record<string, string> = {
  today: 'Hoje',
  tomorrow: 'Amanhã',
  this_week: 'Esta semana',
  flexible: 'Sem pressa',
}

const PERIOD_LABELS: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
  anytime: 'Qualquer hora',
}

export default async function PedidoDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { reviewed?: string }
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

  // Busca o pedido
  const { data: rawReq } = await supabase
    .from('service_requests')
    .select('*')
    .eq('id', params.id)
    .single()
  const req = rawReq as ServiceRequest | null
  if (!req) notFound()

  const cat = SERVICE_CATEGORIES.find((c) => c.slug === req.category_slug)

  const isCustomer = profile.role === 'customer' && req.customer_id === user.id

  // Provider profile (if provider)
  let providerProfile: ProviderProfile | null = null
  if (profile.role === 'provider') {
    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    providerProfile = pp as ProviderProfile | null
  }

  const isAssignedProvider =
    profile.role === 'provider' &&
    providerProfile &&
    req.current_provider_id === providerProfile.id

  // Orçamentos (customer vê todos do seu pedido; provider vê o próprio)
  let quotes: (ServiceQuote & { providerName: string })[] = []

  if (isCustomer && (req.status === 'quoted' || req.status === 'quote_accepted')) {
    const { data: rawQuotes } = await supabase
      .from('service_quotes')
      .select('*')
      .eq('request_id', req.id)
      .order('value_cents', { ascending: true })

    const rawList = (rawQuotes as ServiceQuote[]) ?? []

    // Enriquece com nome do prestador
    quotes = await Promise.all(
      rawList.map(async (q) => {
        const { data: pp } = await supabase
          .from('provider_profiles')
          .select('display_name')
          .eq('id', q.provider_id)
          .single()
        return {
          ...q,
          providerName: (pp as { display_name: string | null } | null)?.display_name ?? 'Prestador',
        }
      })
    )
  } else if (profile.role === 'provider' && providerProfile) {
    const { data: rawQ } = await supabase
      .from('service_quotes')
      .select('*')
      .eq('request_id', req.id)
      .eq('provider_id', providerProfile.id)
      .single()
    if (rawQ) {
      quotes = [{ ...(rawQ as ServiceQuote), providerName: providerProfile.display_name ?? 'Eu' }]
    }
  }

  const myQuote = providerProfile
    ? quotes.find((q) => q.provider_id === providerProfile?.id)
    : null
  const canQuote =
    profile.role === 'provider' &&
    providerProfile?.approved &&
    !myQuote &&
    (req.status === 'requested' || req.status === 'quoted')

  // Endereço: prestador vê endereço completo só se atribuído
  const showFullAddress = isCustomer || isAssignedProvider

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href="/pedidos" className="text-sm text-gray-400 hover:text-gray-600">
          ← Pedidos
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{cat?.label ?? req.category_slug}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {req.neighborhood}, {req.city}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          {STATUS_LABELS[req.status] ?? req.status}
        </span>
      </div>

      {/* Detalhes */}
      <div className="mb-6 rounded-lg border border-gray-200 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Detalhes
        </h2>
        <p className="mb-3 text-sm text-gray-700">{req.description}</p>

        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>Urgência: {URGENCY_LABELS[req.urgency] ?? req.urgency}</span>
          <span>Período: {PERIOD_LABELS[req.desired_period] ?? req.desired_period}</span>
          {req.desired_date && (
            <span>
              Data preferida: {new Date(req.desired_date).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {showFullAddress && (req.street || req.number) && (
          <p className="mt-3 text-sm text-gray-700">
            {[req.street, req.number, req.complement].filter(Boolean).join(', ')} —{' '}
            {req.neighborhood}, {req.city}
          </p>
        )}
      </div>

      {/* Valor final (quando aceito) */}
      {req.final_value_cents && (
        <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm text-brand-700">
            Valor aprovado:{' '}
            <strong>R$ {(req.final_value_cents / 100).toFixed(2)}</strong>
          </p>
        </div>
      )}

      {/* Orçamentos — visão do cliente */}
      {isCustomer && quotes.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {req.status === 'quote_accepted' ? 'Orçamento aceito' : 'Orçamentos recebidos'}
          </h2>
          <ul className="flex flex-col gap-3">
            {quotes.map((quote) => {
              const isAccepted = quote.status === 'accepted'
              const isRejected = quote.status === 'rejected'
              const acceptAction = acceptQuote.bind(null, quote.id)

              return (
                <li
                  key={quote.id}
                  className={`rounded-lg border p-4 ${
                    isAccepted
                      ? 'border-brand-300 bg-brand-50'
                      : isRejected
                      ? 'border-gray-200 opacity-60'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        R$ {(quote.value_cents / 100).toFixed(2)}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">{quote.providerName}</p>
                      {quote.estimated_minutes && (
                        <p className="text-xs text-gray-400">
                          Estimativa: {quote.estimated_minutes} min
                        </p>
                      )}
                      {quote.notes && (
                        <p className="mt-2 text-sm text-gray-600">{quote.notes}</p>
                      )}
                    </div>

                    {quote.status === 'pending' && req.status === 'quoted' && (
                      <form action={acceptAction}>
                        <button
                          type="submit"
                          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                          Aceitar
                        </button>
                      </form>
                    )}

                    {isAccepted && (
                      <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        Aceito ✓
                      </span>
                    )}
                    {isRejected && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        Recusado
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Orçamento do prestador — visão do prestador */}
      {profile.role === 'provider' && myQuote && (
        <div className="mb-6 rounded-lg border border-gray-200 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Seu orçamento
          </h2>
          <p className="text-lg font-bold text-gray-900">
            R$ {(myQuote.value_cents / 100).toFixed(2)}
          </p>
          {myQuote.estimated_minutes && (
            <p className="text-sm text-gray-500">Estimativa: {myQuote.estimated_minutes} min</p>
          )}
          {myQuote.notes && <p className="mt-2 text-sm text-gray-600">{myQuote.notes}</p>}
          <p className="mt-2 text-xs text-gray-400">
            Status:{' '}
            {myQuote.status === 'accepted'
              ? '✓ Aceito pelo cliente'
              : myQuote.status === 'rejected'
              ? 'Recusado'
              : 'Aguardando decisão do cliente'}
          </p>
        </div>
      )}

      {/* Botão de enviar orçamento (prestador) */}
      {canQuote && (
        <div className="mt-4">
          <Link
            href={`/pedidos/${req.id}/orcar`}
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Enviar orçamento
          </Link>
        </div>
      )}

      {/* Pagamento Pix — link quando aguardando pagamento */}
      {req.status === 'awaiting_payment' && isCustomer && (
        <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="mb-3 text-sm font-medium text-brand-700">
            Orçamento aprovado! Finalize o pagamento via Pix para confirmar o serviço.
          </p>
          <Link
            href={`/pedidos/${req.id}/pagamento`}
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Pagar via Pix →
          </Link>
        </div>
      )}

      {/* Aguardando pagamento — visão do prestador */}
      {req.status === 'awaiting_payment' && profile.role === 'provider' && (
        <div className="mt-6 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Aguardando pagamento Pix do cliente.
        </div>
      )}

      {/* payment_confirmed — cliente: exibe código de check-in */}
      {req.status === 'payment_confirmed' && isCustomer && req.check_in_code && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">
            Código de check-in
          </p>
          <p className="font-mono text-3xl font-bold tracking-[0.4em] text-blue-900">
            {req.check_in_code}
          </p>
          <p className="mt-2 text-xs text-blue-600">
            Forneça este código ao prestador quando ele chegar ao seu endereço.
          </p>
        </div>
      )}

      {/* payment_confirmed — prestador: botão de check-in */}
      {req.status === 'payment_confirmed' && isAssignedProvider && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-700">
            Pagamento confirmado. Dirija-se ao endereço e solicite o código ao cliente.
          </p>
          <Link
            href={`/pedidos/${req.id}/checkin`}
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Fazer check-in →
          </Link>
        </div>
      )}

      {/* checked_in / in_progress — prestador: link para evidências */}
      {(req.status === 'checked_in' || req.status === 'in_progress') && isAssignedProvider && (
        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-3 text-sm text-yellow-700">
            {req.status === 'checked_in'
              ? 'Check-in confirmado. Inicie o serviço e envie as fotos.'
              : 'Serviço em execução. Envie as fotos e marque como concluído.'}
          </p>
          <Link
            href={`/pedidos/${req.id}/evidencias`}
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Enviar fotos / Concluir →
          </Link>
        </div>
      )}

      {/* checked_in / in_progress — cliente: informativo */}
      {(req.status === 'checked_in' || req.status === 'in_progress') && isCustomer && (
        <div className="mt-6 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          {req.status === 'checked_in'
            ? 'Prestador realizou check-in. Serviço prestes a iniciar.'
            : 'Serviço em execução. Você será notificado quando o prestador marcar como concluído.'}
        </div>
      )}

      {/* completed_by_provider — cliente: confirmar ou contestar */}
      {req.status === 'completed_by_provider' && isCustomer && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm font-medium text-green-700">
            O prestador marcou o serviço como concluído. Revise e confirme.
          </p>
          <Link
            href={`/pedidos/${req.id}/concluir`}
            className="inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Revisar e confirmar →
          </Link>
        </div>
      )}

      {/* completed_by_provider — prestador: aguardando */}
      {req.status === 'completed_by_provider' && isAssignedProvider && (
        <div className="mt-6 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Serviço marcado como concluído. Aguardando confirmação do cliente (prazo de 24–48h).
        </div>
      )}

      {/* accepted_by_customer / auto_accepted — finalizado */}
      {(req.status === 'accepted_by_customer' || req.status === 'auto_accepted') && (
        <div className="mt-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Serviço concluído
          {req.status === 'auto_accepted' ? ' (confirmado automaticamente).' : '.'}
          {isAssignedProvider && ' Seu repasse está na fila de processamento.'}
        </div>
      )}

      {/* Banner pós-avaliação */}
      {searchParams.reviewed === '1' && (
        <div className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">
          ★ Avaliação enviada. Obrigado pelo feedback!
        </div>
      )}

      {/* Link avaliar — cliente, concluído, sem review ainda */}
      {isCustomer &&
        (req.status === 'accepted_by_customer' || req.status === 'auto_accepted') &&
        searchParams.reviewed !== '1' && (
          <ReviewLinkLoader requestId={req.id} customerId={user.id} />
        )}

      {/* disputed — informativo + link para thread */}
      {req.status === 'disputed' && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-700">
            Este pedido está em disputa. O pagamento está bloqueado até a decisão do administrador.
          </p>
          {(isCustomer || isAssignedProvider) && (
            <DisputeLinkLoader requestId={req.id} userId={user.id} />
          )}
        </div>
      )}

      {/* refunded */}
      {req.status === 'refunded' && (
        <div className="mt-6 rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Pedido encerrado com reembolso ao cliente.
        </div>
      )}
    </div>
  )
}

// Verifica se o cliente já avaliou; se não, exibe o link
async function ReviewLinkLoader({
  requestId,
  customerId,
}: {
  requestId: string
  customerId: string
}) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('service_reviews')
    .select('id')
    .eq('order_id', requestId)
    .eq('reviewer_id', customerId)
    .maybeSingle()
  if (data) {
    return (
      <p className="mt-3 text-sm text-gray-400">★ Você já avaliou este serviço.</p>
    )
  }
  return (
    <div className="mt-4">
      <Link
        href={`/pedidos/${requestId}/avaliar`}
        className="inline-block rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-yellow-900 hover:bg-yellow-500"
      >
        ★ Avaliar serviço
      </Link>
    </div>
  )
}

// Componente auxiliar inline para buscar o disputeId e renderizar o link
// (server component pode usar async diretamente)
async function DisputeLinkLoader({
  requestId,
  userId,
}: {
  requestId: string
  userId: string
}) {
  // Import inline para não quebrar o top-level do arquivo
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient() as any
  const { data } = await admin
    .from('disputes')
    .select('id')
    .eq('order_id', requestId)
    .maybeSingle()
  const disputeId = (data as { id: string } | null)?.id
  if (!disputeId) return null
  return (
    <Link
      href={`/pedidos/${requestId}/disputa/${disputeId}`}
      className="inline-block text-sm font-semibold text-red-600 underline hover:text-red-800"
    >
      Ver detalhes da disputa →
    </Link>
  )
}
