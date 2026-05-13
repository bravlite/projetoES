import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

// Pure role-dispatch page — no UI. Redirects based on profile.role + onboarding state.
export const dynamic = 'force-dynamic'

export default async function MePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-gray-500">
          Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> em <code>.env.local</code>.
        </p>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Cast to Profile — Supabase's generic select parser can't resolve our manual DB type.
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Profile | null

  // Profile should always exist (trigger creates it on signup), but guard anyway.
  if (!profile) redirect('/login')

  if (profile.role === 'admin') redirect('/admin')

  if (profile.role === 'provider') {
    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const ppProfile = pp as { display_name: string | null } | null
    if (!ppProfile?.display_name) redirect('/onboarding/prestador')
    redirect('/prestador')
  }

  // Default: customer
  const { data: cp } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const cpProfile = cp as { full_name: string | null } | null
  if (!cpProfile?.full_name) redirect('/onboarding/cliente')
  redirect('/cliente')
}
