'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { submitCheckIn } from '@/server/completion'

export default function CheckinPage({ params }: { params: { id: string } }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const checkInAction = submitCheckIn.bind(null, params.id)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await checkInAction(formData)
      if (result?.error) setError(result.error)
      // On success, server action redirects to /evidencias
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-8">
        <Link
          href={`/pedidos/${params.id}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Voltar ao pedido
        </Link>
      </div>

      <div className="mb-8 text-center">
        <div className="mb-2 text-3xl">📍</div>
        <h1 className="text-2xl font-bold text-gray-900">Check-in</h1>
        <p className="mt-2 text-sm text-gray-500">
          Solicite o código de 6 dígitos ao cliente e digite abaixo para confirmar sua chegada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
            Código do cliente <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="w-full rounded-md border border-gray-300 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.5em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            O cliente vê o código na tela do pedido dele.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? 'Verificando…' : 'Confirmar check-in'}
        </button>
      </form>
    </div>
  )
}
