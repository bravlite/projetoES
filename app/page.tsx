const CATEGORIES = [
  { slug: 'eletrica', name: 'Elétrica', icon: '⚡' },
  { slug: 'hidraulica', name: 'Hidráulica', icon: '🔧' },
  { slug: 'montagem', name: 'Montagem', icon: '🪑' },
  { slug: 'limpeza', name: 'Limpeza', icon: '🧹' },
  { slug: 'ar-condicionado', name: 'Ar-condicionado', icon: '❄️' },
  { slug: 'reparos', name: 'Pequenos reparos', icon: '🔨' },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          Precisa de ajuda em casa?
        </h1>
        <p className="mb-2 text-lg text-gray-600">
          Contrate prestadores verificados em Vitória e Vila Velha.
        </p>
        <p className="mb-8 text-base text-gray-500">
          Você só paga quando o serviço estiver concluído.
        </p>
        <a
          href="/pedidos/novo"
          className="inline-block rounded-lg bg-brand-600 px-8 py-3 text-lg font-semibold text-white hover:bg-brand-700"
        >
          Criar pedido
        </a>
      </section>

      <section>
        <h2 className="mb-6 text-center text-xl font-semibold text-gray-700">
          Categorias disponíveis
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.slug}
              className="flex flex-col items-center rounded-xl border border-gray-200 p-6 text-center hover:border-brand-500 hover:shadow-sm"
            >
              <span className="mb-2 text-3xl">{cat.icon}</span>
              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-xl bg-gray-50 p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-gray-800">É prestador de serviços?</h2>
        <p className="mb-4 text-sm text-gray-600">
          Sem custo por lead. Você só paga a comissão quando receber.
        </p>
        <a href="/cadastro/prestador" className="text-sm font-medium text-brand-600 hover:underline">
          Cadastrar como prestador →
        </a>
      </section>
    </div>
  )
}
