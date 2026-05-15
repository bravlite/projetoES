import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/server/auth'
import type { CustomerProfile, ServiceRequest } from '@/types/database'

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
  auto_accepted: 'Concluído',
  disputed: 'Em disputa',
  payout_released: 'Finalizado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  expired: 'Expirado',
  blocked_for_review: 'Em análise',
}

export default async function ClientePage({
  searchParams,
}: {
  searchParams?: { confirmed?: string }
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
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const profile = rawProfile as CustomerProfile | null

  const { data: rawRequests } = await supabase
    .from('service_requests')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const requests = (rawRequests as ServiceRequest[]) ?? []

  const displayName = profile?.full_name ?? user.email ?? 'Cliente'
  const location =
    profile?.neighborhood && profile?.city
      ? `${profile.neighborhood}, ${profile.city}`
      : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {searchParams?.confirmed === '1' && (
        <div className="mb-6 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Email confirmado com sucesso. Sua conta está ativa.
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {displayName}</h1>
          {location && <p className="mt-1 text-sm text-gray-500">{location}</p>}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/pedidos/novo"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Solicitar serviço
          </Link>
          <Link
            href="/pedidos"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Meus pedidos
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-gray-200 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pedidos recentes</h2>
          <Link href="/pedidos" className="text-sm text-brand-600 hover:underline">
            Ver todos
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">
              Você ainda não criou nenhum pedido.
            </p>
            <Link
              href="/pedidos/novo"
              className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Criar primeiro pedido
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/pedidos/${request.id}`}
                  className="block rounded-lg border border-gray-200 p-4 hover:border-brand-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {request.category_slug}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                        {request.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {request.neighborhood} ·{' '}
                        {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      {STATUS_LABELS[request.status] ?? request.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={signOut}>
        <button type="submit" className="text-sm text-gray-400 underline hover:text-gray-600">
          Sair da conta
        </button>
      </form>
    </div>
  )
}