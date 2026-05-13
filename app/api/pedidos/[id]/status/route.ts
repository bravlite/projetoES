// app/api/pedidos/[id]/status/route.ts
// Endpoint de polling usado pela página de pagamento para detectar
// quando o webhook do PSP confirma o pagamento (payment_confirmed).

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return Response.json({ status: null })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient() as any
  const { data } = await admin
    .from('service_requests')
    .select('status, customer_id')
    .eq('id', params.id)
    .single()

  if (!data || data.customer_id !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json({ status: data.status })
}
