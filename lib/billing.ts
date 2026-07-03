// Regras financeiras e de timeout do Concluído.
// Centralizado aqui para ser testável (tests/billing.test.ts) e para o
// webhook, o cron e as server actions nunca divergirem.

// Comissão: 15%, mínimo R$10 (PRD seção 7)
export const COMMISSION_RATE = 0.15
export const MIN_COMMISSION_CENTS = 1000

// Orçamento mínimo: abaixo de R$30 o repasse líquido fica desproporcional
// (a comissão mínima de R$10 passaria de 33% do valor)
export const MIN_QUOTE_CENTS = 3000

// Auto-aceite (PRD seção 6): ≤ R$300 → 24h; > R$300 → 48h
export const AUTO_ACCEPT_THRESHOLD_CENTS = 30000
export const AUTO_ACCEPT_LOW_MS = 24 * 60 * 60 * 1000
export const AUTO_ACCEPT_HIGH_MS = 48 * 60 * 60 * 1000

export type Commission = {
  grossCents: number
  commissionCents: number
  netCents: number
  commissionRate: number
  minCommissionCents: number
}

/**
 * Calcula comissão e repasse líquido de um pagamento.
 * Lança se o valor for menor que o orçamento mínimo — um pagamento abaixo
 * disso nunca deveria existir (submitQuote valida na entrada).
 */
export function computeCommission(grossCents: number): Commission {
  if (!Number.isInteger(grossCents) || grossCents < MIN_QUOTE_CENTS) {
    throw new Error(
      `Valor inválido para comissão: ${grossCents} centavos (mínimo ${MIN_QUOTE_CENTS}).`
    )
  }
  const commissionCents = Math.max(
    Math.round(grossCents * COMMISSION_RATE),
    MIN_COMMISSION_CENTS
  )
  return {
    grossCents,
    commissionCents,
    netCents: grossCents - commissionCents,
    commissionRate: COMMISSION_RATE,
    minCommissionCents: MIN_COMMISSION_CENTS,
  }
}

/** Valor de orçamento aceito pela plataforma? */
export function isValidQuoteValue(valueCents: number): boolean {
  return Number.isInteger(valueCents) && valueCents >= MIN_QUOTE_CENTS
}

/** Janela de auto-aceite para um pedido, em ms. */
export function autoAcceptWindowMs(finalValueCents: number | null): number {
  return (finalValueCents ?? 0) <= AUTO_ACCEPT_THRESHOLD_CENTS
    ? AUTO_ACCEPT_LOW_MS
    : AUTO_ACCEPT_HIGH_MS
}

/** O pedido concluído em completedAt já deve ser auto-aceito em nowMs? */
export function shouldAutoAccept(
  completedAtIso: string,
  finalValueCents: number | null,
  nowMs: number
): boolean {
  const completedMs = new Date(completedAtIso).getTime()
  if (Number.isNaN(completedMs)) return false
  return nowMs - completedMs >= autoAcceptWindowMs(finalValueCents)
}
