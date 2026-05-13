import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DisputeMessageForm from './DisputeMessageForm'
import type { Profile, ProviderProfile, Dispute, DisputeMessage } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  awaiting_provider: 'Aguardando prestador',
  awaiting_admin: 'Aguardando admin',
  resolved: 'Resolvida',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  awaiting_provider: 'bg-yellow-100 text-yellow-700',
  awaiting_admin: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

const DECISION_LABELS: Record<string, string> = {
  release_full: 'Pagamento liberado ao prestador (integral)',
  release_partial: 'Pagamento liberado ao prestador (parcial)',
  refund_full: 'Reembolso ao cliente (integral)',
  refund_partial: 'Reembolso ao cliente (parcial)',
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  provider: 'Prestador',
  admin: 'Admin',
}

export default async function DisputaPage({
  params,
}: {
  params: { id: string; disputeId: string }
}) {
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

  // Perfil + role
  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile) redirect('/login')

  // Busca disputa
  const { data: rawDispute } = await admin
    .from('disputes')
    .select('id, order_id, opened_by, provider_id, reason_code, description, status, decision, resolved_at')
    .eq('id', params.disputeId)
    .eq('order_id', params.id)
    .single()
  const dispute = rawDispute as Dispute | null
  if (!dispute) notFound()

  // Verifica acesso: cliente dono, prestador do pedido ou admin
  let hasAccess = false
  if (profile.role === 'admin') {
    hasAccess = true
  } else if (dispute.opened_by === user.id) {
    hasAccess = true
  } else if (profile.role === 'provider') {
    const { data: pp } = await admin
      .from('provider_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    const providerProfile = pp as { id: string } | null
    if (providerProfile && dispute.provider_id === providerProfile.id) hasAccess = true
  }
  if (!hasAccess) redirect(`/pedidos/${params.id}`)

  // Busca mensagens
  const { data: rawMessages } = await admin
    .from('dispute_messages')
    .select('id, author_id, author_role, body, created_at')
    .eq('dispute_id', params.disputeId)
    .order('created_at', { ascending: true })
  const messages = (rawMessages as Omit<DisputeMessage, 'dispute_id'>[]) ?? []

  const canReply = dispute.status !== 'resolved'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Disputa</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_COLORS[dispute.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABELS[dispute.status] ?? dispute.status}
        </span>
      </div>

      {/* Decisão final */}
      {dispute.status === 'resolved' && dispute.decision && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">Decisão admin:</p>
          <p className="mt-1 text-sm text-green-700">
            {DECISION_LABELS[dispute.decision] ?? dispute.decision}
          </p>
          {dispute.resolved_at && (
            <p className="mt-1 text-xs text-green-500">
              {new Date(dispute.resolved_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Thread de mensagens */}
      <div className="mb-6 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.author_id === user.id
          return (
            <div
              key={msg.id}
              className={`rounded-lg p-3 ${
                msg.author_role === 'admin'
                  ? 'border border-blue-200 bg-blue-50'
                  : isMe
                    ? 'bg-brand-50 border border-brand-200'
                    : 'border border-gray-200 bg-gray-50'
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">
                  {ROLE_LABELS[msg.author_role] ?? msg.author_role}
                  {isMe && ' (você)'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(msg.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{msg.body}</p>
            </div>
          )
        })}
      </div>

      {/* Formulário de resposta */}
      {canReply && (
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Responder</h2>
          <DisputeMessageForm disputeId={params.disputeId} />
        </div>
      )}

      {/* Link admin */}
      {profile.role === 'admin' && (
        <div className="mt-4 text-center">
          <Link
            href={`/admin/disputas/${params.disputeId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Ver no painel admin →
          </Link>
        </div>
      )}
    </div>
  )
}
