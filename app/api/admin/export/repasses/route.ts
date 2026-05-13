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
    .from('payouts')
    .select('id, order_id, provider_id, gross_cents, commission_cents, net_cents, commission_rate, status, eligible_at, paid_at, method, confirmation_id, created_at')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })

  const list = (rows as Record<string, unknown>[]) ?? []

  const header = 'id,pedido_id,prestador_id,bruto_reais,comissao_reais,liquido_reais,taxa_comissao,status,elegivel_em,pago_em,metodo,confirmation_id'
  const lines = list.map((r) =>
    [
      r.id,
      r.order_id,
      r.provider_id,
      ((r.gross_cents as number) / 100).toFixed(2),
      ((r.commission_cents as number) / 100).toFixed(2),
      ((r.net_cents as number) / 100).toFixed(2),
      (Number(r.commission_rate) * 100).toFixed(1) + '%',
      r.status,
      r.eligible_at ?? '',
      r.paid_at ?? '',
      r.method ?? '',
      r.confirmation_id ?? '',
    ].join(',')
  )

  const csv = [header, ...lines].join('\n')
  const filename = `repasses-${now.toISOString().slice(0, 7)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
