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

  // 0. Elimina as fotos de evidência dos pedidos deste cliente (LGPD Art. 18, VI).
  //    As fotos retratam o imóvel do cliente → o direito de eliminação as cobre,
  //    mesmo tendo sido enviadas pelo prestador. Fotos que o usuário tirou como
  //    prestador NÃO são apagadas aqui: retratam imóveis de outros clientes e são
  //    prova de disputa de terceiros.
  const { data: myOrders } = await admin
    .from('service_requests')
    .select('id')
    .eq('customer_id', userId)
  const orderIds = ((myOrders as { id: string }[]) ?? []).map((o) => o.id)

  if (orderIds.length > 0) {
    const { data: evid } = await admin
      .from('service_evidence')
      .select('id, file_path')
      .in('request_id', orderIds)
    const rows = (evid as { id: string; file_path: string }[]) ?? []

    if (rows.length > 0) {
      // Remove os objetos do bucket em lotes de 100
      const paths = rows.map((e) => e.file_path)
      for (let i = 0; i < paths.length; i += 100) {
        const { error: rmErr } = await admin.storage
          .from('evidence')
          .remove(paths.slice(i, i + 100))
        if (rmErr) {
          console.error(`[DELETE /api/me] Falha ao remover fotos do storage:`, rmErr)
        }
      }
      // Remove as linhas de evidência
      await admin
        .from('service_evidence')
        .delete()
        .in(
          'id',
          rows.map((e) => e.id)
        )
    }
  }

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
