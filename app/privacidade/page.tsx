import Link from 'next/link'

export const metadata = {
  title: 'Política de Privacidade — Concluído',
}

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Início
        </Link>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-gray-900">Política de Privacidade</h1>
      <p className="mb-8 text-sm text-gray-500">
        Última atualização: maio de 2026 · Versão 1.0 · LGPD (Lei nº 13.709/2018)
      </p>

      <div className="prose prose-sm max-w-none text-gray-700 [&>h2]:mb-2 [&>h2]:mt-8 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:text-gray-900 [&>p]:mb-4 [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5">
        <h2>1. Controlador dos dados</h2>
        <p>
          Concluído Serviços Ltda. (CNPJ em obtenção), com sede em Vitória (ES). Contato DPO:{' '}
          <a href="mailto:privacidade@concluido.app" className="text-brand-600 underline">
            privacidade@concluido.app
          </a>
        </p>

        <h2>2. Dados coletados</h2>
        <ul>
          <li><strong>Cadastro:</strong> email, senha (hashed), nome completo, telefone, endereço.</li>
          <li><strong>Uso da plataforma:</strong> pedidos criados, orçamentos enviados, check-ins, evidências fotográficas, avaliações.</li>
          <li><strong>Financeiros:</strong> valor das transações, status de pagamento, ID de confirmação Pix. Não armazenamos dados de cartão de crédito.</li>
          <li><strong>Técnicos:</strong> logs de acesso, endereço IP (retido por 6 meses), user agent.</li>
        </ul>

        <h2>3. Finalidade e base legal</h2>
        <ul>
          <li><strong>Execução do contrato</strong> (Art. 7º, V): operar a plataforma de intermediação.</li>
          <li><strong>Obrigação legal</strong> (Art. 7º, II): manutenção de registros fiscais e financeiros.</li>
          <li><strong>Legítimo interesse</strong> (Art. 7º, IX): prevenção a fraudes, segurança da plataforma.</li>
          <li><strong>Consentimento</strong> (Art. 7º, I): comunicações de marketing (opcional, revogável).</li>
        </ul>

        <h2>4. Compartilhamento</h2>
        <ul>
          <li><strong>Asaas (PSP):</strong> nome e email do cliente para geração de cobrança Pix.</li>
          <li><strong>Supabase:</strong> infraestrutura de banco de dados (dados em servidores na região South America).</li>
          <li><strong>Entre partes:</strong> endereço completo compartilhado com o prestador somente após confirmação de pagamento.</li>
        </ul>
        <p>Não vendemos dados pessoais a terceiros.</p>

        <h2>5. Retenção</h2>
        <ul>
          <li>Dados de conta ativa: enquanto a conta existir.</li>
          <li>Registros financeiros: 5 anos (obrigação fiscal).</li>
          <li>Evidências fotográficas: 1 ano após conclusão do pedido.</li>
          <li>Logs de acesso: 6 meses.</li>
        </ul>

        <h2>6. Seus direitos (LGPD Art. 18)</h2>
        <ul>
          <li><strong>Acesso:</strong> <code>GET /api/me/export</code> — baixe todos os seus dados em JSON.</li>
          <li><strong>Correção:</strong> edite seu perfil nas configurações da conta.</li>
          <li><strong>Exclusão:</strong> <code>DELETE /api/me</code> anonimiza seus dados (exceto registros financeiros retidos por obrigação legal).</li>
          <li><strong>Portabilidade:</strong> o export JSON cobre todos os dados tratados.</li>
          <li><strong>Revogação de consentimento:</strong> desative notificações de marketing em configurações.</li>
        </ul>
        <p>
          Para exercer direitos não cobertos acima, contate{' '}
          <a href="mailto:privacidade@concluido.app" className="text-brand-600 underline">
            privacidade@concluido.app
          </a>{' '}
          com prazo de resposta de 15 dias.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Dados em trânsito: TLS 1.2+. Dados em repouso: criptografia AES-256 (Supabase). Acesso
          interno restrito ao mínimo necessário (princípio do menor privilégio). Incidentes de
          segurança serão notificados à ANPD e aos titulares afetados conforme exigido por lei.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Utilizamos apenas cookies estritamente necessários para autenticação (sessão Supabase).
          Não utilizamos cookies de rastreamento ou publicidade de terceiros.
        </p>

        <h2>9. Menores</h2>
        <p>
          A plataforma não é destinada a menores de 18 anos. Contas identificadas como de menores
          serão canceladas.
        </p>

        <h2>10. Alterações</h2>
        <p>
          Alterações materiais serão comunicadas por email com 30 dias de antecedência. O uso
          continuado após a data de vigência implica aceite.
        </p>
      </div>

      <div className="mt-8 border-t border-gray-200 pt-6 text-center">
        <Link href="/termos" className="text-sm text-brand-600 hover:underline">
          Ver Termos de Uso →
        </Link>
      </div>
    </div>
  )
}
