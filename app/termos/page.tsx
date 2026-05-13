import Link from 'next/link'

export const metadata = {
  title: 'Termos de Uso — Concluído',
}

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Início
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">Termos de Uso</h1>
      <p className="mb-8 text-sm text-gray-500">
        Última atualização: maio de 2026 · Versão 1.0
      </p>

      <div className="prose prose-sm max-w-none text-gray-700 [&>h2]:mb-2 [&>h2]:mt-8 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:text-gray-900 [&>p]:mb-4 [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5">
        <h2>1. Objeto</h2>
        <p>
          A plataforma <strong>Concluído</strong> conecta clientes que precisam de serviços
          domésticos a prestadores independentes na região de Vitória e Vila Velha (ES). A
          Concluído não presta os serviços diretamente nem emprega os prestadores.
        </p>

        <h2>2. Cadastro e elegibilidade</h2>
        <p>
          O uso da plataforma exige cadastro com email válido. Você deve ter no mínimo 18 anos.
          Informações falsas resultam em cancelamento imediato da conta.
        </p>

        <h2>3. Responsabilidades do cliente</h2>
        <ul>
          <li>Descrever o serviço com precisão ao criar um pedido.</li>
          <li>Confirmar a conclusão ou abrir disputa dentro dos prazos (24h/48h).</li>
          <li>Não compartilhar o código de check-in com terceiros.</li>
        </ul>

        <h2>4. Responsabilidades do prestador</h2>
        <ul>
          <li>Executar o serviço conforme o orçamento aprovado.</li>
          <li>Enviar evidências fotográficas (antes e depois) obrigatoriamente.</li>
          <li>Responder a disputas dentro do prazo estipulado.</li>
          <li>Manter dados bancários e fiscais atualizados para recebimento.</li>
        </ul>

        <h2>5. Pagamentos e repasses</h2>
        <p>
          O pagamento é processado via Pix por parceiro PSP. O valor fica retido até confirmação
          da conclusão pelo cliente ou auto-aceite por timeout. A Concluído retém comissão de 15%
          (mínimo R$10) sobre o valor do serviço antes do repasse.
        </p>

        <h2>6. Disputas</h2>
        <p>
          Qualquer das partes pode abrir disputa dentro do prazo de auto-aceite. A decisão do
          administrador é final. Disputas recorrentes (3+ perdidas) resultam em suspensão de conta.
        </p>

        <h2>7. Cancelamento e reembolso</h2>
        <p>
          Cancelamentos antes do check-in geram reembolso integral. Após o check-in, o valor fica
          sujeito à análise de disputa. Reembolsos são processados em até 5 dias úteis.
        </p>

        <h2>8. Limitação de responsabilidade</h2>
        <p>
          A Concluído não se responsabiliza por danos causados pelo prestador ao imóvel ou ao
          cliente. Recomendamos que prestadores mantenham seguro de Responsabilidade Civil. A
          responsabilidade da plataforma limita-se ao valor da transação.
        </p>

        <h2>9. Privacidade</h2>
        <p>
          O tratamento de dados pessoais segue nossa{' '}
          <Link href="/privacidade" className="text-brand-600 underline">
            Política de Privacidade
          </Link>
          , em conformidade com a LGPD (Lei nº 13.709/2018).
        </p>

        <h2>10. Alterações</h2>
        <p>
          Podemos atualizar estes Termos a qualquer momento. Usuários serão notificados por email
          com 30 dias de antecedência para alterações materiais.
        </p>

        <h2>11. Foro</h2>
        <p>
          Fica eleito o foro da Comarca de Vitória (ES) para dirimir quaisquer controvérsias
          decorrentes destes Termos.
        </p>

        <h2>Contato</h2>
        <p>
          Dúvidas:{' '}
          <a href="mailto:contato@concluido.app" className="text-brand-600 underline">
            contato@concluido.app
          </a>
        </p>
      </div>
    </div>
  )
}
