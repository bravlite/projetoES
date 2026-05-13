'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addEvidence } from '@/server/completion'

const KIND_LABELS = {
  before: 'Antes do serviço',
  during: 'Durante o serviço',
  after: 'Depois do serviço',
}

interface Props {
  requestId: string
  hasAfterEvidence: boolean
}

export default function EvidenceUpload({ requestId, hasAfterEvidence }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addEvidence(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        formRef.current?.reset()
        router.refresh() // recarrega para mostrar nova evidência
      }
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Adicionar foto
      </h2>

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="request_id" value={requestId} />

        <div>
          <label htmlFor="kind" className="mb-1 block text-sm font-medium text-gray-700">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            id="kind"
            name="kind"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="file" className="mb-1 block text-sm font-medium text-gray-700">
            Foto <span className="text-red-500">*</span>
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">JPEG, PNG ou WebP. Máximo 5MB.</p>
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
            Observações
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Descreva o que foi feito, materiais usados, etc."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            ✓ Foto adicionada com sucesso.
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Enviar foto'}
        </button>

        {!hasAfterEvidence && (
          <p className="text-xs text-amber-600">
            ⚠️ Você precisa enviar pelo menos 1 foto &ldquo;depois do serviço&rdquo; para marcar
            como concluído.
          </p>
        )}
      </form>
    </div>
  )
}
