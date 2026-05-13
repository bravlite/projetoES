// DELETE /api/me — LGPD: soft delete + anonimização de PII
// Mantém registros financeiros (obrigação legal) mas remove PII pessoal.
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient() as any
  const now = new Date().toISOString()
  const userId = user.id

  // Busca provider_profile.id para anonimizar
  const { data: pp } = await admin
    .from('provider_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const providerId = (pp as { id: string } | null)?.id

  // 1. Anonimiza customer_profile
  await admin
    .from('customer_profiles')
    .update({
      full_name: 'Usuário removido',
      phone: null,
      deleted_at: now,
    })
    .eq('user_id', userId)

  // 2. Anonimiza provider_profile
  if (providerId) {
    await admin
      .from('provider_profiles')
      .update({
        display_name: 'Prestador removido',
        phone: null,
        bio: null,
        deleted_at: now,
      })
      .eq('id', providerId)
  }

  // 3. Marca profile como deletado
  await admin
    .from('profiles')
    .update({
      status: 'banned',
      deleted_at: now,
    })
    .eq('id', userId)

  // 4. Anonimiza email e metadata no Auth (remove PII do auth.users)
  await admin.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@removed.invalid`,
    user_metadata: { deleted: true, deleted_at: now },
  })

  // 5. Revoga todas as sessões ativas
  await admin.auth.admin.signOut(userId, 'global')

  return Response.json({ ok: true, deleted_at: now })
}
