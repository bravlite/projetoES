'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDisputeMessage } from '@/server/dispute'

export default function DisputeMessageForm({ disputeId }: { disputeId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await addDisputeMessage(disputeId, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        form.reset()
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <textarea
        name="body"
        required
        minLength={5}
        rows={3}
        placeholder="Escreva sua resposta..."
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        {isPending ? 'Enviando...' : 'Enviar mensagem'}
      </button>
    </form>
  )
}
