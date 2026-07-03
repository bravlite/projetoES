import Link from 'next/link'

// Ícones próprios por categoria (stroke style, herdam currentColor)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  eletrica: (
    <path d="M13 2 4.5 13.5h6L10 22l9.5-12h-6L13 2Z" />
  ),
  hidraulica: (
    <path d="M12 2.5S5.5 9.5 5.5 14a6.5 6.5 0 0 0 13 0c0-4.5-6.5-11.5-6.5-11.5Zm-2 12.5a2.5 2.5 0 0 0 2.5 2.5" />
  ),
  montagem: (
    <path d="M14.5 6.5 17.5 3.5 20.5 6.5 17.5 9.5m-3-3-11 11 3 3 11-11m-3-3 3 3M6 15l3 3" />
  ),
  limpeza: (
    <path d="M12 3v4m0 0c-3.5 0-6 2.5-6 6l-1.5 8h15L18 13c0-3.5-2.5-6-6-6Zm-3.5 8v3m3.5-3v3m3.5-3v3" />
  ),
  'ar-condicionado': (
    <path d="M12 2v20M4 6l16 12M4 18 20 6M2 12h20" />
  ),
  reparos: (
    <path d="M3.5 6.5 7 3l4 4-.5 2.5L13 12l7 7-2.5 2.5-7-7-2.5.5-4-4L6.5 8" />
  ),
}

const CATEGORIES = [
  { slug: 'eletrica', name: 'Elétrica', tone: 'bg-amber-100 text-amber-700' },
  { slug: 'hidraulica', name: 'Hidráulica', tone: 'bg-brand-100 text-brand-700' },
  { slug: 'montagem', name: 'Montagem', tone: 'bg-clay-100 text-clay-700' },
  { slug: 'limpeza', name: 'Limpeza', tone: 'bg-emerald-100 text-emerald-700' },
  { slug: 'ar-condicionado', name: 'Ar-condicionado', tone: 'bg-sky-100 text-sky-700' },
  { slug: 'reparos', name: 'Pequenos reparos', tone: 'bg-violet-100 text-violet-700' },
]

