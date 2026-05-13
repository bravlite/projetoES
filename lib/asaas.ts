// lib/asaas.ts
// Cliente para API Asaas (PSP para cobranças Pix).
// Documentação: https://docs.asaas.com/reference/
//
// Mock mode: quando ASAAS_API_KEY não está configurada (dev sem .env.local),
// retorna dados fictícios para permitir testar o fluxo sem PSP real.

const ASAAS_BASE =
  process.env.ASAAS_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3'

function isMockMode(): boolean {
  return !process.env.ASAAS_API_KEY
}

async function asaasRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      access_token: process.env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
      'User-Agent': 'concluido-app/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) {
    const msg =
      (data as { errors?: { description: string }[] }).errors?.[0]?.description ??
      `Asaas API error ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

// ─── Customer ────────────────────────────────────────────────────────────────

/**
 * Cria um cliente no Asaas e retorna o ID.
 * Em mock mode, retorna um ID fictício.
 */
export async function createAsaasCustomer(params: {
  name: string
  email: string
  externalReference: string // user.id
}): Promise<string> {
  if (isMockMode()) return `mock_customer_${params.externalReference.slice(0, 8)}`

  const data = await asaasRequest<{ id: string }>('/customers', 'POST', {
    name: params.name || 'Cliente',
    email: params.email,
    externalReference: params.externalReference,
  })
  return data.id
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type AsaasPixResult = {
  chargeId: string
  pixPayload: string       // copia-e-cola
  pixQrBase64: string      // imagem base64 (vazio em mock)
  expiresAt: Date
  isMock: boolean
}

// Código Pix fictício para desenvolvimento
const MOCK_PIX_PAYLOAD =
  '00020126580014BR.GOV.BCB.PIX0136demo-concluido-app-mock-pix-code' +
  '5204000053039865802BR5913Concluido App6009Vitoria6304ABCD'

/**
 * Cria uma cobrança Pix no Asaas e retorna QR code + copia-e-cola.
 * Em mock mode, retorna dados fictícios sem chamar a API.
 */
export async function createPixPayment(params: {
  asaasCustomerId: string
  valueCents: number
  description: string
  externalReference: string // order_id
}): Promise<AsaasPixResult> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutos

  if (isMockMode()) {
    return {
      chargeId: `mock_charge_${Date.now()}`,
      pixPayload: MOCK_PIX_PAYLOAD,
      pixQrBase64: '',
      expiresAt,
      isMock: true,
    }
  }

  // Asaas espera o valor em BRL (float), não centavos
  const today = new Date().toISOString().split('T')[0]

  const payment = await asaasRequest<{ id: string }>('/payments', 'POST', {
    customer: params.asaasCustomerId,
    billingType: 'PIX',
    value: params.valueCents / 100,
    dueDate: today,
    description: params.description,
    externalReference: params.externalReference,
  })

  const qr = await asaasRequest<{
    success: boolean
    encodedImage: string
    payload: string
  }>(`/payments/${payment.id}/pixQrCode`, 'GET')

  return {
    chargeId: payment.id,
    pixPayload: qr.payload,
    pixQrBase64: qr.encodedImage,
    expiresAt,
    isMock: false,
  }
}
