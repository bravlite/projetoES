import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/server/auth'
import { Logo } from '@/components/Logo'
import './globals.css'

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Concluído — Serviços em Vitória/Vila Velha',
  description:
    'Contrate serviços domésticos na Grande Vitória e pague só quando estiver pronto.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Concluído',
  },
}

export const viewport: Viewport = {
  themeColor: '#1f5f66',
}

function GuestNav() {
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/login" className="font-medium text-gray-600 hover:text-brand-700">
        Entrar
      </Link>
      <Link href="/cadastro/cliente" className="btn-clay !px-4 !py-2">
        Começar
      </Link>
    </nav>
  )
}

async function UserNav() {
  const envReady =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!envReady) return <GuestNav />

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return <GuestNav />

    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = rawProfile as { role?: string } | null

    const dashboardHref =
      profile?.role === 'provider'
        ? '/prestador'
        : profile?.role === 'admin'
          ? '/admin'
          : '/cliente'

    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href={dashboardHref} className="font-medium text-gray-600 hover:text-brand-700">
          Painel
        </Link>
        <Link href="/pedidos" className="font-medium text-gray-600 hover:text-brand-700">
          Pedidos
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-gray-400 hover:text-clay-600">
            Sair
          </button>
        </form>
      </nav>
    )
  } catch {
    return <GuestNav />
  }
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-sand-200 bg-sand-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Serviços domésticos na Grande Vitória. O pagamento fica protegido e só é
            liberado quando o serviço estiver concluído.
          </p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-display font-semibold text-brand-800">Concluído</span>
            <Link href="/pedidos/novo" className="text-gray-500 hover:text-brand-700">
              Criar pedido
            </Link>
            <Link href="/cadastro/prestador" className="text-gray-500 hover:text-brand-700">
              Sou prestador
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-display font-semibold text-brand-800">Legal</span>
            <Link href="/termos" className="text-gray-500 hover:text-brand-700">
              Termos de uso
            </Link>
            <Link href="/privacidade" className="text-gray-500 hover:text-brand-700">
              Privacidade
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-sand-200 py-4 text-center text-xs text-gray-400">
        Feito na Grande Vitória, ES — {new Date().getFullYear()}
      </div>
    </footer>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1f5f66" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Concluído" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" aria-label="Concluído — início">
              <Logo />
            </Link>
            <UserNav />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Footer />
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}
