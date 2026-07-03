import { describe, it, expect } from 'vitest'
import {
  computeCommission,
  isValidQuoteValue,
  autoAcceptWindowMs,
  shouldAutoAccept,
  MIN_QUOTE_CENTS,
  MIN_COMMISSION_CENTS,
  AUTO_ACCEPT_THRESHOLD_CENTS,
  AUTO_ACCEPT_LOW_MS,
  AUTO_ACCEPT_HIGH_MS,
} from '@/lib/billing'

describe('computeCommission', () => {
  it('aplica 15% em valores altos', () => {
    const c = computeCommission(100_00) // R$100
    expect(c.commissionCents).toBe(15_00)
    expect(c.netCents).toBe(85_00)
  })

  it('aplica comissão mínima de R$10 em valores baixos', () => {
    const c = computeCommission(30_00) // R$30 → 15% seria R$4,50
    expect(c.commissionCents).toBe(MIN_COMMISSION_CENTS)
    expect(c.netCents).toBe(20_00)
  })

  it('ponto de virada: 15% supera o mínimo a partir de ~R$66,67', () => {
    expect(computeCommission(66_66).commissionCents).toBe(MIN_COMMISSION_CENTS)
    expect(computeCommission(67_00).commissionCents).toBe(10_05)
  })

  it('repasse líquido nunca é negativo ou zero para orçamentos válidos', () => {
    for (const cents of [MIN_QUOTE_CENTS, 35_00, 50_00, 100_00, 300_00, 1000_00]) {
      const c = computeCommission(cents)
      expect(c.netCents).toBeGreaterThan(0)
      expect(c.commissionCents + c.netCents).toBe(cents)
    }
  })

  it('rejeita valores abaixo do orçamento mínimo', () => {
    expect(() => computeCommission(MIN_QUOTE_CENTS - 1)).toThrow()
    expect(() => computeCommission(0)).toThrow()
    expect(() => computeCommission(-100)).toThrow()
  })

  it('rejeita valores não inteiros (centavos quebrados)', () => {
    expect(() => computeCommission(50_00.5)).toThrow()
  })
})

describe('isValidQuoteValue', () => {
  it('aceita exatamente o mínimo (R$30)', () => {
    expect(isValidQuoteValue(MIN_QUOTE_CENTS)).toBe(true)
  })
  it('rejeita 1 centavo abaixo do mínimo', () => {
    expect(isValidQuoteValue(MIN_QUOTE_CENTS - 1)).toBe(false)
  })
  it('rejeita não inteiros e negativos', () => {
    expect(isValidQuoteValue(3000.5)).toBe(false)
    expect(isValidQuoteValue(-3000)).toBe(false)
  })
})

describe('autoAcceptWindowMs', () => {
  it('pedidos até R$300 têm janela de 24h (inclusive no limite)', () => {
    expect(autoAcceptWindowMs(AUTO_ACCEPT_THRESHOLD_CENTS)).toBe(AUTO_ACCEPT_LOW_MS)
    expect(autoAcceptWindowMs(100_00)).toBe(AUTO_ACCEPT_LOW_MS)
  })
  it('pedidos acima de R$300 têm janela de 48h', () => {
    expect(autoAcceptWindowMs(AUTO_ACCEPT_THRESHOLD_CENTS + 1)).toBe(AUTO_ACCEPT_HIGH_MS)
    expect(autoAcceptWindowMs(500_00)).toBe(AUTO_ACCEPT_HIGH_MS)
  })
  it('valor nulo cai na janela curta (conservador para o cliente)', () => {
    expect(autoAcceptWindowMs(null)).toBe(AUTO_ACCEPT_LOW_MS)
  })
})

describe('shouldAutoAccept', () => {
  const T0 = new Date('2026-07-01T12:00:00Z')

  it('dispara exatamente ao completar a janela de 24h', () => {
    const completedAt = T0.toISOString()
    const now24h = T0.getTime() + AUTO_ACCEPT_LOW_MS
    expect(shouldAutoAccept(completedAt, 100_00, now24h)).toBe(true)
    expect(shouldAutoAccept(completedAt, 100_00, now24h - 1)).toBe(false)
  })

  it('valores altos esperam 48h — 24h não basta', () => {
    const completedAt = T0.toISOString()
    const now24h = T0.getTime() + AUTO_ACCEPT_LOW_MS
    const now48h = T0.getTime() + AUTO_ACCEPT_HIGH_MS
    expect(shouldAutoAccept(completedAt, 500_00, now24h)).toBe(false)
    expect(shouldAutoAccept(completedAt, 500_00, now48h)).toBe(true)
  })

  it('data inválida nunca dispara (não trava o job)', () => {
    expect(shouldAutoAccept('data-invalida', 100_00, T0.getTime())).toBe(false)
  })
})
