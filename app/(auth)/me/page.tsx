import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function MePage({
  searchParams,
}: {
  searchParams?: { confirmed?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = rawProfile as { role?: string } | null
  const suffix = searchParams?.confirmed === '1' ? '?confirmed=1' : ''

  if (profile?.role === 'provider') redirect(`/prestador${suffix}`)
  if (profile?.role === 'admin') redirect('/admin')

  redirect(`/cliente${suffix}`)
}
