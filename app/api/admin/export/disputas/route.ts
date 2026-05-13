import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient() as any
  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if ((rawProfile as { role: string } | null)?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: rows } = await admin
    .from('disputes')
    .select('id, order_id, reason_code, status, decision, created_at, resolved_at')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })

  const list = (rows as Record<string, unknown>[]) ?? []

  const header = 'id,pedido_id,motivo,status,decisao,aberta_em,resolvida_em'
  const lines = list.map((r) =>
    [
      r.id,
      r.order_id,
      r.reason_code,
      r.status,
      r.decision ?? '',
      r.created_at,
      r.resolved_at ?? '',
    ].join(',')
  )

  const csv = [header, ...lines].join('\n')
  const filename = `disputas-${now.toISOString().slice(0, 7)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
