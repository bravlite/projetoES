'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { signUp } from '@/server/auth'
import { LogoMark } from '@/components/Logo'

export default function CadastroClientePage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const data = new FormData(e.currentTarget)
    const email = data.get('email') as string
    const password = data.get('password') as string

    const termsAccepted = data.get('terms') === 'on'
    startTransition(async () => {
      const result = await signUp(email, password, 'customer', termsAccepted)
      if (result.error) setError(result.error)
      if (result.success) setSuccess(result.success)
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="card !p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">Criar conta</h1>
          <p className="mt-1 text-sm text-gray-500">
            Peça orçamentos grátis e pague só quando estiver concluído.
          </p>
        </div>

        {success ? (
          <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">{success}</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres.</p>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" name="terms" required className="mt-0.5 shrink-0" />
              <span>
                Li e aceito os{' '}
                <Link href="/termos" target="_blank" className="text-brand-700 underline">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link href="/privacidade" target="_blank" className="text-brand-700 underline">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-clay disabled:opacity-50"
            >
              {isPending ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-gray-500">
        É prestador?{' '}
        <Link href="/cadastro/prestador" className="font-medium text-clay-600 hover:underline">
          Cadastre-se aqui
        </Link>
      </p>
    </div>
  )
}