const STEPS = [
  {
    n: '1',
    title: 'Conte o que precisa',
    text: 'Descreva o serviço e o bairro. Leva menos de dois minutos, sem pagar nada.',
  },
  {
    n: '2',
    title: 'Compare orçamentos',
    text: 'Prestadores verificados da sua região enviam propostas. Você escolhe a melhor.',
  },
  {
    n: '3',
    title: 'Pague protegido',
    text: 'O Pix fica retido com a gente e só é liberado quando você confirmar a conclusão.',
  },
]

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="m4.5 10.5 4 4 7-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Wave({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M0 32C120 10 240 10 360 26s240 38 360 38 240-32 360-42 240 0 360 16v26H0V32Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-16 sm:pt-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-800">
              Vitória · Vila Velha
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-[1.08] tracking-tight text-brand-900 sm:text-5xl">
              Ajuda em casa,
              <br />
              sem dor de cabeça<span className="text-clay-500">.</span>
            </h1>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-gray-600">
              Prestadores verificados da sua região enviam orçamentos.{' '}
              <strong className="font-semibold text-brand-800">
                Você só paga quando o serviço estiver concluído.
              </strong>
            </p>
            <div className="mb-8 flex flex-wrap gap-3">
              <Link href="/pedidos/novo" className="btn-clay !px-7 !py-3 !text-base">
                Pedir um serviço
              </Link>
              <Link href="/cadastro/prestador" className="btn-ghost !px-7 !py-3 !text-base">
                Sou prestador
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="check-chip">
                <CheckIcon className="h-3.5 w-3.5 text-clay-500" /> Pagamento protegido
              </span>
              <span className="check-chip">
                <CheckIcon className="h-3.5 w-3.5 text-clay-500" /> Prestadores verificados
              </span>
              <span className="check-chip">
                <CheckIcon className="h-3.5 w-3.5 text-clay-500" /> Pedir é grátis
              </span>
            </div>
          </div>

          {/* Cartão ilustrativo: pedido concluído */}
          <div className="relative mx-auto hidden w-full max-w-xs lg:block" aria-hidden>
            <div className="card rotate-2 !p-5 shadow-lift">
              <div className="mb-3 flex items-center justify-between">
                <span className="badge bg-brand-100 text-brand-800">Montagem</span>
                <span className="text-xs text-gray-400">Jardim da Penha</span>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                “Montar guarda-roupa de 6 portas e duas mesas de cabeceira.”
              </p>
              <div className="mb-4 rounded-xl bg-sand-100 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Orçamento aceito</span>
                  <span className="font-display font-bold text-brand-800">R$ 180</span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                Concluído — pagamento liberado
              </div>
            </div>
            <div className="card absolute -left-16 top-40 w-52 -rotate-3 !p-4 shadow-lift">
              <p className="text-xs font-medium text-gray-500">Novo orçamento</p>
              <p className="font-display text-lg font-bold text-brand-800">R$ 175</p>
              <p className="text-xs text-gray-400">Sérgio · ★ 4,9 · Praia do Canto</p>
            </div>
          </div>
        </div>
        <Wave className="absolute bottom-0 left-0 h-10 w-full text-sand-100 sm:h-14" />
      </section>

      {/* ── Como funciona ────────────────────────────────────────────────── */}
      <section className="bg-sand-100 pb-20 pt-10">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
            Como funciona
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="card relative !border-none">
                <span className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-clay-500 font-display text-lg font-bold text-white shadow-card">
                  {step.n}
                </span>
                <h3 className="mb-2 mt-3 font-semibold text-brand-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categorias ───────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">
            O que você precisa hoje?
          </h2>
          <p className="mb-10 text-center text-gray-500">
            Seis categorias, prestadores da Grande Vitória.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href="/pedidos/novo"
                className="card group flex flex-col items-start gap-3 !p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.tone}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                    aria-hidden
                  >
                    {CATEGORY_ICONS[cat.slug]}
                  </svg>
                </span>
                <span className="font-medium text-ink group-hover:text-brand-700">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pagamento protegido ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-800 py-20 text-white">
        <Wave className="absolute -top-1 left-0 h-10 w-full rotate-180 text-sand-50 sm:h-14" />
        <div className="mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Seu dinheiro fica protegido até o fim
            </h2>
            <p className="mb-6 max-w-md leading-relaxed text-brand-100">
              O valor do Pix não vai direto para o prestador: fica retido com a gente.
              Só é liberado quando você confirma que o serviço foi concluído — e se algo
              der errado, você abre uma disputa e nossa equipe resolve.
            </p>
            <Link href="/pedidos/novo" className="btn bg-white !px-6 text-brand-800 hover:bg-sand-100">
              Criar meu primeiro pedido
            </Link>
          </div>
          <ol className="space-y-4">
            {[
              'Você paga via Pix e o valor fica retido',
              'O prestador faz o serviço e envia fotos',
              'Você confirma — só então ele recebe',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-4 rounded-2xl bg-brand-700/60 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-500 font-display font-bold">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-brand-50">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Prestador CTA ────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="card flex flex-col items-start gap-6 !bg-sand-100 !p-8 sm:flex-row sm:items-center sm:justify-between sm:!p-10">
            <div>
              <h2 className="mb-2 text-xl font-bold tracking-tight text-brand-900 sm:text-2xl">
                Trabalha com serviços? Receba pedidos do seu bairro.
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-gray-600">
                Sem mensalidade e sem pagar por lead: a comissão só existe quando você
                recebe. Cadastre-se, envie orçamentos e construa sua reputação.
              </p>
            </div>
            <Link href="/cadastro/prestador" className="btn-primary shrink-0 !px-7 !py-3">
              Quero me cadastrar
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
