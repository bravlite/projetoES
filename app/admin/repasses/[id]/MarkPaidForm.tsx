'use client'

import { useState, useTransition } from 'react'
import { markPayoutPaid } from '@/server/payout'

export default function MarkPaidForm({ payoutId }: { payoutId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await markPayoutPaid(payoutId, formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirmation_id">
          ID de confirmação do Pix <span className="text-red-500">*</span>
        </label>
        <input
          id="confirmation_id"
          name="confirmation_id"
          type="text"
          required
          placeholder="Ex: E18236120202506041830..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Código E2E do comprovante de transferência Pix.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="notes">
          Observação <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Informações adicionais..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
      >
        {isPending ? 'Registrando pagamento...' : '✓ Confirmar repasse realizado'}
      </button>
    </form>
  )
}
