import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signOut } from '@/server/auth'
import type { ProviderProfile } from '@/types/database'

export const dynamic = 'force-dynamic'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s}>{s <= Math.round(rating) ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

type ProviderProfileWithStrikes = ProviderProfile & { strikes?: number }

export default async function PrestadorPage() {
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

  const { data: raw } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  const profile = raw as ProviderProfileWithStrikes | null

  const admin = createAdminClient() as any

  // Estatísticas de avaliações e serviços
  let avgRating: number | null = null
  let reviewCount = 0
  let completedCount = 0

  if (profile) {
    const { data: reviews } = await admin
      .from('service_reviews')
      .select('rating')
      .eq('provider_id', profile.id)
    const reviewList = (reviews as { rating: number }[]) ?? []
    reviewCount = reviewList.length
    if (reviewCount > 0) {
      avgRating = reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    }

    const { count } = await admin
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('current_provider_id', profile.id)
      .in('status', ['accepted_by_customer', 'auto_accepted', 'payout_released'])
    completedCount = (count as number | null) ?? 0
  }

  const displayName = profile?.display_name ?? user.email ?? 'Prestador'

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            profile?.approved
              ? 'bg-brand-50 text-brand-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          {profile?.approved ? 'Aprovado' : 'Aguardando aprovação'}
        </span>
      </div>

      {!profile?.approved && (
        <p className="mb-6 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Seu perfil está em análise. Você será notificado quando for aprovado.
        </p>
      )}

      {/* Estatísticas */}
      {profile?.approved && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
            <p className="mt-1 text-xs text-gray-500">Serviços concluídos</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            {avgRating != null ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
                <div className="mt-0.5">
                  <Stars rating={avgRating} />
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold text-gray-300">—</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Média de avaliações</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{reviewCount}</p>
            <p className="mt-1 text-xs text-gray-500">Avaliações recebidas</p>
          </div>
        </div>
      )}

      {/* Strikes */}
      {profile && (profile.strikes ?? 0) > 0 && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          ⚠ Você tem {profile.strikes} strike{(profile.strikes ?? 0) > 1 ? 's' : ''} registrado
          {(profile.strikes ?? 0) > 1 ? 's' : ''}. 3 strikes resultam em suspensão automática.
        </div>
      )}

      {/* Atalhos */}
      {profile?.approved && (
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href="/feed"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver pedidos disponíveis →
          </Link>
          <Link
            href="/pedidos"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Meus orçamentos →
          </Link>
          <Link
            href="/prestador/extrato"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Extrato financeiro →
          </Link>
        </div>
      )}

      <form action={signOut} className="mt-4">
        <button type="submit" className="text-sm text-gray-400 underline hover:text-gray-600">
          Sair da conta
        </button>
      </form>
    </div>
  )
}
