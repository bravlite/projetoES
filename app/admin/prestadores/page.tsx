import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { approveProvider, rejectProvider } from '@/server/admin'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function AdminPrestadoresPage() {
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

  const { data: rawProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'admin') redirect('/')

  // Busca prestadores pendentes
  const { data: rawPending } = await admin
    .from('provider_profiles')
    .select('id, user_id, display_name, phone, bio, categories, neighborhoods, created_at')
    .eq('approved', false)
    .order('created_at', { ascending: true })

  // Busca prestadores aprovados
  const { data: rawApproved } = await admin
    .from('provider_profiles')
    .select('id, user_id, display_name, categories, neighborhoods, approved, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(20)

  type ProviderRow = {
    id: string
    user_id: string
    display_name: string | null
    phone: string | null
    bio: string | null
    categories: string[]
    neighborhoods: string[]
    approved: boolean
    created_at: string
  }

  const pending = (rawPending as ProviderRow[]) ?? []
  const approved = (rawApproved as ProviderRow[]) ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Prestadores</h1>
      </div>

      {/* Pendentes */}
      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Aguardando aprovação ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm text-gray-400">Nenhum prestador pendente.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((p) => (
              <li key={p.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{p.display_name ?? '(sem nome)'}</p>
                    {p.phone && <p className="text-sm text-gray-500">Tel: {p.phone}</p>}
                    {p.bio && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{p.bio}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.categories.map((c) => (
                        <span
                          key={c}
                          className="rounded bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.neighborhoods.map((n) => (
                        <span
                          key={n}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-xs text-gray-400">
                      user_id: {p.user_id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveProvider.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                      >
                        Aprovar
                      </button>
                    </form>
                    <form action={rejectProvider.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Rejeitar
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Aprovados recentes */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Aprovados recentes
        </h2>
        {approved.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum prestador aprovado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Categorias</th>
                  <th className="px-4 py-3 text-left">Bairros</th>
                  <th className="px-4 py-3 text-left">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approved.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.display_name ?? '(sem nome)'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.categories.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.neighborhoods.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
