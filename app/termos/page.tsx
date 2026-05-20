export default function TermosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Termos de Uso</h1>
      <div className="space-y-4 text-sm text-gray-600">
        <p>Ao usar o Concluído, você concorda com os termos abaixo.</p>

        <h2 className="mt-6 text-base font-semibold text-gray-800">1. Serviço</h2>
        <p>O Concluído é uma plataforma de intermediação entre clientes e prestadores de serviços domésticos na região de Vitória/Vila Velha (ES). Não somos empregadores dos prestadores.</p>

        <h2 className="mt-6 text-base font-semibold text-gray-800">2. Pagamentos</h2>
        <p>Pagamentos processados via Pix (parceiro Asaas). Repasse ao prestador após confirmação da conclusão, descontada comissão de 15% (mínimo R$10).</p>

        <h2 className="mt-6 text-base font-semibold text-gray-800">3. Disputas</h2>
        <p>Cliente pode abrir disputa em até 24h após marcação de conclusão. Decisão final é do administrador.</p>

        <h2 className="mt-6 text-base font-semibold text-gray-800">4. Responsabilidades</h2>
        <p>O Concluído não se responsabiliza por danos durante a prestação. Prestadores são responsáveis pela qualidade e segurança do trabalho.</p>

        <h2 className="mt-6 text-base font-semibold text-gray-800">5. Suspensão</h2>
        <p>Contas com 3 ou mais disputas decididas contra o usuário podem ser suspensas automaticamente.</p>

        <p className="mt-8 text-xs text-gray-400">Última atualização: maio de 2025</p>
      </div>
    </div>
  )
}
