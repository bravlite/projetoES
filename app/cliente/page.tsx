import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/server/auth'
import type { CustomerProfile } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function ClientePage() {
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
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const profile = raw as CustomerProfile | null

  const displayName = profile?.full_name ?? user.email ?? 'Cliente'
  const location =
    profile?.neighborhood && profile?.city
      ? `${profile.neighborhood}, ${profile.city}`
      : null

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {displayName}</h1>
        {location && <p className="mt-1 text-sm text-gray-500">{location}</p>}
      </div>

      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
        <p className="text-sm text-gray-400">Solicitar serviços — próxima lote.</p>
      </div>

      <form action={signOut} className="mt-10">
        <button
          type="submit"
          className="text-sm text-gray-400 underline hover:text-gray-600"
        >
          Sair da conta
        </button>
      </form>
    </div>
  )
}
