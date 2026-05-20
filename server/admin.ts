'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Profile } from '@/types/database'

// Utilitário: verifica se o usuário atual é admin
async function requireAdmin() {
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

  return { admin, user }
}

// ── Aprovar prestador ─────────────────────────────────────────────────────────
export async function approveProvider(providerProfileId: string): Promise<void> {
  const { admin, user } = await requireAdmin()

  await admin
    .from('provider_profiles')
    .update({ approved: true })
    .eq('id', providerProfileId)

  await admin.from('admin_actions').insert({
    actor_id: user.id,
    action_type: 'approve_provider',
    target_type: 'provider',
    target_id: providerProfileId,
    payload: {},
  })

  redirect('/admin/prestadores')
}

// ── Rejeitar / remover aprovação de prestador ─────────────────────────────────
export async function rejectProvider(providerProfileId: string): Promise<void> {
  const { admin, user } = await requireAdmin()

  await admin
    .from('provider_profiles')
    .update({ approved: false })
    .eq('id', providerProfileId)

  await admin.from('admin_actions').insert({
    actor_id: user.id,
    action_type: 'reject_provider',
    target_type: 'provider',
    target_id: providerProfileId,
    payload: {},
  })

  redirect('/admin/prestadores')
}

// ── Suspender usuário ─────────────────────────────────────────────────────────
export async function suspendUser(
  userId: string,
  reason: string
): Promise<{ error?: string }> {
  const { admin, user } = await requireAdmin()

  await admin
    .from('profiles')
    .update({ status: 'suspended' })
    .eq('id', userId)

  await admin.from('admin_actions').insert({
    actor_id: user.id,
    action_type: 'suspend_user',
    target_type: 'user',
    target_id: userId,
    payload: { reason },
  })

  return {}
}
