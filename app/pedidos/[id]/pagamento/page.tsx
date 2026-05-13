import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PixPaymentView from './PixPaymentView'
import type { Payment } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PagamentoPage({ params }: { params: { id: string } }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-gray-500">Configure Supabase em .env.local.</p>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Busca pedido
  const { data: sr } = await admin
    .from('service_requests')
    .select('id, status, customer_id, final_value_cents')
    .eq('id', params.id)
    .single()

  if (!sr) notFound()
  if (sr.customer_id !== user.id) redirect('/pedidos')

  // Se pagamento já foi confirmado ou status incompatível, vai para detalhe do pedido
  if (
    sr.status === 'payment_confirmed' ||
    sr.status === 'checked_in' ||
    sr.status === 'in_progress' ||
    sr.status === 'completed_by_provider' ||
    sr.status === 'accepted_by_customer' ||
    sr.status === 'auto_accepted' ||
    sr.status === 'payout_released'
  ) {
    redirect(`/pedidos/${params.id}`)
  }

  // Status inválido para esta página
  if (sr.status !== 'awaiting_payment' && sr.status !== 'quote_accepted') {
    redirect(`/pedidos/${params.id}`)
  }

  // Busca pagamento mais recente ainda pendente
  const { data: payment } = await admin
    .from('payments')
    .select('id, status, psp_pix_qr, psp_pix_copy_paste, expires_at, amount_cents')
    .eq('order_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const p = payment as Payment | null

  // Sem pagamento pendente — pode ter expirado antes de carregar a página
  if (!p) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12">
        <div className="mb-6">
          <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
            ← Voltar ao pedido
          </Link>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Nenhum Pix ativo encontrado</p>
          <p className="mb-4 text-sm text-red-600">
            Seu código Pix pode ter expirado. Volte ao pedido para gerar um novo.
          </p>
          <Link
            href={`/pedidos/${params.id}`}
            className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Voltar ao pedido
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <PixPaymentView
        orderId={params.id}
        amountCents={p.amount_cents}
        pixQrBase64={p.psp_pix_qr}
        pixPayload={p.psp_pix_copy_paste}
        expiresAt={p.expires_at}
        isMock={!p.psp_pix_qr && !!p.psp_pix_copy_paste}
      />
    </div>
  )
}
