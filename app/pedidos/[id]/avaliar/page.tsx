'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { submitReview } from '@/server/review'

const STARS = [1, 2, 3, 4, 5]

const RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}

export default function AvaliarPage({ params }: { params: { id: string } }) {
  const [rating, setRating] = useState<number>(0)
  const [hovered, setHovered] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!rating) { setError('Selecione uma nota.'); return }
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitReview(params.id, formData)
      if (result?.error) setError(result.error)
    })
  }

  const display = hovered || rating

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Avaliar serviço</h1>
      <p className="mb-8 text-sm text-gray-500">
        Sua avaliação ajuda outros clientes e o prestador a melhorar.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Estrelas */}
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700">Nota</p>
          <div className="flex gap-2">
            {STARS.map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
              >
                {star <= display ? '★' : '☆'}
              </button>
            ))}
          </div>
          {display > 0 && (
            <p className="mt-2 text-sm font-medium text-yellow-600">
              {RATING_LABELS[display]}
            </p>
          )}
          {/* hidden input para o form */}
          <input type="hidden" name="rating" value={rating} />
        </div>

        {/* Comentário */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="comment">
            Comentário <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            placeholder="Conte como foi o serviço..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || !rating}
          className="w-full rounded-md bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Enviando...' : 'Enviar avaliação'}
        </button>
      </form>
    </div>
  )
}
