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
  const confirmed = searchParams?.confirmed === '1'
  const suffix = confirmed ? '?confirmed=1' : ''

  // Admin vai direto para o painel
  if (profile?.role === 'admin') redirect('/admin')

  // Prestador: verifica se já completou o perfil
  if (profile?.role === 'provider') {
    const { data: pp } = await supabase
      .from('provider_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!pp) redirect('/onboarding/prestador')
    redirect(`/prestador${suffix}`)
  }

  // Cliente (default): verifica se já completou o perfil
  const { data: cp } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!cp) redirect('/onboarding/cliente')
  redirect(`/cliente${suffix}`)
}
