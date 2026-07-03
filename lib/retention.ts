// Política de retenção das evidências fotográficas (fotos antes/durante/depois
// do serviço). Fundamentação legal do prazo:
//
//  • LGPD (Lei 13.709/2018)
//      Art. 6º, I/III  — finalidade e minimização: a foto existe para provar a
//                        execução do serviço em caso de disputa/chargeback;
//                        cumprida a finalidade, deve ser eliminada.
//      Art. 15/16      — término do tratamento → eliminação, salvo hipóteses
//                        legais de guarda.
//      Art. 7º, VI     — retenção lícita para exercício regular de direitos em
//                        processo (base para manter mais tempo o que virou litígio).
//
//  • CDC (Lei 8.078/1990)
//      Art. 26, II     — DECADÊNCIA de 90 dias para o consumidor reclamar de
//                        vício APARENTE em serviço durável. → ancora o prazo
//                        padrão: passados 90 dias da conclusão sem reclamação,
//                        o valor probatório rotineiro da foto se esgota.
//      Art. 27         — PRESCRIÇÃO de 5 anos para reparação por FATO do serviço
//                        (dano). Relevante só quando há dano/litígio concreto.
//
//  • Código Civil (Lei 10.406/2002)
//      Art. 206, §3º, V — prescrição de 3 anos para reparação civil.
//
// Decisão adotada (equilíbrio entre minimização e defesa em juízo):
//   - Pedido SEM disputa:  eliminar 90 dias após o encerramento (CDC Art. 26, II;
//                          também cobre a janela de chargeback do Pix).
//   - Pedido COM disputa:  reter 1 ano após o encerramento (LGPD Art. 7º, VI —
//                          exercício regular de direitos). Se houver processo
//                          formal em curso, aplicar retenção específica (hold)
//                          caso a caso — não coberto por este job automático.
//
// Registros FINANCEIROS (payments, payouts, financial_events) seguem retenção
// fiscal de 5 anos e NÃO são afetados por este módulo — aqui só apagamos os
// blobs de imagem e suas linhas em service_evidence.

export const RETENTION_NO_DISPUTE_DAYS = 90
export const RETENTION_DISPUTED_DAYS = 365

const DAY_MS = 24 * 60 * 60 * 1000

/** Janela de retenção (em dias) aplicável a um pedido. */
export function evidenceRetentionDays(hadDispute: boolean): number {
  return hadDispute ? RETENTION_DISPUTED_DAYS : RETENTION_NO_DISPUTE_DAYS
}

/**
 * A evidência de um pedido encerrado em `closedAtIso` já pode ser eliminada
 * em `nowMs`? `hadDispute` estende o prazo de 90 dias para 1 ano.
 * Datas inválidas retornam false (nunca apaga sem certeza da data).
 */
export function shouldPurgeEvidence(
  closedAtIso: string,
  hadDispute: boolean,
  nowMs: number
): boolean {
  const closedMs = new Date(closedAtIso).getTime()
  if (Number.isNaN(closedMs)) return false
  return nowMs - closedMs >= evidenceRetentionDays(hadDispute) * DAY_MS
}

// Estados terminais em que um pedido está encerrado e sem fluxo ativo — só
// nesses a evidência pode entrar na fila de eliminação. 'disputed' fica de
// fora de propósito: disputa aberta ainda precisa das fotos.
export const CLOSED_ORDER_STATUSES = [
  'accepted_by_customer',
  'auto_accepted',
  'payout_released',
  'cancelled',
  'refunded',
  'expired',
] as const
