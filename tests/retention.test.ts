import { describe, it, expect } from 'vitest'
import {
  shouldPurgeEvidence,
  evidenceRetentionDays,
  RETENTION_NO_DISPUTE_DAYS,
  RETENTION_DISPUTED_DAYS,
} from '@/lib/retention'

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-01-01T00:00:00Z')
const closedAt = T0.toISOString()

describe('evidenceRetentionDays', () => {
  it('90 dias sem disputa, 365 dias com disputa', () => {
    expect(evidenceRetentionDays(false)).toBe(RETENTION_NO_DISPUTE_DAYS)
    expect(evidenceRetentionDays(true)).toBe(RETENTION_DISPUTED_DAYS)
  })
})

describe('shouldPurgeEvidence — pedido sem disputa (90 dias)', () => {
  it('não apaga antes de 90 dias', () => {
    expect(shouldPurgeEvidence(closedAt, false, T0.getTime() + 89 * DAY)).toBe(false)
  })
  it('apaga exatamente aos 90 dias', () => {
    expect(shouldPurgeEvidence(closedAt, false, T0.getTime() + 90 * DAY)).toBe(true)
  })
})

describe('shouldPurgeEvidence — pedido com disputa (1 ano)', () => {
  it('NÃO apaga aos 90 dias (prazo estendido)', () => {
    expect(shouldPurgeEvidence(closedAt, true, T0.getTime() + 90 * DAY)).toBe(false)
  })
  it('apaga aos 365 dias', () => {
    expect(shouldPurgeEvidence(closedAt, true, T0.getTime() + 365 * DAY)).toBe(true)
  })
})

describe('shouldPurgeEvidence — robustez', () => {
  it('data inválida nunca apaga (não arrisca eliminar sem certeza)', () => {
    expect(shouldPurgeEvidence('sem-data', false, T0.getTime() + 10 * 365 * DAY)).toBe(false)
  })
})
