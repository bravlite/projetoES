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
    .from('service_requests')
    .select('id, status, category_slug, neighborhood, city, final_value_cents, created_at, updated_at')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })

  const list = (rows as Record<string, unknown>[]) ?? []

  const header = 'id,status,categoria,bairro,cidade,valor_reais,criado_em,atualizado_em'
  const lines = list.map((r) =>
    [
      r.id,
      r.status,
      r.category_slug,
      `"${r.neighborhood}"`,
      `"${r.city}"`,
      r.final_value_cents != null ? ((r.final_value_cents as number) / 100).toFixed(2) : '',
      r.created_at,
      r.updated_at,
    ].join(',')
  )

  const csv = [header, ...lines].join('\n')
  const filename = `pedidos-${now.toISOString().slice(0, 7)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
