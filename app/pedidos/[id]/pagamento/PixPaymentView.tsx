'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { regeneratePixCharge } from '@/server/requests'

interface Props {
  orderId: string
  amountCents: number
  pixQrBase64: string | null
  pixPayload: string | null
  expiresAt: string | null
  isMock: boolean
}

export default function PixPaymentView({
  orderId,
  amountCents,
  pixQrBase64,
  pixPayload,
  expiresAt,
  isMock,
}: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [expired, setExpired] = useState(false)
  const [isRegenerating, startRegenerate] = useState(false)

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt) return
    const end = new Date(expiresAt).getTime()
    const tick = () => {
      const diff = Math.max(0, Math.floor((end - Date.now()) / 1000))
      setTimeLeft(diff)
      if (diff === 0) setExpired(true)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  // ── Polling de status ─────────────────────────────────────────────────────
  // Verifica a cada 5s se o PSP já confirmou o pagamento via webhook.
  useEffect(() => {
    if (expired) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/pedidos/${orderId}/status`)
        if (!res.ok) return
        const { status } = (await res.json()) as { status: string }
        if (status === 'payment_confirmed') {
          router.push(`/pedidos/${orderId}`)
        }
      } catch {
        // ignora erros de rede — tenta novamente na próxima iteração
      }
    }
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [orderId, expired, router])

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!pixPayload) return
    navigator.clipboard.writeText(pixPayload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }, [pixPayload])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const regenerateAction = regeneratePixCharge.bind(null, orderId)

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6 text-center">
        <div className="mb-2 text-3xl">💸</div>
        <h1 className="text-2xl font-bold text-gray-900">Pagar via Pix</h1>
        <p className="mt-1 text-sm text-gray-500">
          Valor:{' '}
          <strong className="text-gray-900">R$ {(amountCents / 100).toFixed(2)}</strong>
        </p>
      </div>

      {expired ? (
        /* Pix expirado */
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-2 font-semibold text-red-700">Pix expirado</p>
          <p className="mb-5 text-sm text-red-600">
            O código expirou. Gere um novo para continuar.
          </p>
          <form action={regenerateAction}>
            <button
              type="submit"
              disabled={isRegenerating}
              onClick={() => startRegenerate(true)}
              className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isRegenerating ? 'Gerando…' : 'Gerar novo Pix'}
            </button>
          </form>
        </div>
      ) : (
        /* Pix ativo */
        <div className="flex flex-col items-center gap-5">
          {/* Mock mode banner */}
          {isMock && (
            <div className="w-full rounded-md bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-700">
              ⚠️ Modo desenvolvimento — Pix real não gerado. Configure{' '}
              <code className="rounded bg-yellow-100 px-1">ASAAS_API_KEY</code> para testar
              pagamento real.
            </div>
          )}

          {/* QR Code */}
          {pixQrBase64 ? (
            <div className="rounded-lg border border-gray-200 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pixQrBase64}`}
                alt="QR Code Pix"
                className="h-56 w-56"
              />
            </div>
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
              QR Code indisponível
            </div>
          )}

          {/* Copia-e-cola */}
          {pixPayload && (
            <div className="w-full">
              <p className="mb-1 text-xs font-medium text-gray-500">Ou copie o código Pix:</p>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="flex-1 truncate font-mono text-xs text-gray-700">{pixPayload}</p>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* Countdown */}
          {expiresAt && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span
                className={`font-mono font-semibold ${
                  timeLeft < 120 ? 'text-red-600' : 'text-gray-700'
                }`}
              >
                {formatTime(timeLeft)}
              </span>
              <span>restantes para o código expirar</span>
            </div>
          )}

          {/* Indicação de polling */}
          <p className="text-center text-xs text-gray-400">
            Esta página atualiza automaticamente ao detectar o pagamento.
          </p>

          {/* Instruções */}
          <ol className="w-full space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            <li>1. Abra seu banco e acesse a área Pix.</li>
            <li>2. Escaneie o QR code acima ou cole o código.</li>
            <li>3. Confirme o valor e finalize o pagamento.</li>
            <li>4. Esta tela atualizará automaticamente.</li>
          </ol>
        </div>
      )}
    </div>
  )
}
