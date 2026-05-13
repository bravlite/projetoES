import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Profile, ServiceRequest, ProviderProfile } from '@/types/database'
import { SERVICE_CATEGORIES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const URGENCY_LABELS: Record<string, string> = {
  today: 'Hoje',
  tomorrow: 'Amanhã',
  this_week: 'Esta semana',
  flexible: 'Sem pressa',
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

export default async function FeedPage() {
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
  if (!profile || profile.role !== 'provider') redirect('/me')

  const { data: rawPP } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  const pp = rawPP as ProviderProfile | null

  if (!pp?.approved) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Pedidos disponíveis</h1>
        <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Seu perfil está aguardando aprovação. Após aprovado, você verá os pedidos disponíveis
          na sua área.
        </div>
      </div>
    )
  }

  // Busca pedidos em status 'requested' (RLS garante apenas approved providers)
  const { data: rawRequests } = await supabase
    .from('service_requests')
    .select('id, category_slug, description, neighborhood, urgency, desired_date, desired_period, created_at')
    .eq('status', 'requested')
    .order('created_at', { ascending: false })
    .limit(100)

  const allRequests = (rawRequests as ServiceRequest[]) ?? []

  // Filtra por área e categoria do prestador na camada de aplicação
  const myCategories = new Set(pp.categories)
  const myNeighborhoods = new Set(pp.neighborhoods)

  const filtered = allRequests.filter(
    (r) => myCategories.has(r.category_slug) && myNeighborhoods.has(r.neighborhood)
  )

  // Busca IDs de pedidos onde prestador já orçou (para marcar como "já orçado")
  const { data: myQuotesRaw } = await supabase
    .from('service_quotes')
    .select('request_id')
    .eq('provider_id', pp.id)

  const alreadyQuoted = new Set(
    ((myQuotesRaw as { request_id: string }[]) ?? []).map((q) => q.request_id)
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos disponíveis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Filtrado por suas categorias e bairros de atendimento.
          </p>
        </div>
        <Link
          href="/pedidos"
          className="text-sm text-brand-600 hover:underline"
        >
          Meus orçamentos →
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">
            Nenhum pedido disponível na sua área agora.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Categorias: {pp.categories.join(', ')} · Bairros: {pp.neighborhoods.join(', ')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((req) => {
            const cat = SERVICE_CATEGORIES.find((c) => c.slug === req.category_slug)
            const quoted = alreadyQuoted.has(req.id)

            return (
              <li key={req.id}>
                <Link
                  href={quoted ? `/pedidos/${req.id}` : `/pedidos/${req.id}/orcar`}
                  className={`flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50 ${
                    quoted ? 'border-gray-200 opacity-70' : 'border-gray-200 hover:border-brand-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {cat?.label ?? req.category_slug}
                      </p>
                      {quoted && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                          Orçado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                      {req.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>{req.neighborhood}</span>
                      <span>{URGENCY_LABELS[req.urgency] ?? req.urgency}</span>
                      <span>{timeAgo(req.created_at)}</span>
                    </div>
                  </div>
                  {!quoted && (
                    <span className="ml-4 shrink-0 text-sm font-semibold text-brand-600">
                      Orçar →
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
